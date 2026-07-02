import fs from 'node:fs'
import path from 'node:path'

export default function generateRoutes(viteRoot: string, pagesDir: string): { routes: Route[]; errorRoute?: Route } {
  const pagesAbsPath = path.resolve(viteRoot, pagesDir)
  if (!fs.existsSync(pagesAbsPath)) return { routes: [] }

  const routes: Route[] = []
  let errorRoute: Route | undefined

  function walk(dir: string, routePath: string, parentLayout?: string, parentHead?: string) {
    const files = fs.readdirSync(dir)

    const importPath = path.relative(viteRoot, dir).replaceAll('\\', '/')

    // Layout and Head: override locale if present, otherwise inherit from parent
    const currentLayout = files.includes('+Layout.tsx') ? `${importPath}/+Layout.tsx` : parentLayout
    const currentHead = files.includes('+Head.tsx') ? `${importPath}/+Head.tsx` : parentHead

    if (files.includes('+Page.tsx')) {
      const route: Route = {
        path: routePath || '/',
        page: `${importPath}/+Page.tsx`,
        hasData: files.includes('+data.ts'),
        hasTitle: files.includes('+title.ts')
      }
      if (currentLayout) route.layout = currentLayout
      if (currentHead) route.head = currentHead
      routes.push(route)
    }

    // Explore subfolders
    for (const file of files) {
      const fullPath = path.join(dir, file)
      if (!fs.statSync(fullPath).isDirectory()) continue

      // _error is reserved: register it separately and do not add it to the normal routes
      if (file === '_error') {
        const errorFiles = fs.readdirSync(fullPath)
        if (errorFiles.includes('+Page.tsx')) {
          errorRoute = {
            path: '_error',
            page: `${importPath}/_error/+Page.tsx`,
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
