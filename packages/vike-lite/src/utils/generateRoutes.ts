import fs from 'node:fs'
import path from 'node:path'

const nonPageExtensions = ['.ts', '.js']
const pageExtensions = ['.tsx', '.jsx', '.vue']

function findFile(files: string[], basename: string, extensions: string[]): string | undefined {
  return files.find(file =>
    extensions.some(ext => file === `${basename}${ext}`)
  )
}

export function generateRoutes(viteRoot: string, pagesDir: string): { routes: Route[]; errorRoute?: Route } {
  const pagesAbsPath = path.resolve(viteRoot, pagesDir)
  if (!fs.existsSync(pagesAbsPath)) return { routes: [] }

  const routes: Route[] = []
  let errorRoute: Route | undefined

  function walk(dir: string, routePath: string, parentLayout?: string, parentHead?: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const files = entries.map(entry => entry.name)

    const importPath = path.relative(viteRoot, dir).replaceAll('\\', '/')

    // Layout and Head: override locale if present, otherwise inherit from parent
    const layoutFile = findFile(files, '+Layout', pageExtensions)
    const currentLayout = layoutFile ? `${importPath}/${layoutFile}` : parentLayout
    const headFile = findFile(files, '+Head', pageExtensions)
    const currentHead = headFile ? `${importPath}/${headFile}` : parentHead

    const pageFile = findFile(files, '+Page', pageExtensions)
    if (pageFile) {
      const route: Route = {
        path: routePath || '/',
        page: `${importPath}/${pageFile}`
      }
      const dataFile = findFile(files, '+data', nonPageExtensions)
      const titleFile = findFile(files, '+title', nonPageExtensions)
      const prerenderFile = findFile(files, '+prerender', nonPageExtensions)

      if (dataFile) route.data = `${importPath}/${dataFile}`
      if (titleFile) route.title = `${importPath}/${titleFile}`
      if (prerenderFile) route.prerender = `${importPath}/${prerenderFile}`

      if (currentLayout) route.layout = currentLayout
      if (currentHead) route.head = currentHead
      routes.push(route)
    }

    // Explore subfolders (dirent.isDirectory() is already known from readdirSync above,
    // avoiding an extra statSync syscall per entry)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const file = entry.name
      const fullPath = path.join(dir, file)

      // _error is reserved: register it separately and do not add it to the normal routes
      if (file === '_error') {
        const errorFiles = fs.readdirSync(fullPath)
        const errorPageFile = findFile(errorFiles, '+Page', pageExtensions)
        if (errorPageFile) {
          errorRoute = {
            path: '_error',
            page: `${importPath}/_error/${errorPageFile}`,
            layout: currentLayout,
            head: currentHead
          }
        }
        continue  // don't explore _error as a normal route
      }

      if (file.startsWith('_')) continue  // ignore other private folders

      const newRoutePath = routePath + (routePath.endsWith('/') ? '' : '/') + file.replace(/^@/, ':')
      walk(fullPath, newRoutePath, currentLayout, currentHead)
    }
  }

  walk(pagesAbsPath, '')

  routes.sort((a, b) => {
    const aDynamic = a.path.includes(':')
    const bDynamic = b.path.includes(':')
    if (aDynamic && !bDynamic) return 1
    if (!aDynamic && bDynamic) return -1
    return b.path.length - a.path.length
  })

  const homeIndex = routes.findIndex(r => r.path === '/index')
  if (homeIndex !== -1) routes[homeIndex].path = '/'

  return { routes, errorRoute }
}
