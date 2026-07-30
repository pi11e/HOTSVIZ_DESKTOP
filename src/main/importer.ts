import { app } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createInterface } from 'node:readline'
import type { DecodedPlayer, DecodedReplay } from '../shared/parser'
import type { ImportProgress, ImportResult } from '../shared/types'
import { DatabaseService, type MatchInput } from './database'

const BATCH_SIZE = 500

export const isOwner = (player: DecodedPlayer, owner: string | number | undefined) => String(player.PlayerToonId) === String(owner)

export function normaliseReplay(sourcePath: string, replay: DecodedReplay): MatchInput {
  const owner = replay.Players?.find((player) => isOwner(player, replay.ReplayOwner))
  if (!owner) throw new Error('The replay does not identify its owner.')
  const partySize = owner.PartyValue != null
    ? replay.Players?.filter((p) => p.Team === owner.Team && p.PartyValue === owner.PartyValue).length || 1
    : 1
  const hero = owner.PlayerHero?.HeroName || owner.PlayerHero?.HeroId
  const map = replay.MapInfo?.MapName || replay.MapInfo?.MapId
  if (!hero || !map || !replay.Timestamp || !replay.GameMode) throw new Error('The replay is missing match metadata.')
  return {
    id: String(replay.RandomValue || crypto.createHash('sha256').update(sourcePath).digest('hex')),
    sourcePath,
    playedAt: replay.Timestamp,
    gameMode: replay.GameMode.charAt(0).toLowerCase() + replay.GameMode.slice(1),
    mapName: map,
    heroName: hero,
    won: Boolean(owner.IsWinner),
    partySize,
  }
}

function parserPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'parser', 'HeroesParser.exe'),
    path.join(app.getAppPath(), 'resources', 'parser', 'HeroesParser.exe'),
    path.resolve(process.cwd(), '..', 'HOTSPARSE', 'HeroesParser', 'bin', 'Debug', 'net8.0', 'HeroesParser.exe'),
  ]
  return candidates.find((candidate) => fsSync.existsSync(candidate)) ?? null
}

async function decode(executable: string, sourcePath: string): Promise<DecodedReplay> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--replay-path', sourcePath], { windowsHide: true })
    let output = ''
    let errors = ''
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.stderr.on('data', (chunk) => { errors += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(errors || `Parser exited with code ${code}`))
      try {
        const parsed = JSON.parse(output) as { Ok: boolean; Data?: DecodedReplay; Error?: string }
        if (!parsed.Ok) return reject(new Error(parsed.Error || 'Parser returned an error'))
        resolve(parsed.Data as DecodedReplay)
      } catch { reject(new Error('Parser did not return valid JSON.')) }
    })
  })
}

export interface CancelHandle {
  abort(): void
}

let activeCancel: CancelHandle | null = null

export function cancelImport(): void {
  activeCancel?.abort()
}

export async function importReplayFolder(
  folderPath: string,
  database: DatabaseService,
  report: (progress: ImportProgress) => void,
  clean: boolean = false,
): Promise<ImportResult> {
  if (clean) await database.clearMatches()
  const executable = parserPath()
  if (!executable) throw new Error('HeroesParser.exe was not found.')

  const allFiles = (await fs.readdir(folderPath)).filter((f) => f.toLowerCase().endsWith('.stormreplay'))
  if (allFiles.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, ownerUnknown: 0, errors: [] }
  }

  const runId = await database.createImportRun(folderPath)
  const startTime = Date.now()
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, ownerUnknown: 0, errors: [] }
  let dbQueue: MatchInput[] = []
  let cancelled = false
  let child: ReturnType<typeof spawn>

  const abortController = { aborted: false, abort() { this.aborted = true; child?.kill() } }
  activeCancel = abortController

  const reportProgress = (current: number, total: number) => {
    const elapsedMs = Date.now() - startTime
    const estimatedMs = current > 0 ? Math.round((elapsedMs / current) * total) : 0
    report({
      current,
      total,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      elapsedMs,
      estimatedMs,
    })
  }

  let filesToParse: string[]

  if (clean) {
    filesToParse = allFiles.map((f) => path.join(folderPath, f))
  } else {
    filesToParse = []
    for (const f of allFiles) {
      if (cancelled || abortController.aborted) break
      const fullPath = path.join(folderPath, f)
      if (await database.hasMatch(fullPath)) {
        result.skipped++
      } else {
        filesToParse.push(fullPath)
      }
    }
  }

  if (filesToParse.length === 0) {
    activeCancel = null
    reportProgress(0, 0)
    await database.updateImportRun(runId, {
      finishedAt: new Date().toISOString(),
      totalFiles: 0,
      imported: 0,
      skipped: result.skipped,
      failed: 0,
      status: 'completed',
    })
    return result
  }

  const batchTotal = filesToParse.length

  const flushQueue = async (): Promise<void> => {
    if (dbQueue.length === 0) return
    const batch = dbQueue
    dbQueue = []
    const { inserted, skipped } = await database.insertMatchBatch(batch)
    result.imported += inserted
    result.skipped += skipped
  }

  let tempFilePath: string | undefined

  if (clean) {
    child = spawn(executable, ['--batch', folderPath], { windowsHide: true })
  } else {
    tempFilePath = path.join(app.getPath('temp'), `hotsviz-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
    await fs.writeFile(tempFilePath, filesToParse.join('\n'))
    child = spawn(executable, ['--file-list', tempFilePath], { windowsHide: true })
  }

  child.on('error', (error) => {
    result.failed += batchTotal
    result.errors.push(`Parser failed to start: ${error.message}`)
    cancelled = true
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const lines = String(chunk).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const progress = JSON.parse(line) as { current: number; total: number }
        if (progress.total > 0) reportProgress(progress.current, progress.total)
      } catch { /* ignore non-JSON stderr */ }
    }
  })

  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity })

    rl.on('line', async (line) => {
      if (cancelled || abortController.aborted) return
      let sourceName = 'unknown'
      try {
        const record = JSON.parse(line) as { Ok: boolean; SourcePath: string; NeedsOwnerVerification?: boolean; Data?: DecodedReplay; Error?: string }
        sourceName = path.basename(record.SourcePath)
        if (!record.Ok) {
          result.failed++
          result.errors.push(`${sourceName}: ${record.Error || 'Unknown error'}`)
          return
        }
        if (record.NeedsOwnerVerification) result.ownerUnknown++
        const match = normaliseReplay(record.SourcePath, record.Data!)
        dbQueue.push(match)
        if (dbQueue.length >= BATCH_SIZE) {
          rl.pause()
          await flushQueue()
          rl.resume()
        }
      } catch (error) {
        result.failed++
        result.errors.push(`${sourceName}: ${error instanceof Error ? error.message : 'Import error'}`)
      }
    })

    rl.on('close', async () => {
      await flushQueue()
      resolve()
    })

    child.on('close', () => {
      rl.close()
    })
  })

  if (tempFilePath) {
    try { await fs.unlink(tempFilePath) } catch { /* ignore */ }
  }

  activeCancel = null
  const status = (cancelled || abortController.aborted) ? 'cancelled' : 'completed'
  await database.updateImportRun(runId, {
    finishedAt: new Date().toISOString(),
    totalFiles: batchTotal,
    imported: result.imported,
    skipped: result.skipped,
    failed: result.failed,
    status,
  })

  reportProgress(batchTotal, batchTotal)
  return result
}
