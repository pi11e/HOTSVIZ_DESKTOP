import { spawn } from 'node:child_process'
import { cpSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parserProject = path.resolve(root, '..', 'HOTSPARSE', 'HeroesParser', 'HeroesParser.csproj')
const publishDir = path.join(root, 'resources', 'parser')

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`)))
})

console.log('Building HeroesParser (self-contained, win-x64)...')
await run('dotnet', [
  'publish', parserProject,
  '-c', 'Release',
  '-r', 'win-x64',
  '--self-contained',
  '-p:PublishSingleFile=true',
  '--output', path.join(root, '.parser-build'),
])

mkdirSync(publishDir, { recursive: true })
cpSync(path.join(root, '.parser-build', 'HeroesParser.exe'), path.join(publishDir, 'HeroesParser.exe'))
console.log(`Parser copied to ${path.join(publishDir, 'HeroesParser.exe')}`)
