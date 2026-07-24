import fs from 'node:fs'
import path from 'node:path'

// Walks up from `startDir` until a package.json is found.
export function findPackageJsonPath(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
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
