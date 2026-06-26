import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Plugin, RunnableDevEnvironment, ViteDevServer } from 'vite'

import type { Route } from './index'

function generateRoutes(pagesAbsPath: string): { routes: Route[]; errorRoute?: Route } {
  if (!fs.existsSync(pagesAbsPath)) return { routes: [] }

  const routes: Route[] = []
  let errorRoute: Route | undefined

  function walk(dir: string, routePath: string, parentLayout?: string, parentHead?: string) {
    const files = fs.readdirSync(dir)
    const importPath = '@/pages' + (
      dir === pagesAbsPath
        ? ''
        : '/' + path.relative(pagesAbsPath, dir).replaceAll('\\', '/')
    )

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

/**
 * Anti-FOUC: Inspect all known SSR modules, ask the client environment
 * to translate them into plain text (thanks to ?direct) and return them.
 */
async function injectFOUCStyles(server: ViteDevServer, html: string): Promise<string> {
  const styles = new Set<string>()
  const ssrEnv = server.environments.ssr
  const clientEnv = server.environments.client

  // Watch the entire SSR module map to find the files imported so far.
  for (const mod of ssrEnv.moduleGraph.idToModuleMap.values()) {
    if (!(mod.file && /\.(css|scss|sass|less|styl|stylus)($|\?)/.test(mod.file))) continue
    // Clean the module URL to get the original file path (remove query params)
    const url = mod.url.split('?', 1)[0]
    try {
      // Ask the CLIENT environment to render the raw CSS code. 
      // ?direct is essential in Vite to bypass the Javascript wrapping of HMR.
      const result = await clientEnv.transformRequest(url + '?direct')
      if (result?.code) styles.add(result.code)
    } catch {
      // Skip interruptions to avoid breaking during dev-typing
    }
  }

  if (styles.size === 0) return html

  const headEndIndex = html.lastIndexOf('</head>')
  const bodyEndIndex = html.lastIndexOf('</body>')

  let cssContent = ''
  for (const s of styles) cssContent += s

  const inlineCss = `<style type="text/css" data-vite-dev-fouc>${cssContent}</style>`
  // data-vite-dev-fouc ignores the styles from HMR.
  // So automatically remove it after its styles are applied during the first rendering.
  const cleanupScript = `<script type="module" data-vite-dev-fouc-cleanup>requestAnimationFrame(()=>{document.querySelectorAll('[data-vite-dev-fouc]').forEach(el=>el.remove());document.currentScript?.remove();})</script>`

  return html.slice(0, headEndIndex)
    + inlineCss
    + html.slice(headEndIndex, bodyEndIndex)
    + cleanupScript
    + html.slice(bodyEndIndex)
}

export default function routerPlugin({
  pagesDir = 'pages',
  serverEntry = 'server/index.ts',
  apiPrefix = '/api'
} = {}): Plugin {
  const isProd = process.env.NODE_ENV === 'production'
  let viteConfigRoot: string
  const virtualModuleId = 'virtual:routes'
  const virtualManifestId = 'virtual:client-manifest'
  // TODO add check for an adapter like vike-lite-solid is installed, otherwise throw an error
  const virtualAdapterId = 'virtual:vike-lite-solid'
  const virtualEntryClientId = 'virtual:entry-client'
  const virtualSetupId = 'virtual:vike-lite/setup'
  const virtualEntryServerId = 'virtual:entry-server'
  const resolvedVirtualModuleId = '\0' + virtualModuleId
  const resolvedVirtualManifestId = '\0' + virtualManifestId
  const resolvedVirtualEntryClientId = '\0' + virtualEntryClientId
  const resolvedVirtualSetupId = '\0' + virtualSetupId
  const resolvedVirtualEntryServerId = '\0' + virtualEntryServerId

  return {
    name: 'vike-lite',
    config() {
      // Fix white page issue: Disable Vite's internal HTML middleware      
      return {
        appType: 'custom',
        environments: {
          client: {
            build: {
              outDir: '../dist/client',
              emptyOutDir: true,
              cssMinify: true,
              manifest: true,
              rolldownOptions: {
                input: virtualEntryClientId,
                output: {
                  format: 'esm',
                  // Entry point virtual:entry-client
                  entryFileNames: 'assets/[name].[hash].js',
                  // Pages and shared chunks
                  chunkFileNames: (chunkInfo) => {
                    // If the chunk belongs to a page, put it in entries
                    if (chunkInfo.facadeModuleId?.includes(`/${pagesDir}/`)) {
                      return 'assets/pages/[name].[hash].js'
                    }
                    // Common chunk
                    return 'assets/chunks/[name].[hash].js'
                  },
                  // Static (File CSS, images, font, svg etc.)
                  assetFileNames: 'assets/static/[name].[hash][extname]'
                }
              }
            }
          },
          ssr: {
            build: {
              target: 'esnext',
              outDir: '../dist/server',
              emptyOutDir: true,
              rolldownOptions: {
                input: virtualEntryServerId,
                output: {
                  format: 'esm',
                  // Entry point as dist/server/index.mjs
                  entryFileNames: 'index.mjs',
                  chunkFileNames: (chunkInfo) => {
                    // If the chunk belongs to a page, put it in entries
                    if (chunkInfo.facadeModuleId?.includes(`/${pagesDir}/`)) {
                      return 'assets/pages/[name].[hash].mjs'
                    }
                    // Common chunk
                    return 'assets/chunks/[name].[hash].mjs'
                  }
                }
              }
            }
          }
        }
      }
    },
    configResolved(config) {
      viteConfigRoot = config.root
    },
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
      if (id === virtualManifestId) return resolvedVirtualManifestId
      if (id === virtualEntryClientId) return resolvedVirtualEntryClientId
      if (id === virtualSetupId) return resolvedVirtualSetupId
      if (id === virtualEntryServerId) return resolvedVirtualEntryServerId
    },
    async load(id, options) {
      // Generate the virtual routes module
      if (id === resolvedVirtualModuleId) {
        const { routes, errorRoute } = generateRoutes(path.resolve(viteConfigRoot, pagesDir))
        const isSSR = options!.ssr

        // Import the server rendering function from the bridge virtual module
        let code = `import { onRenderHtml } from '${virtualAdapterId}';\n`
          + `export const config = { onRenderHtml };\n`
          + `export const routes = [\n`

        for (const r of routes) {
          code += `{path:'${r.path}',page:'${r.page}',hasData:${r.hasData},hasTitle:${r.hasTitle},Page:()=>import('${r.page}'),`
          if (r.head) code += `Head:()=>import('${r.head}'),`
          if (r.layout) code += `Layout:()=>import('${r.layout}'),`
          if (isSSR) {
            if (r.hasData) code += `data:()=>import('${r.page.replace('+Page.tsx', '+data.ts')}'),`
            if (r.hasTitle) code += `title:()=>import('${r.page.replace('+Page.tsx', '+title.ts')}'),`
          }
          code += '},'
        }
        code += '];\n'

        if (errorRoute) {
          const e = errorRoute
          code += `export const errorRoute={path:'${e.path}',page:'${e.page}',Page:()=>import('${e.page}'),`
          if (e.layout) code += `Layout:()=>import('${e.layout}'),`
          if (e.head) code += `Head:()=>import('${e.head}'),`
          code += '};\n'
        } else {
          code += 'export const errorRoute=null;\n'
        }

        return code
      }

      // Generate virtual manifest
      if (id === resolvedVirtualManifestId) {
        if (!isProd || !options?.ssr) return 'export default {}'
        const manifestPath = path.join(viteConfigRoot, '../dist/client/.vite/manifest.json')
        const manifestContent = fs.readFileSync(manifestPath, 'utf8')
        return `export default ${manifestContent}`
      }

      // Generate virtual entry client
      if (id === resolvedVirtualEntryClientId) {
        // Import the client rendering function from the bridge virtual module
        return `
          import { routes, errorRoute } from '${virtualModuleId}';
          import { onRenderClient } from '${virtualAdapterId}';
          onRenderClient().then((module) => { module.default({ routes, errorRoute })});
        `
      }

      if (id === resolvedVirtualSetupId) {
        return `
          import { routes, errorRoute, config } from '${virtualModuleId}';
          import { setVikeState } from 'vike-lite/__internal/server';
          let manifest;
          if (process.env.NODE_ENV === 'production') {
            manifest = (await import('${virtualManifestId}')).default;
          }
          setVikeState({ routes, errorRoute, config, manifest });
        `;
      }

      if (id === resolvedVirtualEntryServerId) {
        const normalizedServerEntry = path.join(viteConfigRoot, serverEntry).replaceAll('\\', '/')
        return `import '${virtualSetupId}';
        export * from '${normalizedServerEntry}'
        export { default } from '${normalizedServerEntry}'`
      }
    },
    configureServer(server) {
      // Return a callback to run this middleware as last
      return () => {
        server.middlewares.use(async (req, res, next) => {
          // Handle /api, /*.pageContext.json and pages
          try {
            const ssrEnv = server.environments.ssr as RunnableDevEnvironment

            // Dev: populate the store on every request by importing virtual:routes
            // directly from the Module Runner — this way routes are always up-to-date
            // after page modifications (HMR-safe), without renderPage
            // needing to know about the virtual module.
            const { routes, errorRoute, config } = await ssrEnv.runner.import(virtualModuleId) as typeof import('virtual:routes')

            const { setVikeState } = await ssrEnv.runner.import('vike-lite/__internal/server') as typeof import('./server/internal')
            setVikeState({ routes, errorRoute, config })

            const absoluteServerEntry = path.join(viteConfigRoot, serverEntry)

            // Dynamically import the server app to ensure it uses the latest dev code
            // Migrated from server.ssrLoadModule with the new Environment Module Runner API
            const { default: app } = await ssrEnv.runner.import(absoluteServerEntry) as { default: { fetch: typeof fetch } }

            const headers = new Headers()
            for (const [key, value] of Object.entries(req.headers)) {
              if (key.startsWith(':')) continue
              if (Array.isArray(value)) {
                for (const v of value) headers.append(key, v)
              } else if (value !== undefined) {
                headers.set(key, value)
              }
            }

            const requestInit = { method: req.method, headers } as RequestInit
            if (req.url!.startsWith(apiPrefix)) {
              server.config.logger.info(`API request: ${req.method} ${req.url}`, { timestamp: true })
              requestInit.body = Readable.toWeb(req) as any
              // @ts-expect-error Property 'duplex' does not exist on type 'RequestInit'
              requestInit.duplex = 'half'
            } else if (req.url!.endsWith('.pageContext.json')) {
              server.config.logger.info(`SPA Navigation request: ${req.url}`, { timestamp: true })
            }

            // The frontend code is evaluated and the styles imports are registered internally in the ssrEnv.moduleGraph
            const response = await app.fetch(new Request(`http://${req.headers.host}${req.url}`, requestInit))
            res.statusCode = response.status

            if (response.headers.get('content-type')?.includes('text/html')) {
              server.config.logger.info(`Page request: ${req.url}`, { timestamp: true })
              let html = await response.text()

              // Fix FOUC: Inspect the Module Graph populated earlier,
              // extract the raw styles via ClientEnv and inject them
              html = await injectFOUCStyles(server, html)

              // Vite injects CSS styles and client scripts
              html = await server.transformIndexHtml(req.url!, html)
              res.setHeader('Content-Type', 'text/html')
              res.end(html)
              return
            }

            // Use the original pipeline with /api and /*.pageContext.json responses
            for (const [key, value] of response.headers) res.setHeader(key, value)
            if (!response.body) {
              res.end()
              return
            }
            if (res.destroyed || res.closed) return
            try {
              await pipeline(Readable.fromWeb(response.body as any), res)
            } catch { }
          } catch (error) {
            next(error)
          }
        })
      }
    }
  }
}
