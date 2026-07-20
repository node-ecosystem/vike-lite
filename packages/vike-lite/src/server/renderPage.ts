import type { PageContextServer } from '..'
import { BASE_URL, matchRoute, stripBase } from '../__internal/shared'
import { serializeContext } from '../utils/serializeContext'
import { AbortRedirect, AbortRender } from './abort'
import { store } from './store'

const isProd = process.env.NODE_ENV === 'production'

// return `/${string}` | `${string}/${string}`
function withBase(file: string): string {
  const cleanBase = BASE_URL === '' ? '' : BASE_URL
  const cleanFile = file.startsWith('/') ? file : `/${file}`
  return `${cleanBase}${cleanFile}`
}

// 2D Map: Route -> Nonce -> Assets
// WeakMap avoids memory leaks if the routes array changes
const assetsCache = new WeakMap<typeof store.routes[number], ReturnType<typeof computeAssetFiles>>()

function computeAssetFiles(route: typeof store.routes[number]) {
  const cssFiles = new Set<string>()
  const jsFiles = new Map<string, boolean>()
  const { manifest } = store

  function getVirtualEntryClientKey() {
    for (const key in manifest!) if (manifest[key].isEntry) return key
    throw new Error('entry-client not found in manifest')
  }

  function collectAssets(key: string, isCritical: boolean) {
    const chunk = manifest![key]
    if (!chunk) return
    const current = jsFiles.get(chunk.file)
    // Skip cases
    if (current === true) return  // Already critical: no upgrade needed
    if (current === false && !isCritical) return  // Already shared AND new call is also shared: no change
    // Otherwise: either first time seeing this file, OR upgrading shared→critical
    jsFiles.set(chunk.file, isCritical)
    if (chunk.css) for (const css of chunk.css) cssFiles.add(css)
    // Transitive imports are always shared (they are cross-cutting dependencies)
    // (vendor/framework/other pages), likely already in cache after
    // the first navigation. No dependency on chunk names.
    if (chunk.imports) for (const imp of chunk.imports) collectAssets(imp, false)
  }

  const virtualEntryClientKey = getVirtualEntryClientKey()
  collectAssets(virtualEntryClientKey, true)

  const { page, layout, head } = route
  collectAssets(page, true)
  if (head) collectAssets(head, true)
  if (layout) collectAssets(layout, true)

  const criticalJs: string[] = []
  const sharedJs: string[] = []
  for (const [file, isCritical] of jsFiles) {
    (isCritical ? criticalJs : sharedJs).push(file)
  }

  return {
    cssFiles: [...cssFiles],
    criticalJs,
    sharedJs,
    entryClientFile: manifest![virtualEntryClientKey].file
  }
}

function getAssets(route: typeof store.routes[number], nonce?: string) {
  if (!isProd) {
    return {
      cssLinks: '',
      jsPreloads: '',
      entryClient: withBase('@id/virtual:vike-lite/entry-client')
    }
  }

  // Cache hit/miss ONLY file names — never the nonce
  let files = assetsCache.get(route)
  if (!files) {
    files = computeAssetFiles(route)!
    assetsCache.set(route, files)
  }
  // nonce is injected in the HTML tags on every request, so it can be different for each request — never cached
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''
  return {
    cssLinks: files.cssFiles.map(href => `<link rel="stylesheet" href="${withBase(href)}"${nonceAttr}>`).join(''),
    jsPreloads: [
      ...files.criticalJs.map(href => `<link rel="modulepreload" href="${withBase(href)}" crossorigin fetchpriority="high"${nonceAttr}>`),
      ...files.sharedJs.map(href => `<link rel="modulepreload" href="${withBase(href)}" crossorigin${nonceAttr}>`)
    ].join(''),
    entryClient: withBase(files.entryClientFile)
  }
}

async function buildPageContext(urlPathname: string, urlOriginal: string, isJsonRequest: boolean) {
  const matched = matchRoute(urlPathname, store.routes)
  if (!matched) return null

  const { route, routeParams } = matched
  const pageContext = { routeParams, urlOriginal, urlPathname, isClientSide: false } as PageContextServer

  const [dataMod, titleMod, PageModule, HeadModule, LayoutModule] = await Promise.all([
    route.Data?.() ?? null,
    route.Title?.() ?? null,
    isJsonRequest ? null : route.Page(),
    isJsonRequest ? null : route.Head?.() ?? null,
    isJsonRequest ? null : route.Layout?.() ?? null
  ])

  if (dataMod) {
    try {
      const dataFn = (dataMod.data ?? dataMod.default)!
      pageContext.data = await dataFn(pageContext)
    } catch (error) {
      if (!(error instanceof AbortRedirect || error instanceof AbortRender))
        console.error('+data hook failed at:', urlPathname)
      throw error
    }
  }

  if (titleMod) {
    try {
      const titleFn = titleMod.title ?? titleMod.default
      pageContext.title = typeof titleFn === 'function' ? titleFn(pageContext) : titleFn
    } catch (error) {
      if (!(error instanceof AbortRedirect || error instanceof AbortRender))
        console.error('+title hook failed at:', urlPathname)
      throw error
    }
  }

  return { pageContext, route, PageModule, HeadModule, LayoutModule }
}

async function renderErrorPage(
  req: Request,
  status: number,
  urlPathname: string,
  error?: unknown,
  nonce?: string
): Promise<Response> {
  let errorMessage
  let is500
  if (status === 500) {
    errorMessage = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Unknown error')
    is500 = true
  } else is500 = false

  const fallbackText = status === 404 ? 'Not Found' : 'Internal Server Error'

  if (!store.errorRoute)
    return new Response(fallbackText, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  try {
    const [PageModule, HeadModule, LayoutModule] = await Promise.all([
      store.errorRoute.Page(),
      store.errorRoute.Head?.() ?? null,
      store.errorRoute.Layout?.() ?? null
    ])

    const pageContext = {
      urlOriginal: req.url,
      urlPathname,
      routeParams: {},
      is404: status === 404,
      is500,
      errorMessage,
      isClientSide: false
    } as PageContextServer

    const html = await store.config!.onRenderHtml({
      pageContext,
      Page: (PageModule.Page ?? PageModule.default)!,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      pageTitleTag: `<title>${status === 404 ? 'Page Not Found' : 'Server Error'}</title>`,
      serializedContext: serializeContext(pageContext),
      assets: getAssets(store.errorRoute, nonce),
      nonce
    })

    return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (renderError) {
    console.error('[vike-lite] Error page render failed:', renderError)
    return new Response(fallbackText, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

export async function renderPage(
  req: Request,
  // Accepts additional keys because platforms like Vercel inject a default `context` object
  // (e.g. { params: ... }) when you export GET/POST.
  { nonce }: {
    nonce?: string
    [key: string]: unknown
  } = {}
): Promise<Response> {
  let { pathname } = new URL(req.url)

  pathname = stripBase(pathname)

  const isJsonRequest = pathname.endsWith('.pageContext.json')

  let targetPathname = pathname
  if (isJsonRequest) {
    targetPathname = targetPathname.replace(/\.pageContext\.json$/, '')
    if (targetPathname === '/index') targetPathname = '/'
  }

  try {
    const resolved = await buildPageContext(targetPathname, req.url, isJsonRequest)

    if (!resolved) {
      if (isJsonRequest) return Response.json({ is404: true }, { status: 404 })
      return renderErrorPage(req, 404, targetPathname, nonce)
    }

    const { pageContext, route, PageModule, HeadModule, LayoutModule } = resolved

    if (isJsonRequest) return Response.json(pageContext)

    const html = await store.config!.onRenderHtml({
      pageContext,
      Page: (PageModule!.Page ?? PageModule!.default)!,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      pageTitleTag: pageContext.title ? `<title>${pageContext.title}</title>` : '',
      serializedContext: serializeContext(pageContext),
      assets: getAssets(route, nonce),
      nonce
    })

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error) {
    if (error instanceof AbortRedirect) {
      // Add the base path if the URL is internal
      let redirectUrl = error.url
      if (redirectUrl.startsWith('/')) redirectUrl = BASE_URL + (redirectUrl === '/' ? '' : redirectUrl)

      // If the user is navigating in SPA mode, tell the Solid router to redirect
      if (isJsonRequest) {
        return Response.json({ _redirect: redirectUrl }, { status: 200 })
      }

      // If it's the first load or SSR, use the native HTTP redirect
      return new Response(null, { status: error.statusCode, headers: { Location: redirectUrl } })
    }

    if (error instanceof AbortRender) {
      if (isJsonRequest) {
        // If the user is navigating in SPA mode and the +data.ts does "throw render(404)"
        return Response.json(
          {
            is404: error.statusCode === 404,
            is500: error.statusCode >= 500,
            isError: true,
            reason: error.reason
          },
          { status: error.statusCode }
        )
      }
      // First load, render the error UI (with layout and styles)
      return renderErrorPage(req, error.statusCode, targetPathname, error.reason, nonce)
    }

    console.error('Render Error:', error)
    if (isJsonRequest) return Response.json({ is500: true }, { status: 500 })
    return renderErrorPage(req, 500, targetPathname, error, nonce)
  }
}
