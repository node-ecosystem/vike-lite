import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { loadEnv, type Plugin, type RunnableDevEnvironment } from 'vite'

import { generateRoutes } from '../utils/generateRoutes'
import { injectFOUCStyles } from '../utils/injectFOUCStyles'
import { SUPPORTED_RENDERERS } from '../config'
import { renderPage } from '../server'

export default function vikeLite({
  pagesDir = 'pages',
  apiPrefix = '/api',
  prerender = false,
  serverEntry
}: {
  /**
   * The directory where your page components are located.
   * This is where the plugin will look for your page files to generate routes.
   * @default 'pages'
   */
  pagesDir?: string
  /**
   * The prefix for your API routes.
   * @default '/api'
   */
  apiPrefix?: string
  /**
   * Whether to prerender the pages by default.
   * Individual pages can override this via +prerender.ts.
   * @default false
   */
  prerender?: boolean
  /**
   * The entry point for your server application code.
   * This is where you can define custom server logic, such as API routes or middleware.
   * The build will produce dist/server/index.mjs, which is the entry point for your server application.
   * If false disable the server entry.
   * @default undefined
  */
  serverEntry?: string | false
} = {}): Plugin {
  const isProd = process.env.NODE_ENV === 'production'
  let viteConfigRoot: string
  let outDir: string
  let hasAnyPrerender: boolean

  const VIRTUAL = {
    routes: 'virtual:vike-lite/routes',
    manifest: 'virtual:vike-lite/client-manifest',
    client: 'virtual:vike-lite/client',
    server: 'virtual:vike-lite/server',
    setup: 'virtual:vike-lite/setup',
    entryClient: 'virtual:vike-lite/entry-client',
    entryServer: 'virtual:vike-lite/entry-server',
    entryPrerender: 'virtual:vike-lite/entry-prerender'
  } as const
  const VIRTUAL_VALUES = new Set<string>(Object.values(VIRTUAL))
  const RESOLVED = Object.fromEntries(Object.entries(VIRTUAL).map(([k, v]) => [k, `\0${v}`])) as { [K in keyof typeof VIRTUAL]: `\0${typeof VIRTUAL[K]}` }
  const importSetup = `import'${VIRTUAL.setup}';`
  return {
    name: 'vike-lite',
    config(config, { mode }) {
      // Inject environment variables from .env files in process.env
      const envDir = config.envDir || process.cwd()
      const envVariables = loadEnv(mode, envDir, '')
      for (const key in envVariables) if (process.env[key] === undefined) process.env[key] = envVariables[key]

      outDir = config.build?.outDir ?? 'dist'
      const { emptyOutDir, minify = true, cssMinify = true, sourcemap } = config.build || {}
      viteConfigRoot = (config.root ? path.resolve(config.root) : process.cwd()).replaceAll('\\', '/')
      const { routes } = generateRoutes(viteConfigRoot, pagesDir)
      hasAnyPrerender = prerender || routes.some(r => r.prerender)

      return {
        // Fix white page issue: Disable Vite's internal HTML middleware
        appType: 'custom',
        ssr: {
          // Solution to https://github.com/vikejs/vike/issues/3070
          noExternal: [/^vike-lite(?:$|-)/]
        },
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
                input: VIRTUAL.entryClient,
                output: {
                  format: 'esm',
                  // Prevents the entry chunk from bloating with all transitive imports
                  hoistTransitiveImports: false,
                  // Entry point virtual:vike-lite/entry-client
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
                  assetFileNames: 'assets/static/[name].[hash][extname]',
                  codeSplitting: {
                    groups: [
                      // Framework: vike-lite + UI framework packages (solid-js, vue, react/react-dom) —
                      // changes rarely, very long cache.
                      // The 3rd alternative matches ONLY vike-lite's internal bootstrap/bridge virtual
                      // modules (\0virtual:vike-lite/setup, \0virtual:vike-lite/renderer) — never its
                      // entry points (\0virtual:vike-lite/entry-client, \0virtual:vike-lite/entry-server,
                      // \0virtual:vike-lite/entry-prerender) or data modules (\0virtual:vike-lite/routes,
                      // \0virtual:vike-lite/client-manifest). Those are prefixed with \0 by Vite/Rollup
                      // and wouldn't otherwise be bounded by path separators like real file paths,
                      // so the alternative is anchored with ^...$ to avoid accidentally absorbing the
                      // entry chunk into this group (which would break isEntry detection in the manifest
                      // and crash getVirtualEntryClientKey() in production).
                      {
                        name: 'framework',
                        test: /[\\/]vike-lite(?:-\w+)?[\\/]|[\\/](?:solid-js|vue|@vue|react|react-dom)[\\/]|^\0virtual:vike-lite\/(setup|renderer)$/,
                        priority: 30
                      },
                      // Vendor: rest of the dependencies — separate from the framework
                      // minSize prevents micro-chunks for tiny dependencies
                      // Uses a function (instead of a plain regex) to also support Yarn PnP:
                      // - node_modules / .yarn (cache, unplugged, __virtual__) cover the vast majority of cases
                      // - the fallback catches anything resolved outside the project root (e.g. workspace/portal-linked
                      //   packages, or a global Yarn/pnpm store) that wouldn't match the path-based checks above
                      {
                        name: 'vendor',
                        test(moduleId) {
                          if (/[\\/](node_modules|\.yarn)[\\/]/.test(moduleId)) return true
                          return !moduleId.startsWith('\0') && !moduleId.startsWith(viteConfigRoot)
                        },
                        priority: 20,
                        minSize: 20_000
                      },
                      // A page = a dedicated chunk, consistent with vike-lite lazy-loading
                      {
                        name(moduleId) {
                          const match = moduleId.match(new RegExp(String.raw`[\\/]${pagesDir}[\\/]([^\\/]+)[\\/]`))
                          return match ? `page-${match[1]}` : 'shared'
                        },
                        test: new RegExp(String.raw`[\\/]${pagesDir}[\\/]`),
                        priority: 10
                      },
                      // CSS: a dedicated chunk per page/module, instead of grouping it
                      // with the JS — prevents a style change from invalidating unrelated JS chunks
                      {
                        name(moduleId) {
                          const match = moduleId.match(new RegExp(String.raw`[\\/]${pagesDir}[\\/]([^\\/]+)[\\/]`))
                          return match ? `css-${match[1]}` : 'css-shared'
                        },
                        test: /\.css$/,
                        priority: 5
                      }
                    ]
                  }
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
                input: hasAnyPrerender
                  ? { index: VIRTUAL.entryServer, prerender: VIRTUAL.entryPrerender }
                  : VIRTUAL.entryServer,
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
      const hasUIRenderer = config.plugins.some(
        plugin => plugin.name?.startsWith('vike-lite-') && SUPPORTED_RENDERERS.includes(plugin.name.replace('vike-lite-', '') as any)
      )
      if (!hasUIRenderer) {
        throw new Error(`[vike-lite] No UI renderer plugin found in 'vite.config': please install and configure one of ${SUPPORTED_RENDERERS.map(r => `vike-lite-${r}`).join(', ')}`)
      }
    },
    resolveId(id) {
      if (VIRTUAL_VALUES.has(id)) return '\0' + id
    },
    async load(id, options) {
      // Generate the virtual routes module
      if (id === RESOLVED.routes) {
        const { routes, errorRoute } = generateRoutes(viteConfigRoot, pagesDir)
        const isSSR = options!.ssr

        // Import the server rendering function from the bridge virtual module
        let code = `import{onRenderHtml}from'${VIRTUAL.server}';`
          // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation
          + `export const config={onRenderHtml};`
          + `export const routes=[`

        for (const r of routes) {
          code += `{path:'${r.path}',page:'${r.page}',Page:()=>import('/${r.page}'),`
          if (r.head) code += `head:'${r.head}',Head:()=>import('/${r.head}'),`
          if (r.layout) code += `layout:'${r.layout}',Layout:()=>import('/${r.layout}'),`
          if (r.data) code += `data:'${r.data}',`
          if (r.title) code += `title:'${r.title}',`
          if (r.prerender) code += `prerender:'${r.prerender}',`
          if (isSSR) {
            if (r.data) code += `Data:()=>import('/${r.data}'),`
            if (r.title) code += `Title:()=>import('/${r.title}'),`
            if (r.prerender) code += `Prerender:()=>import('/${r.prerender}'),`
          }
          code += '},'
        }
        code += '];'
        if (errorRoute) {
          const e = errorRoute
          code += `export const errorRoute={path:'${e.path}',page:'${e.page}',Page:()=>import('/${e.page}'),`
          if (e.layout) code += `layout:'${e.layout}',Layout:()=>import('/${e.layout}'),`
          if (e.head) code += `head:'${e.head}',Head:()=>import('/${e.head}'),`
          code += '};'
        } else {
          code += 'export const errorRoute=null;'
        }
        return code
      }

      // Generate virtual manifest
      if (id === RESOLVED.manifest) {
        const isSSR = options!.ssr
        if (!isProd || !isSSR) return 'export default{}'
        const manifestPath = path.join(viteConfigRoot, outDir, 'client/.vite/manifest.json')
        const manifestContent = fs.readFileSync(manifestPath, 'utf8')
        return `export default ${manifestContent}`
      }

      // Generate virtual entry client
      if (id === RESOLVED.entryClient) {
        // Import the client rendering function from the bridge virtual module
        return `import{routes,errorRoute}from'${VIRTUAL.routes}';`
          + `import{onRenderClient}from'${VIRTUAL.client}';`
          + `await(await onRenderClient()).default({routes,errorRoute});`
      }

      if (id === RESOLVED.setup) {
        const manifestContent = isProd ? `(await import('${VIRTUAL.manifest}')).default` : 'null'
        return `import{routes,errorRoute,config}from'${VIRTUAL.routes}';`
          + `import{setVikeState}from'vike-lite/__internal/server';`
          + `const manifest=${manifestContent};`
          + `setVikeState({routes,errorRoute,config,manifest});`
      }

      if (id === RESOLVED.entryServer) {
        if (serverEntry) {
          const basePath = path.join(viteConfigRoot, serverEntry)
          let serverEntryPath = ''
          if (!fs.existsSync(basePath)) {
            const extensions = ['.ts', '.js', '.mjs']
            for (const ext of extensions) {
              if (fs.existsSync(basePath + ext)) {
                serverEntryPath = (basePath + ext)
                break
              }
            }
            if (!serverEntryPath) throw new Error(`[vike-lite] serverEntry ${serverEntry} file not found`)
          }
          return importSetup
            + `export*from'${serverEntryPath}';`
            + `export{default}from'${serverEntryPath}';`
        }
        if (serverEntry === false)
          return importSetup
            + `import{renderPage}from'vike-lite/server';`
            + `export default{fetch:renderPage};`
        const defaultServerEntryContent = isProd
          ? fs.readFileSync(path.join(viteConfigRoot, 'defaultServerEntry.mjs'), 'utf8')
          : `import{renderPage}from'vike-lite/server';`
        return importSetup + defaultServerEntryContent + 'export default{fetch:renderPage};'
      }

      if (id === RESOLVED.entryPrerender) return importSetup + `export{routes}from'${VIRTUAL.routes}';`
    },
    // Run SSG at end of the build
    async closeBundle() {
      if (!isProd || this.environment.name !== 'ssr') return

      const { pathToFileURL } = await import('node:url')
      const prerenderPath = path.join(viteConfigRoot, outDir, 'server/prerender.mjs')
      if (!fs.existsSync(prerenderPath)) return

      // Import the built server module — this triggers setVikeState() as side-effect,
      // which is required for renderPage to know about routes/config
      const serverModule = await import(pathToFileURL(prerenderPath).href) as { routes?: typeof import('virtual:vike-lite/routes').routes }
      const { routes } = serverModule

      // If routes is not exported, no SSG is needed (nothing to prerender)
      // This is decided at build-time based on: global `prerender` OR any route having +prerender.ts
      if (!routes) return

      // Import renderPage directly, bypassing the user's custom server:
      // this avoids middleware/side-effects (CORS, DB connections, etc.)
      // that shouldn't run during static generation
      const urlsToPrerender = new Set<string>()

      // Determine which URLs to generate by evaluating +prerender.ts files
      for (const route of routes) {
        // Default: use the global plugin option
        let shouldPrerender = prerender
        let dynamicUrls: string[] = []

        // Per-route override: +prerender always takes priority
        if (route.Prerender) {
          const mod = await route.Prerender()
          const prerenderFn = mod.default ?? mod.prerender
          const result = typeof prerenderFn === 'function' ? await prerenderFn() : prerenderFn

          if (result === false) shouldPrerender = false
          else if (result === true) shouldPrerender = true
          else if (Array.isArray(result)) {
            shouldPrerender = true
            dynamicUrls = result
          }
        }

        if (shouldPrerender) {
          if (route.path.includes(':') && dynamicUrls.length === 0) {
            console.warn(`[vike-lite] ⚠️ Skipping dynamic route "${route.path}": no URLs provided by +prerender. Return an array of URLs to prerender it.`)
            continue
          }
          // Skip dynamic routes without explicit URLs (they need +prerender.ts returning URLs)
          if (!route.path.includes(':')) {
            urlsToPrerender.add(route.path)
          }
          for (const url of dynamicUrls) urlsToPrerender.add(url)
        }
      }

      if (urlsToPrerender.size === 0) return

      console.log('[vike-lite] 📦 Starting Static Site Generation (SSG)…')

      const { BASE_URL } = import.meta.env
      const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
      let generatedCount = 0

      const clientDir = path.join(viteConfigRoot, outDir, 'client')

      // Simulate requests and save HTML/JSON
      for (const urlPath of urlsToPrerender) {
        // Generate HTML
        const htmlReq = new Request(`http://localhost${baseNoSlash}${urlPath}`)
        const htmlRes = await renderPage(htmlReq)
        if (htmlRes?.ok && htmlRes.headers.get('content-type')?.includes('text/html')) {
          const outDirRoute = path.join(clientDir, urlPath === '/' ? '' : urlPath)
          fs.mkdirSync(outDirRoute, { recursive: true })
          fs.writeFileSync(path.join(outDirRoute, 'index.html'), await htmlRes.text())
        } else throw new Error(`[vike-lite] ❌ SSG HTML Error for "${urlPath}"`)

        // Generate JSON (Context)
        const jsonTarget = urlPath === '/' ? '/index' : urlPath
        const jsonReq = new Request(`http://localhost${baseNoSlash}${jsonTarget}.pageContext.json`)
        const jsonRes = await renderPage(jsonReq)
        if (jsonRes?.ok) {
          const jsonOutPath = path.join(clientDir, `${jsonTarget}.pageContext.json`)
          fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true })
          fs.writeFileSync(jsonOutPath, await jsonRes.text())
        } else throw new Error(`[vike-lite] ❌ SSG JSON Error for "${jsonTarget}"`)

        console.log(`  → ${urlPath}`)
        generatedCount++
      }
      console.log(`[vike-lite] ✨ SSG Completed! Generated ${generatedCount} static routes`)
    },
    configureServer(server) {
      // Return a callback to run this middleware as last
      return () => {
        const pagesPath = path.join(viteConfigRoot, pagesDir)
        // DEV server watcher to invalidate the virtual module and trigger a full reload when pages are added or removed
        server.watcher.on('all', (event, file) => {
          if (!((event === 'add' || event === 'unlink') && file.startsWith(pagesPath))) return
          for (const env of Object.values(server.environments)) {
            const mod = env.moduleGraph.getModuleById(RESOLVED.routes)
            if (mod) env.moduleGraph.invalidateModule(mod)
          }
          server.ws.send({ type: 'full-reload' })
        })
        // DEV server middleware to handle /api, /*.pageContext.json and pages
        server.middlewares.use(async (req, res, next) => {
          try {
            const ssrEnv = server.environments.ssr as RunnableDevEnvironment

            // Dynamically import the server app to ensure it uses the latest dev code
            // Migrated from server.ssrLoadModule with the new Environment Module Runner API
            const { default: app } = await ssrEnv.runner.import(RESOLVED.entryServer) as { default: { fetch: typeof fetch } }

            const headers = new Headers()
            for (const [key, value] of Object.entries(req.headers)) {
              if (key.startsWith(':')) continue
              if (Array.isArray(value)) for (const v of value) headers.append(key, v)
              else if (value !== undefined) headers.set(key, value)
            }

            const requestInit = { method: req.method, headers } as RequestInit
            if (req.url!.startsWith(apiPrefix)) {
              server.config.logger.info(`⚡ API: ${req.method} ${req.url}`, { timestamp: true })
              requestInit.body = Readable.toWeb(req) as any
              // @ts-expect-error Property 'duplex' does not exist on type 'RequestInit'
              requestInit.duplex = 'half'
            } else if (req.url!.endsWith('.pageContext.json')) {
              server.config.logger.info(`🔄 SPA Navigation: ${req.url}`, { timestamp: true })
            }

            // The frontend code is evaluated and the styles imports are registered internally in the ssrEnv.moduleGraph
            const response = await app.fetch(new Request(`http://${req.headers.host}${req.url}`, requestInit))
            res.statusCode = response.status

            if (response.headers.get('content-type')?.includes('text/html')) {
              server.config.logger.info(`📄 Page: ${req.url}`, { timestamp: true })
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
            if (req.method === 'HEAD' || !response.body) {
              await response.body?.cancel()
              if (!res.destroyed && !res.closed) res.end()
              return
            }
            if (res.destroyed || res.closed) {
              await response.body.cancel()
              return
            }
            try { await pipeline(Readable.fromWeb(response.body as any), res) } catch { }
          } catch (error) {
            next(error)
          }
        })
      }
    }
  }
}
