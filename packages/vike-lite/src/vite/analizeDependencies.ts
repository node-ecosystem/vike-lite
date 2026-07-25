import fs from 'node:fs'
import path from 'node:path'

// Walks up from `startDir` until a package.json is found.
function findPackageJsonPath(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

type DepType = 'peer' | 'dev' | ''

export type ProjectDependencies = Record<string, { version: string, type: DepType }>

export function getProjectDependencies(viteConfigRoot: string): ProjectDependencies | null {
  const pkgJsonPath = findPackageJsonPath(viteConfigRoot)
  if (pkgJsonPath) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
      const projectDependencies: ProjectDependencies = {}
      // Store both the version and the type of dependency to help with auditing
      for (const [k, v] of Object.entries(pkgJson.dependencies || {}))
        projectDependencies[k] = { version: String(v), type: '' }
      for (const [k, v] of Object.entries(pkgJson.devDependencies || {}))
        if (!projectDependencies[k]) projectDependencies[k] = { version: String(v), type: 'dev' }
      for (const [k, v] of Object.entries(pkgJson.peerDependencies || {}))
        if (!projectDependencies[k]) projectDependencies[k] = { version: String(v), type: 'peer' }
      return projectDependencies
    } catch (error) {
      console.warn(`⚠️ Failed to parse package.json for "analizeDependencies":`, error)
    }
  }
  console.warn(`⚠️ Failed to find package.json for "analizeDependencies" starting from:`, viteConfigRoot)
  return null
}

export function extractPkgName(id: string): string | null {
  if (id.startsWith('\0')) return null // rolldown/vite virtual module convention

  const normalized = id.replaceAll('\\', '/')

  // 1. Resolve paths inside node_modules (handles pnpm/yarn nested structure)
  // Using matchAll and grabbing the last match ensures we bypass '.pnpm' virtual stores
  const matches = [...normalized.matchAll(/(?:node_modules|\.yarn(?:\/__virtual__)?)\/(@[^/]+\/[^/]+|[^/]+)/g)]
  if (matches.length > 0) {
    const pkg = matches[matches.length - 1]![1]!
    if (pkg !== '.pnpm') return pkg
  }

  // 2. Resolve bare specifiers (e.g. externalized SSR dependencies)
  if (!normalized.startsWith('.') && !normalized.startsWith('/') && !normalized.includes(':')) {
    const parts = normalized.split('/')
    return normalized.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]
  }

  return null
}

export type DepUsage = { version: string, type: DepType, isBundled: boolean, isExternal: boolean }

export type BundleReports = Partial<Record<'client' | 'ssr', Map<string, DepUsage>>>

export function printDependencyReport(bundleReports: BundleReports, projectDependencies: ProjectDependencies) {
  const clientDeps = bundleReports.client
  const serverDeps = bundleReports.ssr

  const rows: { c: boolean, s: boolean, typeStr: string, nameStr: string, alert: string, color: string }[] = []

  for (const [name, meta] of Object.entries(projectDependencies)) {
    const c = clientDeps?.get(name)
    const s = serverDeps?.get(name)

    const usedC = !!c
    const usedS = !!s
    const usedAnywhere = usedC || usedS
    const externalAnywhere = c?.isExternal || s?.isExternal

    let alert
    let color
    // 🚨 FATAL: Dev dependency, but it's externalized. 
    if (meta.type === 'dev' && externalAnywhere) {
      alert = '🚨 ~ move to dependencies'
      color = '\u{1B}[31m' // red
    }
    // 💡/♻️ UNUSED: Standard dependency, but completely missing from the build.
    else if (meta.type === '' && !usedAnywhere) {
      alert = '💡/♻️  ~ move to devDependencies or remove'
      color = '\u{1B}[90m' // gray
    }
    // 💡 OPTIMIZATION: Standard dependency, but 100% bundled.
    else if (meta.type === '' && usedAnywhere && !externalAnywhere) {
      alert = '💡 ~ safely bundled, move to devDependencies'
      color = '\u{1B}[34m' // blue
    }
    else {
      alert = ''
      color = '\u{1B}[36m' // cyan
    }

    rows.push({ c: usedC, s: usedS, typeStr: meta.type, nameStr: `${name}@${meta.version}`, alert, color })
  }

  rows.sort((a, b) => a.nameStr.localeCompare(b.nameStr))

  // 1. Calculate dynamic column widths (minimum width is the header length)
  const wClient = 6 // 'client'.length
  const wServer = 6 // 'server'.length
  const wType = 4   // 'peer'.length
  let wName = 4     // 'name'.length
  let wAlert = 5    // 'alert'.length

  // Find the longest string in the dynamic columns
  for (const row of rows) {
    if (row.nameStr.length > wName) wName = row.nameStr.length
    if (row.alert.length > wAlert) wAlert = row.alert.length - 2
  }

  // 2. Formatting Helpers
  const pad = (str: string, len: number) => str.padEnd(len, ' ')

  // Centers the checkmark so it looks nice in the column
  const centerCheck = (isTrue: boolean, len: number) => {
    if (!isTrue) return pad('', len)
    const check = '✅'
    const spaces = len - check.length + 1
    const left = Math.floor(spaces / 2)
    const right = spaces - left
    return ' '.repeat(left) + check + ' '.repeat(right)
  }

  console.log('\n📦 Dependency usage report:\n')

  // 3. Print Headers
  console.log(
    `| ${pad('Client', wClient)} ` +
    `| ${pad('Server', wServer)} ` +
    `| ${pad('Type', wType)} ` +
    `| ${pad('Name', wName)} ` +
    `| ${pad('Alert', wAlert)} |`
  )

  // 4. Print Separator Line
  console.log(
    `|-${'-'.repeat(wClient)}-` +
    `|-${'-'.repeat(wServer)}-` +
    `|-${'-'.repeat(wType)}-` +
    `|-${'-'.repeat(wName)}-` +
    `|-${'-'.repeat(wAlert)}-|`
  )

  // 5. Print Rows
  for (const row of rows) {
    const cStr = centerCheck(row.c, wClient)
    const sStr = centerCheck(row.s, wServer)
    const tStr = pad(row.typeStr, wType)

    // IMPORTANT: We pad the RAW string first, then wrap the padded string in color codes.
    // If we applied the color first, the ANSI escape characters would break the string length padding!
    const paddedName = pad(row.nameStr, wName)
    const coloredName = `${row.color}${paddedName}\x1b[0m`

    const paddedAlert = pad(row.alert, wAlert)
    const coloredAlert = row.alert ? `${row.color}${paddedAlert}\x1b[0m` : paddedAlert

    console.log(`| ${cStr} | ${sStr} | ${tStr} | ${coloredName} | ${coloredAlert} |`)
  }
  console.log()
}
