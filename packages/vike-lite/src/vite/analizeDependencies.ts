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

  type Row = { c: string, s: string, typeStr: string, nameStr: string, alert: string, color: string }
  const rows: Row[] = []

  for (const [name, meta] of Object.entries(projectDependencies)) {
    const c = clientDeps?.get(name)
    const s = serverDeps?.get(name)

    const usedC = !!c
    const usedS = !!s
    const usedAnywhere = usedC || usedS
    const externalAnywhere = c?.isExternal || s?.isExternal

    let alert = ''
    let color = ''

    if (meta.type === 'dev' && externalAnywhere) {
      alert = '🚨 move to dependencies'
      color = '\u{1B}[31m' // red
    } else if (meta.type === '' && !usedAnywhere) {
      alert = '💡/🗑️ move to dev dependencies or remove'
      color = '\u{1B}[90m' // gray
    } else if (meta.type === '' && usedAnywhere && !externalAnywhere) {
      alert = '💡 safely bundled, can move to dev dependencies'
      color = '\u{1B}[34m' // blue
    }

    const typeStr = meta.type === 'dev' ? 'dev dependency' : (meta.type === 'peer' ? 'peer dependency' : 'dependency')

    // Plain "yes"/"" instead of emoji checkmarks: avoids double-width/missing-glyph
    // rendering issues on terminals (notably legacy Windows cmd.exe) that would
    // otherwise desync column widths even after correct padding.
    rows.push({ c: usedC ? 'yes' : '', s: usedS ? 'yes' : '', typeStr, nameStr: `${name}@${meta.version}`, alert, color })
  }

  rows.sort((a, b) => a.nameStr.localeCompare(b.nameStr))

  const headers = ['Used by client', 'Used by server', 'Type', 'Dependency name', 'Alert']
  const cellsOf = (r: Row) => [r.c, r.s, r.typeStr, r.nameStr, r.alert]

  // Compute widths from PLAIN text only — never from a string that already has
  // ANSI escape codes injected, or the invisible escape bytes would count toward
  // the padding length and misalign every following column.
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => cellsOf(r)[i].length)))

  // Only emit ANSI codes if the terminal actually understands them (this correctly
  // returns false on legacy Windows cmd.exe, true on Windows Terminal/PowerShell 7+/
  // most Unix terminals, and false when output is piped/redirected to a file).
  const useColor = process.stdout.hasColors?.() ?? false

  const separator = () => `+${widths.map(w => '-'.repeat(w + 2)).join('+')}+`
  const formatRow = (cells: string[], color?: string) =>
    `|${cells.map((cell, i) => {
      const padded = ` ${cell.padEnd(widths[i])} `
      return useColor && color ? `${color}${padded}\x1b[0m` : padded
    }).join('|')}|`

  console.log('\n📦 Dependency usage report:\n')
  console.log(separator())
  console.log(formatRow(headers))
  console.log(separator())
  for (const row of rows) console.log(formatRow(cellsOf(row), row.color))
  console.log(separator())
  console.log()
}
