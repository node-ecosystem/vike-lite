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
      console.warn(`⚠️ Failed to parse package.json for printDependencies:`, error)
    }
  }
  console.warn(`⚠️ Failed to find package.json for printDependencies starting from:`, viteConfigRoot)
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
    // If deployed with `npm ci --omit=dev`, the app will crash at runtime.
    if (meta.type === 'dev' && externalAnywhere) {
      alert = '🚨 ~ move to dependencies'
      color = '\u{1B}[31m' // red
    }
    // 💡/🗑️ UNUSED: Standard dependency, but completely missing from the build.
    // Bloats production node_modules for no reason.
    else if (meta.type === '' && !usedAnywhere) {
      alert = '💡/🗑️ ~ move to dev dependencies or remove'
      color = '\u{1B}[90m' // gray
    }
    // 💡 OPTIMIZATION: Standard dependency, but 100% bundled.
    // It's safe as a dependency, but moving it to devDependencies shrinks prod node_modules.
    else if (meta.type === '' && usedAnywhere && !externalAnywhere) {
      alert = '💡 ~ safely bundled, can move to dev dependencies'
      color = '\u{1B}[34m' // blue
    }
    // Standard dependency, but 100% externalized. It's correctly placed, but could be optimized by bundling it.
    else {
      alert = ''
      color = '\u{1B}[36m' // cyan
    }
    // OK (Falls through): 
    // - Dev deps that are 100% bundled (like `nanoid`) -> Harmless/Expected.
    // - Dev deps never touched by the build (like `vitest`, `eslint`) -> Expected build tooling.
    // - Standard deps that are externalized (like `hono`) -> Correctly placed.

    const typeStr = meta.type === 'dev' ? 'dev dependency' : (meta.type === 'peer' ? 'peer dependency' : 'dependency')

    rows.push({ c: usedC, s: usedS, typeStr, nameStr: `${name}@${meta.version}`, alert, color })
  }

  rows.sort((a, b) => a.nameStr.localeCompare(b.nameStr))

  console.log('\n📦 Dependency usage report:\n')
  console.log('| Used by Client | Used by Server | Type | Dependency name | Alert |')
  console.log('|---|---|---|---|---|')
  for (const row of rows) {
    const c = row.c ? '✅' : ''
    const s = row.s ? '✅' : ''

    const coloredName = `${row.color}${row.nameStr}\x1b[0m`
    const coloredAlert = row.alert ? `${row.color}${row.alert}\x1b[0m` : ''

    console.log(`| ${c} | ${s} | ${row.typeStr} | ${coloredName} | ${coloredAlert} |`)
  }
  console.log()
}
