import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Plugin, RunnableDevEnvironment } from 'vite'

import generateRoutes from './utils/generateRoutes'
import injectFOUCStyles from './utils/injectFOUCStyles'

export default function routerPlugin({
  pagesDir = 'pages',
  serverEntry = 'server/index',
  apiPrefix = '/api'
} = {}): Plugin {
  const isProd = process.env.NODE_ENV === 'production'
  let viteConfigRoot: string
  let outDir: string
  const virtualModuleId = 'virtual:routes'
  const virtualManifestId = 'virtual:client-manifest'
  const virtualRendererId = 'virtual:vike-lite/renderer'
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
    config(config) {
      outDir = config.build?.outDir ?? 'dist'
      const { emptyOutDir, minify = true, cssMinify = true, sourcemap } = config.build || {}
      return {
        // Fix white page issue: Disable Vite's internal HTML middleware      
        appType: 'custom',
        environments: {
          client: {
            build: {
              outDir: path.join(outDir, 'client'),
              emptyOutDir: emptyOutDir ?? true,
              minify,
              cssMinify,
              sourcemap,
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
              outDir: path.join(outDir, 'server'),
              emptyOutDir: emptyOutDir ?? true,
              minify,
              sourcemap,
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
        const { routes, errorRoute } = generateRoutes(viteConfigRoot, pagesDir)
        const isSSR = options!.ssr

        // Import the server rendering function from the bridge virtual module
        let code = `import { onRenderHtml } from '${virtualRendererId}';\n`
          + `export const config = { onRenderHtml };\n`
          + `export const routes = [\n`

        for (const r of routes) {
          code += `{path:'${r.path}',page:'${r.page}',Page:()=>import('/${r.page}'),`
          if (r.head) code += `head:'${r.head}',Head:()=>import('/${r.head}'),`
          if (r.layout) code += `layout:'${r.layout}',Layout:()=>import('/${r.layout}'),`
          code += `hasData:${r.hasData},hasTitle:${r.hasTitle},`
          if (isSSR) {
            if (r.hasData) code += `data:()=>import('/${r.page.replace('+Page.tsx', '+data.ts')}'),`
            if (r.hasTitle) code += `title:()=>import('/${r.page.replace('+Page.tsx', '+title.ts')}'),`
          }
          code += '},'
        }
        code += '];\n'

        if (errorRoute) {
          const e = errorRoute
          code += `export const errorRoute={path:'${e.path}',page:'${e.page}',Page:()=>import('/${e.page}'),`
          if (e.layout) code += `layout:'${e.layout}',Layout:()=>import('/${e.layout}'),`
          if (e.head) code += `head:'${e.head}',Head:()=>import('/${e.head}'),`
          code += '};\n'
        } else {
          code += 'export const errorRoute=null;\n'
        }

        return code
      }

      // Generate virtual manifest
      if (id === resolvedVirtualManifestId) {
        if (!isProd || !options?.ssr) return 'export default {}'
        const manifestPath = path.join(viteConfigRoot, outDir, 'client/.vite/manifest.json')
        const manifestContent = fs.readFileSync(manifestPath, 'utf8')
        return `export default ${manifestContent}`
      }

      // Generate virtual entry client
      if (id === resolvedVirtualEntryClientId) {
        // Import the client rendering function from the bridge virtual module
        return `import { routes, errorRoute } from '${virtualModuleId}';
          import { onRenderClient } from '${virtualRendererId}';
          const { default: render } = await onRenderClient();
          await render({ routes, errorRoute });`
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
        `
      }

      if (id === resolvedVirtualEntryServerId) {
        const normalizedServerEntry = path.join(viteConfigRoot, serverEntry).replaceAll('\\', '/')
        return `import '${virtualSetupId}';
          export * from '${normalizedServerEntry}';
          export { default } from '${normalizedServerEntry}';`
      }
    },
    configureServer(server) {
      // Return a callback to run this middleware as last
      return () => {
        server.middlewares.use(async (req, res, next) => {
          // Handle /api, /*.pageContext.json and pages
          try {
            const ssrEnv = server.environments.ssr as RunnableDevEnvironment

            // Dynamically import the server app to ensure it uses the latest dev code
            // Migrated from server.ssrLoadModule with the new Environment Module Runner API
            const { default: app } = await ssrEnv.runner.import(resolvedVirtualEntryServerId) as { default: { fetch: typeof fetch } }

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
