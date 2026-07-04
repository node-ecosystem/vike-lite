import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { setTimeout } from 'node:timers/promises'

const colors = { reset: '\u{1B}[0m', cyan: '\u{1B}[36m', green: '\u{1B}[32m', yellow: '\u{1B}[33m', red: '\u{1B}[31m', magenta: '\u{1B}[35m' }
const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`)

const run = (cmd, ignoreError = false) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    if (ignoreError) return ''
    throw new Error(`❌ Command failed: ${cmd}${error.stderr?.toString() ?? error.message}`)
  }
}

const PACKAGES_DIR = 'packages'
const COMMIT_REGEX = /^([a-zA-Z]+)(?:\([^)]+\))?(!?):\s*(.*)/

// Decide the bump priority
const getBumpWeight = (type) => ({ major: 3, minor: 2, patch: 1, none: 0 }[type])

async function main() {
  const packages = fs.readdirSync(PACKAGES_DIR).filter(p => fs.statSync(path.join(PACKAGES_DIR, p)).isDirectory())
  const bumpsInfo = []

  log(`🔍 Analyzing packages in the monorepo…`, colors.cyan)

  for (const pkgName of packages) {
    const pkgPath = path.join(process.cwd(), PACKAGES_DIR, pkgName, 'package.json')
    if (!fs.existsSync(pkgPath)) continue

    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const currentVersion = pkgJson.version

    // Find the last tag specific to this package (e.g. vike-lite-solid@v1.3.1)
    const lastTag = run(`git describe --match "${pkgName}@v*" --abbrev=0 --tags`, true)
    const revisionRange = lastTag ? `${lastTag}..HEAD` : 'HEAD'

    // Ask Git only for commits that have touched the folder of THIS package!
    const commitsOutput = run(`git log ${revisionRange} --format="%s" -- ${PACKAGES_DIR}/${pkgName}`)

    if (!commitsOutput) continue // No changes to this package since the last release

    const commits = commitsOutput.split('\n').filter(Boolean)
    let packageBump = 'none'

    // Analyze commits to determine the version bump
    for (const msg of commits) {
      const match = msg.match(COMMIT_REGEX)
      // eslint-disable-next-line unicorn/no-break-in-nested-loop
      if (!match) continue

      const type = match[1]
      const isBreaking = match[2] === '!'

      let bumpType = 'none'
      if (isBreaking) bumpType = 'major'
      else if (type === 'feat') bumpType = 'minor'
      // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons
      else if (type === 'fix' || type === 'perf' || type === 'refactor') bumpType = 'patch'

      // Apply the highest bump (e.g. if there's a minor and a patch, minor wins)
      if (getBumpWeight(bumpType) > getBumpWeight(packageBump)) {
        packageBump = bumpType
      }
    }

    if (packageBump !== 'none') {
      let [major, minor, patch] = currentVersion.split('.').map(Number)
      // eslint-disable-next-line unicorn/prefer-switch
      if (packageBump === 'major') { major++; minor = 0; patch = 0 }
      else if (packageBump === 'minor') { minor++; patch = 0 }
      else if (packageBump === 'patch') { patch++ }

      bumpsInfo.push({ pkgName, pkgPath, pkgJson, currentVersion, newVersion: `${major}.${minor}.${patch}` })
    }
  }

  if (bumpsInfo.length === 0) {
    log('No new features or fixes detected in the packages. No release necessary.', colors.green)
    return
  }

  log('📦 Packages to update:', colors.magenta)
  for (const info of bumpsInfo) {
    log(`  - ${info.pkgName}: ${info.currentVersion} ➔  ${colors.green}${info.newVersion}${colors.reset}`)
  }

  // Ask for confirmation before proceeding
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Do you want to proceed with the bump, commit, and push? (y/N) `)
  rl.close()

  if (answer.toLowerCase() !== 'y') {
    log('Operation cancelled.', colors.red)
    return
  }

  log('🚀 Starting release process…', colors.cyan)

  // Write the new package.json files
  for (let i = 0, _len = bumpsInfo.length; i < _len; i++) {
    info.pkgJson.version = info.newVersion
    fs.writeFileSync(info.pkgPath, JSON.stringify(info.pkgJson, null, 2) + '\n')

    run(`git add "${info.pkgPath}"`)
    run(`git commit -m "release(${info.pkgName}): v${info.newVersion}"`)
    run('git push')
    log(`⬆️  ${info.pkgName}@v${info.newVersion} released`, colors.cyan)

    if (i < bumpsInfo.length - 1) await setTimeout(3000)
  }
  log('🎉 Release script completed', colors.green)
}

try {
  await main()
} catch (error) {
  log(error.message, colors.red)
}
