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
