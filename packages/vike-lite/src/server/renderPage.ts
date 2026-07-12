import type { PageContext } from '..'
import { matchRoute } from '../__internal/shared/matchRoute'
import { serializeContext } from '../utils/serializeContext'
import { AbortRedirect, AbortRender } from './abort'
import { store } from './store'

const isProd = process.env.NODE_ENV === 'production'

// return `/${string}` | `${string}/${string}`
function withBase(file: string): string {
  const { BASE_URL } = import.meta.env
  const cleanBase = BASE_URL === '/' ? '' : (BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL)
  const cleanFile = file.startsWith('/') ? file : `/${file}`
  return `${cleanBase}${cleanFile}`
}

// 2D Map: Route -> Nonce -> Assets
// WeakMap avoids memory leaks if the routes array changes (e.g. in DEV, even though we are in PROD)
const assetsCache = new WeakMap<typeof store.routes[number], Map<string, ReturnType<typeof computeAssets>>>()

function getAssets(route: typeof store.routes[number], nonce?: string) {
  if (!isProd) return computeAssets(route, nonce) // In DEV compute every time
  const nonceKey = nonce || ''
  let routeCache = assetsCache.get(route)
  if (!routeCache) {
    routeCache = new Map()
    assetsCache.set(route, routeCache)
  }
  let assets = routeCache.get(nonceKey)
  if (!assets) {
    assets = computeAssets(route, nonce)
    routeCache.set(nonceKey, assets)
  }
  return assets
}

function computeAssets(route: typeof store.routes[number], nonce?: string) {
  if (!isProd) return {
    cssLinks: '',
    jsPreloads: '',
    entryClient: withBase('@id/virtual:entry-client')
  }

  const cssFiles = new Set<string>()
  // Map file -> isCritical. Allows upgrading shared→critical, but not the other way around.
  const jsFiles = new Map<string, boolean>()
  const { manifest } = store

  function getVirtualEntryClientKey() {
    for (const key in manifest) if (manifest[key].isEntry) return key
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

  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  return {
    cssLinks: [...cssFiles].map(href => `<link rel="stylesheet" href="${withBase(href)}"${nonceAttr}>`).join(''),
    jsPreloads: [
      ...criticalJs.map(href => `<link rel="modulepreload" href="${withBase(href)}" crossorigin fetchpriority="high"${nonceAttr}>`),
      ...sharedJs.map(href => `<link rel="modulepreload" href="${withBase(href)}" crossorigin${nonceAttr}>`)
    ].join(''),
    entryClient: withBase(manifest![virtualEntryClientKey].file)
  }
}

async function buildPageContext(urlPathname: string, urlOriginal: string, isJsonRequest: boolean) {
  const matched = matchRoute(urlPathname, store.routes)
  if (!matched) return null

  const { route, routeParams } = matched
  const pageContext = { routeParams, urlOriginal, urlPathname } as PageContext

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
      console.error('+data hook failed at:', urlPathname)
      throw error
    }
  }

  if (titleMod) {
    try {
      const titleFn = titleMod.title ?? titleMod.default
      pageContext.title = typeof titleFn === 'function' ? titleFn(pageContext) : titleFn
    } catch (error) {
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
    console.error(`[vike-lite] Server Error:`, error)
    errorMessage = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Unknown error')
    is500 = true
  } else is500 = false
  if (!store.errorRoute) return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })

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
      errorMessage
    } as PageContext

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

    return new Response(html, { status, headers: { 'Content-Type': 'text/html' } })
  } catch (renderError) {
    console.error('[vike-lite] Error page render failed:', renderError)
    return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })
  }
}

export async function renderPage(req: Request, { nonce }: { nonce?: string } = {}): Promise<Response> {
  let { pathname } = new URL(req.url)

  // If we have a base path different from '/', we need to remove it from the pathname
  const { BASE_URL } = import.meta.env
  if (BASE_URL !== '/') {
    const baseSlashed = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/'
    const baseNoSlash = baseSlashed.slice(0, -1)

    pathname = (pathname === baseNoSlash)
      // The user visits exactly '/my-app' (without trailing slash)
      ? '/'
      // The user visits '/my-app/about' and '/my-app/' became '/about' and '/'
      : pathname.slice(baseSlashed.length - 1)
  }

  // "pathname" is clean (e.g. "/about")
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

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })

  } catch (error) {
    if (error instanceof AbortRedirect) {
      // Add the base path if the URL is internal
      let redirectUrl = error.url
      if (redirectUrl.startsWith('/')) {
        const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
        redirectUrl = baseNoSlash + (redirectUrl === '/' ? '' : redirectUrl)
      }

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
