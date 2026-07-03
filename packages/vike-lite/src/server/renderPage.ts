import type { PageContext } from '..'
import matchRoute from '../__internal/shared/matchRoute'
import { BASE_URL } from '../shared'
import serializeContext from '../utils/serializeContext'
import { AbortRedirect, AbortRender } from './abort'
import { store } from './store'

const isProd = process.env.NODE_ENV === 'production'

function withBase(file: string): `/${string}` | `${string}/${string}` {
  return `${BASE_URL.replace(/\/$/, '')}/${file.replace(/^\//, '')}`
}

function getAssets(route: typeof import('virtual:routes').routes[number]) {
  if (!isProd) return {
    cssLinks: '',
    jsPreloads: '',
    entryClient: withBase('@id/virtual:entry-client')
  }

  const cssFiles = new Set<string>()
  const jsFiles = new Set<string>()
  const visitedKeys = new Set<string>()
  const { manifest } = store

  function getVirtualEntryClientKey() {
    for (const key in manifest) if (manifest[key].isEntry) return key
    throw new Error('entry-client not found in manifest')
  }

  function collectAssets(key: string) {
    if (visitedKeys.has(key)) return
    visitedKeys.add(key)
    const chunk = manifest![key]
    jsFiles.add(chunk.file)
    if (chunk.css) for (const css of chunk.css) cssFiles.add(css)
    if (chunk.imports) for (const imp of chunk.imports) collectAssets(imp)
  }

  const virtualEntryClientKey = getVirtualEntryClientKey()
  collectAssets(virtualEntryClientKey)

  const { page, layout, head } = route
  collectAssets(page)
  if (head) collectAssets(head)
  if (layout) collectAssets(layout)

  return {
    cssLinks: [...cssFiles].map(href => `<link rel="stylesheet" href="${withBase(href)}">`).join(''),
    jsPreloads: [...jsFiles].map(href => `<link rel="modulepreload" href="${withBase(href)}">`).join(''),
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
  error?: unknown
): Promise<Response> {
  if (!store.errorRoute) return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })

  try {
    const { default: onRenderHtml } = await store.config!.onRenderHtml()

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
      is500: status === 500,
      errorMessage: status === 500 && error instanceof Error ? error.message : undefined
    } as PageContext

    const html = await onRenderHtml({
      pageContext,
      Page: (PageModule.Page ?? PageModule.default)!,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      pageTitleTag: `<title>${status === 404 ? 'Page Not Found' : 'Server Error'}</title>`,
      serializedContext: serializeContext(pageContext),
      assets: getAssets(store.errorRoute)
    })

    return new Response(html, { status, headers: { 'Content-Type': 'text/html' } })
  } catch (renderError) {
    console.error('Error page render failed:', renderError)
    return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })
  }
}

export default async function renderPage(req: Request): Promise<Response> {
  let { pathname } = new URL(req.url)

  // If we have a base path different from '/', we need to remove it from the pathname
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
      return renderErrorPage(req, 404, targetPathname)
    }

    const { pageContext, route, PageModule, HeadModule, LayoutModule } = resolved

    if (isJsonRequest) return Response.json(pageContext)

    const { default: onRenderHtml } = await store.config!.onRenderHtml()

    const html = await onRenderHtml({
      pageContext,
      Page: (PageModule!.Page ?? PageModule!.default)!,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      pageTitleTag: pageContext.title ? `<title>${pageContext.title}</title>` : '',
      serializedContext: serializeContext(pageContext),
      assets: getAssets(route)
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
      return renderErrorPage(req, error.statusCode, targetPathname, error.reason)
    }
    console.error('Render Error:', error)
    if (isJsonRequest) return Response.json({ is500: true }, { status: 500 })
    return renderErrorPage(req, 500, targetPathname, error)
  }
}
