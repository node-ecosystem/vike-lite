import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { loadEnv, type Plugin, type RunnableDevEnvironment } from 'vite'

import { generateRoutes } from '../utils/generateRoutes'
import { injectFOUCStyles } from '../utils/injectFOUCStyles'
import { SUPPORTED_RENDERERS } from '../config'
import { escapeRegex } from '../shared'
import { extractPkgName, getProjectDependencies, printDependencyReport, type BundleReports, type DepUsage, type ProjectDependencies } from './analizeDependencies'

const bundleReports: BundleReports = {}
let projectDependencies: ProjectDependencies | null | undefined

export default function vikeLite({
  pagesDir = 'pages',
  apiPrefix = '/api',
  prerender = false,
  serverEntry,
  analizeDependencies = false
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
  /**
   * Whether to print, at the end of the production build, a table cross-referencing
   * every package.json dependency (dependencies/devDependencies/peerDependencies)
   * with whether it was actually bundled/externalized by the client and/or server
   * build, plus a suggested fix when something looks misplaced or unused (e.g. a
   * devDependency required at runtime, which would break `npm ci --omit=dev`).
   * Useful to audit bundle composition and catch production-breaking dependency
   * mistakes, but adds console output on every production build, so it's disabled
   * by default.
   * @default false
   */
  analizeDependencies?: boolean
} = {}): Plugin {
  const isProd = process.env.NODE_ENV === 'production'
  const { BUILD_TARGET } = process.env // 'client' | 'server' | undefined
  let viteConfigRoot: string
  let outDir: string
  let hasAnyPrerender: boolean
  let baseUrl: string
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
      const rawBase = config.base || '/'
      baseUrl = rawBase === '/' ? '' : (rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase)

      // Inject environment variables from .env files in process.env
      const envDir = config.envDir || process.cwd()
      const envVariables = loadEnv(mode, envDir, '')
      for (const key in envVariables) if (process.env[key] === undefined) process.env[key] = envVariables[key]

      outDir = config.build?.outDir ?? 'dist'
      const { emptyOutDir, minify = true, cssMinify = true, sourcemap } = config.build || {}
      viteConfigRoot = config.root ? path.resolve(config.root) : process.cwd()

      if (isProd && analizeDependencies && !BUILD_TARGET && !projectDependencies)
        projectDependencies = getProjectDependencies(viteConfigRoot)

      const { routes } = generateRoutes(viteConfigRoot, pagesDir)
      hasAnyPrerender = prerender || routes.some(r => r.prerender)
      const serverInput: Record<string, string> = { index: VIRTUAL.entryServer }
      if (hasAnyPrerender) serverInput.prerender = VIRTUAL.entryPrerender
      // Escape once; pagesDir is a stable plugin option, no need to recompute per-module
      const escapedPagesDir = escapeRegex(pagesDir)
      const pagesDirRegex = new RegExp(String.raw`[\\/]${escapedPagesDir}[\\/]([^\\/]+)[\\/]`)
      const pagesDirTest = new RegExp(String.raw`[\\/]${escapedPagesDir}[\\/]`)

      return {
        // Fix white page issue: Disable Vite's internal HTML middleware
        appType: 'custom',
        // Build Client + SSR environments
        builder: {
          async buildApp(builder) {
            if (!BUILD_TARGET) {
              // client must finish (and flush its manifest to disk) before ssr starts,
              // since the ssr build's virtual:vike-lite/client-manifest load() reads
              // dist/client/.vite/manifest.json from disk.
              await builder.build(builder.environments.client)
              await builder.build(builder.environments.ssr)
            } else if (BUILD_TARGET === 'client') await builder.build(builder.environments.client)
            else if (BUILD_TARGET === 'server') await builder.build(builder.environments.ssr)
            else throw new Error(`Invalid BUILD_TARGET: "${BUILD_TARGET}". Expected 'client' or 'server'.`)
          }
        },
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
                      // modules (\0virtual:vike-lite/setup, \0virtual:vike-lite/client, \0virtual:vike-lite/server) —
                      // never its entry points (\0virtual:vike-lite/entry-client, \0virtual:vike-lite/entry-server,
                      // \0virtual:vike-lite/entry-prerender) or data modules (\0virtual:vike-lite/routes,
                      // \0virtual:vike-lite/client-manifest).
                      // Those are prefixed with \0 by Vite/Rollup and wouldn't otherwise be bounded by path
                      // separators like real file paths, so the alternative is anchored with ^...$ to avoid
                      // accidentally absorbing the entry chunk into this group (which would break isEntry
                      // detection in the manifest and crash getVirtualEntryClientKey() in production).
                      {
                        name: 'framework',
                        test: /[\\/]vike-lite(?:-\w+)?[\\/]|[\\/](?:solid-js|vue|@vue|react|react-dom)[\\/]|^\0virtual:vike-lite\/(setup|client|server)$/,
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
                          const match = moduleId.match(pagesDirRegex)
                          return match ? `page-${match[1]}` : 'shared'
                        },
                        test: pagesDirTest,
                        priority: 10
                      },
                      // CSS: a dedicated chunk per page/module, instead of grouping it
                      // with the JS — prevents a style change from invalidating unrelated JS chunks
                      {
                        name(moduleId) {
                          const match = moduleId.match(pagesDirRegex)
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
                input: serverInput,
                output: {
                  format: 'esm',
                  entryFileNames: '[name].mjs',
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
        plugin => plugin.name?.startsWith('vike-lite-') && (SUPPORTED_RENDERERS as readonly string[]).includes(plugin.name.replace('vike-lite-', ''))
      )
      if (!hasUIRenderer) {
        throw new Error(`❌ No UI adapter plugin found in 'vite.config': please install and configure one of ${SUPPORTED_RENDERERS.map(r => `vike-lite-${r}`).join(', ')}`)
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
          if (r.data?.length) code += `data:${JSON.stringify(r.data)},`
          if (r.title) code += `title:'${r.title}',`
          if (r.prerender) code += `prerender:'${r.prerender}',`
          if (isSSR) {
            if (r.data?.length) code += `Data:[${r.data.map(d => `()=>import('/${d}')`).join(',')}],`
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
          + `await onRenderClient({routes,errorRoute});`
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
          const extensions = ['', '.ts', '.js', '.mjs']
          let serverEntryPath = ''
          for (const ext of extensions) {
            const fullPath = basePath + ext
            if (fs.existsSync(fullPath)) {
              serverEntryPath = fullPath
              break
            }
          }
          if (!serverEntryPath) throw new Error(`❌ serverEntry ${serverEntry} file not found`)
          serverEntryPath = serverEntryPath.replaceAll('\\', '/')
          return importSetup
            + `export*from'${serverEntryPath}';`
            + `export{default}from'${serverEntryPath}';`
        }
        if (serverEntry === false)
          return importSetup
            + `import{renderPage}from'vike-lite/server';`
            + `export default{fetch:renderPage};`
        const defaultServerEntryContent = isProd
          ? fs.readFileSync(path.resolve('vike-lite/__internal/vite/defaultServerEntry.mjs'), 'utf8')
          : `import{renderPage}from'vike-lite/server';`
        return importSetup + defaultServerEntryContent + 'export default{fetch:renderPage};'
      }

      if (id === RESOLVED.entryPrerender)
        return importSetup
          + `export{routes}from'${VIRTUAL.routes}';`
          + `export{renderPage}from'vike-lite/server';`
    },
    // Runs once per environment build (client / ssr), right after Rolldown
    // has produced the final chunk graph but before writeBundle.
    generateBundle(_options, bundle) {
      if (!analizeDependencies) return
      if (BUILD_TARGET) {
        console.warn(`⚠️ Skipping "analizeDependencies" because it can start only with full build ("vite build" without BUILD_TARGET environment variable), current build is "${BUILD_TARGET}"`)
        return
      }
      if (!projectDependencies) {
        console.warn(`⚠️ Skipping "analizeDependencies" because no dependencies found`)
        return
      }

      const deps = projectDependencies // narrow to non-null for the closure below
      // Per-environment view, used for the printed table below
      const usedDeps = new Map<string, DepUsage>()

      function recordUsage(pkg: string | undefined, patch: Partial<{ isBundled: boolean, isExternal: boolean }>) {
        if (!pkg || pkg.startsWith('vike-lite') || !Object.hasOwn(deps, pkg)) return
        const entry = usedDeps.get(pkg) ?? { ...deps[pkg], isBundled: false, isExternal: false }
        Object.assign(entry, patch)
        usedDeps.set(pkg, entry)
      }

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        // 1. Bundled dependencies: actual modules folded into this chunk
        for (const id of chunk.moduleIds) recordUsage(extractPkgName(id)!, { isBundled: true })
      }

      // 2. Externalized dependencies: chunk.imports/dynamicImports on an OutputChunk
      // are the *file names* of other emitted chunks in THIS bundle (internal graph
      // edges, for modulepreload) — they never contain bare specifiers like "react".
      for (const id of this.getModuleIds()) {
        // Rollup/Rolldown still tracks every module it resolved, including ones marked
        // `external` (and thus never placed in any chunk), via getModuleInfo().
        // Unlike Rollup, rolldown's `ModuleInfo` has no `isExternal` flag — but `code`
        // is documented as "null if external or not yet available", and by the time
        // generateBundle runs every module has already been resolved/loaded, so a
        // null `code` reliably means the module was externalized.
        const info = this.getModuleInfo(id)
        if (info?.code === null) recordUsage(extractPkgName(id)!, { isExternal: true })
      }

      const envName = this.environment.name as 'client' | 'ssr'
      bundleReports[envName] = usedDeps
    },
    // closeBundle runs completely last in Vite's lifecycle, meaning that anything 
    // printed here will appear nicely at the bottom of the console (after Vite's 
    // chunk sizes and gzip logs).
    closeBundle: {
      // Ensures this runs BEFORE other plugins' closeBundle hooks —
      // in particular, standalone/single-file bundling plugins that inline dist/server/index.mjs
      // and then delete the shared chunks directory. Since dist/server/prerender.mjs is a
      // separate entry that still imports from those shared chunks, if it were deleted first
      // the dynamic import() below would fail with ERR_MODULE_NOT_FOUND.
      order: 'pre',
      async handler() {
        if (!isProd || this.environment.name !== 'ssr') return

        // --- 1. Run SSG ---
        if (hasAnyPrerender) {
          const { pathToFileURL } = await import('node:url')
          const prerenderPath = path.join(viteConfigRoot, outDir, 'server/prerender.mjs')

          // Import the built server module — this triggers setVikeState() as side-effect,
          // which is required for renderPage to know about routes/config
          const { routes, renderPage } = await import(pathToFileURL(prerenderPath).href) as {
            routes: typeof import('virtual:vike-lite/routes').routes
            renderPage: typeof import('vike-lite/server').renderPage
          }

          // prerender.mjs only exists to let us run SSG here at build time — the running
          // server never imports it (it uses server/index.mjs). Once Node has loaded it
          // into memory above, the file on disk has done its job, so remove it from the
          // shipped output. Best-effort: a leftover file here isn't harmful, just noise.
          try { fs.unlinkSync(prerenderPath) } catch { }

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
                console.warn(`⚠️ Skipping dynamic route ${route.path}: no URLs provided by +prerender. Return an array of URLs to prerender it.`)
                continue
              }
              // Skip dynamic routes without explicit URLs (they need +prerender.ts returning URLs)
              if (!route.path.includes(':')) {
                urlsToPrerender.add(route.path)
              }
              for (const url of dynamicUrls) urlsToPrerender.add(url)
            }
          }

          if (urlsToPrerender.size === 0) {
            console.warn('⚠️ No static routes to generate: if you don\'t want to use SSG, in the \'vite.config\' set the "prerender" option as "false" or remove it.')
          } else {
            console.log('📦 Starting Static Site Generation (SSG)…')

            const clientDir = path.join(viteConfigRoot, outDir, 'client')

            // Simulate requests and save HTML/JSON
            for (const urlPath of urlsToPrerender) {
              const htmlReq = new Request(`http://localhost${baseUrl}${urlPath}`)
              const htmlRes = await renderPage(htmlReq)
              if (htmlRes.ok && htmlRes.headers.get('content-type')?.includes('text/html')) {
                const outDirRoute = path.join(clientDir, urlPath === '/' ? '' : urlPath)
                fs.mkdirSync(outDirRoute, { recursive: true })
                fs.writeFileSync(path.join(outDirRoute, 'index.html'), await htmlRes.text())
              } else throw new Error(`❌ SSG HTML Error for "${urlPath}"`)

              const jsonTarget = urlPath === '/' ? '/index' : urlPath
              const jsonReq = new Request(`http://localhost${baseUrl}${jsonTarget}.pageContext.json`)
              const jsonRes = await renderPage(jsonReq)
              if (jsonRes.ok) {
                const jsonOutPath = path.join(clientDir, `${jsonTarget}.pageContext.json`)
                fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true })
                fs.writeFileSync(jsonOutPath, await jsonRes.text())
              } else throw new Error(`❌ SSG JSON Error for "${jsonTarget}"`)

              console.log(`   → route ${urlPath}`)
            }
            console.log(`✨ SSG Completed! Generated ${urlsToPrerender.size} static routes`)
          }
        }

        if (analizeDependencies && projectDependencies) printDependencyReport(bundleReports, projectDependencies)
      }
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

            // The body must be passed for all POST/PUT requests, not just for the APIs!
            // Otherwise, forms submitted in SSR will not work.
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              requestInit.body = Readable.toWeb(req) as BodyInit
              // @ts-expect-error Property 'duplex' does not exist on type 'RequestInit'
              requestInit.duplex = 'half'
            }

            if (req.url!.startsWith(apiPrefix)) server.config.logger.info(`⚡ API: ${req.method} ${req.url}`, { timestamp: true })
            else if (req.url!.endsWith('.pageContext.json')) server.config.logger.info(`🔄 SPA Navigation: ${req.url}`, { timestamp: true })

            const host = req.headers.host || 'localhost'
            const response = await app.fetch(new Request(`http://${host}${req.url}`, requestInit))

            res.statusCode = response.status
            // Handle multiple Set-Cookie
            for (const [key, value] of response.headers) if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value)
            const cookies = response.headers.getSetCookie()
            if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)  // Node accepts an array of strings for cookies

            async function safeCancelBody(body: ReadableStream<Uint8Array> | null | undefined) {
              if (!body || body.locked) return
              try {
                await body.cancel()
              } catch {
                // The underlying stream may already be locked/cancelled
                // internally (e.g. by the SSR renderer's own abort handling) when the
                // client disconnects mid-stream. Nothing more to clean up here.
              }
            }

            // Handle HTML Streaming in Vite DEV server
            if (response.headers.get('content-type')?.includes('text/html')) {
              res.removeHeader('content-length')
              server.config.logger.info(`📄 Page: ${req.url}`, { timestamp: true })

              if (req.method === 'HEAD' || !response.body) {
                await safeCancelBody(response.body)
                return res.end()
              }
              if (res.destroyed || res.closed) {
                await safeCancelBody(response.body)
                return
              }

              let headBuffered = ''
              let headInjected = false
              const decoder = new TextDecoder()
              const encoder = new TextEncoder()

              const transform = new TransformStream<Uint8Array, Uint8Array>({
                async transform(chunk, controller) {
                  // If HMR and styles have already been injected, let the chunks pass through (real streaming)
                  if (headInjected) {
                    controller.enqueue(chunk)
                    return
                  }

                  headBuffered += decoder.decode(chunk, { stream: true })
                  // Wait for the closing of the head to pass the first half of the document to Vite
                  // NOTE: this relies on renderHtmlShellStream() emitting the entire "start"
                  // shell (head + body-open) as a single enqueue() call, so it always arrives
                  // here as one atomic chunk containing both </head> and <body>. If that
                  // invariant changes, the 8192-byte fallback below becomes load-bearing.
                  if (headBuffered.includes('</head>') || headBuffered.includes('<body') || headBuffered.length > 8192) {
                    headInjected = true
                    // Fix FOUC: Inspect the Module Graph populated earlier,
                    // extract the raw styles via ClientEnv and inject them
                    let html = await injectFOUCStyles(server, headBuffered)
                    // Vite injects CSS styles and client scripts
                    html = await server.transformIndexHtml(req.url!, html)
                    controller.enqueue(encoder.encode(html))
                  }
                },
                async flush(controller) {
                  // If the document ends before injecting (e.g., early error or very short page)
                  if (!headInjected) {
                    headBuffered += decoder.decode()
                    // Fix FOUC: Inspect the Module Graph populated earlier,
                    // extract the raw styles via ClientEnv and inject them
                    let html = await injectFOUCStyles(server, headBuffered)
                    // Vite injects CSS styles and client scripts
                    html = await server.transformIndexHtml(req.url!, html)
                    controller.enqueue(encoder.encode(html))
                  }
                }
              })

              try {
                await pipeline(Readable.fromWeb(response.body.pipeThrough(transform) as import('node:stream/web').ReadableStream<Uint8Array>), res)
              } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err
              }
              return
            }

            // Non-HTML responses (e.g. /api and /*.pageContext.json)
            if (req.method === 'HEAD' || !response.body) {
              await safeCancelBody(response.body)
              if (!res.destroyed && !res.closed) res.end()
              return
            }
            if (res.destroyed || res.closed) {
              await safeCancelBody(response.body)
              return
            }
            try {
              await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>), res)
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err
            }
          } catch (error) {
            next(error)
          }
        })
      }
    }
  }
}
