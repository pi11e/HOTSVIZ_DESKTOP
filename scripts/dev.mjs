import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electron = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
const run = (command, args, extra = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...extra })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} failed`)))
})

const parserSrc = path.join(root, 'resources', 'parser', 'HeroesParser.exe')
const parserDest = path.join(root, 'node_modules', 'electron', 'dist', 'resources', 'parser', 'HeroesParser.exe')
if (existsSync(parserSrc)) {
  mkdirSync(path.dirname(parserDest), { recursive: true })
  cpSync(parserSrc, parserDest)
}

await run(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.config.electron.ts'])
const vite = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
vite.printUrls()
const developmentUrl = vite.resolvedUrls?.local[0]
if (!developmentUrl) throw new Error('Vite started but did not provide a local URL.')
const electronProcess = spawn(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: developmentUrl },
})
const stop = () => { void vite.close(); electronProcess.kill(); process.exit() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
electronProcess.on('exit', () => { void vite.close() })
