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

// Extracts the npm package name closest to the file from an absolute path
// (handles pnpm's nested node_modules/.pnpm/.../node_modules/ layout and scoped packages).
export function extractPackageNameFromPath(moduleId: string): string | null {
  const normalized = moduleId.replaceAll('\\', '/')
  const matches = [...normalized.matchAll(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/g)]
  if (matches.length === 0) return null
  return matches[matches.length - 1]![1]!
}

// Extracts the npm package name from a bare import specifier (e.g. 'solid-js/web' -> 'solid-js')
export function extractPackageNameFromImport(imp: string): string | null {
  if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('\0') || path.isAbsolute(imp) || imp.startsWith('node:')) return null
  const parts = imp.split('/')
  return imp.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]
}
