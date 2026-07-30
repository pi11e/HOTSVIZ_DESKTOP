import { execSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })
const capture = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).toString().trim()
const prompt = (question) => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.question(question, (answer) => { rl.close(); resolve(answer) })
})

// 1. Bump version
run('node scripts/bump-version.mjs')
const version = `v${JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version}`
console.log(`\n=== Deploying ${version} ===\n`)

// 2. Build parser + app
run('npm run build-parser')
run('npm run build')

// 3. Generate raw commit log and prompt for release notes
const tags = capture('git tag --sort=-creatordate').split('\n').filter(Boolean)
const lastTag = tags[0] || null
const range = lastTag ? `${lastTag}..HEAD` : '--root'
const log = capture(`git log --oneline --format="- %s" ${range}`)

console.log('\nRaw commits since last tag:\n')
console.log(log)
console.log()

const notesPath = path.join(root, `release-notes-${version}.txt`)
writeFileSync(notesPath, `Release notes for ${version}\n\nWrite your user-facing patch notes below, save, then press Enter.\n\n${log}`, 'utf8')
console.log(`Wrote template to ${notesPath}`)
await prompt('Edit the file, save it, then press Enter to continue…')
let notes = readFileSync(notesPath, 'utf8').toString().trim()
unlinkSync(notesPath)

// Show proposed notes for confirmation
console.log('\n--- Proposed release notes ---\n')
console.log(notes)
console.log('\n------------------------------\n')

// 4. Confirm or edit
while (true) {
  const action = await prompt('[P]ublish / [E]dit / [C]ancel: ')
  if (action.toLowerCase() === 'p') break
  if (action.toLowerCase() === 'e') {
    writeFileSync(notesPath, notes, 'utf8')
    await prompt('Edit the file, save it, then press Enter to continue…')
    notes = readFileSync(notesPath, 'utf8').toString().trim()
    unlinkSync(notesPath)
    console.log('\n--- Proposed release notes ---\n')
    console.log(notes)
    console.log('\n------------------------------\n')
    continue
  }
  if (action.toLowerCase() === 'c') {
    console.log('Deploy cancelled.')
    process.exit(1)
  }
}

// 5. Commit, tag, push
run('git add -A')
run(`git commit --allow-empty -m "release ${version}"`)
run(`git tag ${version}`)
run('git push')
run('git push --tags')

// 6. Create GitHub Release and upload artifacts via electron-builder
console.log('Publishing to GitHub…')
// Write notes to a temp file for electron-builder to consume as release body
const releaseNotesPath = path.join(root, 'release-notes-body.txt')
writeFileSync(releaseNotesPath, notes, 'utf8')
run(`electron-builder --publish onTag --release-notes ${releaseNotesPath}`)
unlinkSync(releaseNotesPath)

console.log(`\n=== ${version} deployed ===`)
