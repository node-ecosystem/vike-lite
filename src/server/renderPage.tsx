import type { Manifest, PageContext } from '..'
import matchRoute from '../shared/matchRoute'
import serializeContext from '../utils/serializeContext'
import { AbortRender } from './abort'
import { store } from './store'

const isProd = process.env.NODE_ENV === 'production'

// DEV: read from virtual module (always updated, HMR-safe)
// PROD: read from the store (populated once by virtual:vike-lite/setup)
async function getVikeState() {
  if (isProd) {
    return {
      routes: store.routes,
      errorRoute: store.errorRoute,
      config: store.config!,
      manifest: store.manifest
    }
  }
  const { routes, errorRoute, config } = await import('virtual:routes')
  return { routes, errorRoute, config, manifest: undefined }
}

function getAssets(pageModuleId: string, manifest: Manifest | undefined) {
  if (!isProd) return {
    cssLinks: '',
    jsPreloads: '',
    entryClient: '/@id/virtual:entry-client'
  }

  const cssFiles = new Set<string>()
  const jsFiles = new Set<string>()

  function getVirtualEntryClientKey() {
    for (const key in manifest) {
      if (manifest[key].isEntry) return key
    }
    throw new Error('entry-client not found in manifest')
  }

  function collectAssets(key: string) {
    const chunk = manifest![key]
    if (!chunk) throw new Error(`Asset not found in manifest for key: ${key}`)
    jsFiles.add(chunk.file)
    if (chunk.css) for (const css of chunk.css) cssFiles.add(css)
    if (chunk.imports) for (const imp of chunk.imports) collectAssets(imp)
  }

  const virtualEntryClientKey = getVirtualEntryClientKey()
  collectAssets(virtualEntryClientKey)
  collectAssets(pageModuleId.replace('@/', ''))

  return {
    cssLinks: [...cssFiles].map(href => `<link rel="stylesheet" href="/${href}">`).join(''),
    jsPreloads: [...jsFiles].map(href => `<link rel="modulepreload" href="/${href}">`).join(''),
    entryClient: '/' + manifest![virtualEntryClientKey].file
  }
}

async function buildPageContext(urlPathname: string, urlOriginal: string, isJsonRequest: boolean) {
  const { routes } = await getVikeState()
  const matched = matchRoute(urlPathname, routes)
  if (!matched) return null

  const { route, routeParams } = matched
  const pageContext = {
    routeParams,
    urlOriginal,
    urlPathname,
  } as PageContext

  const [dataMod, titleMod, PageModule, HeadModule, LayoutModule] = await Promise.all([
    route.data?.() ?? null,
    route.title?.() ?? null,
    isJsonRequest ? null : route.Page(),
    isJsonRequest ? null : route.Head?.() ?? null,
    isJsonRequest ? null : route.Layout?.() ?? null
  ])

  if (dataMod) {
    try {
      const dataFn = dataMod.data ?? dataMod.default
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
  status: 404 | 500,
  originalPathname: string,
  error?: unknown
): Promise<Response> {
  const { errorRoute, config, manifest } = await getVikeState()

  if (!errorRoute) return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })

  try {
    const { default: onRenderHtml } = await config.onRenderHtml()

    const [PageModule, HeadModule, LayoutModule] = await Promise.all([
      errorRoute.Page(),
      errorRoute.Head?.() ?? null,
      errorRoute.Layout?.() ?? null
    ])

    const pageContext = {
      urlOriginal: req.url,
      urlPathname: originalPathname,
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
      assets: getAssets(errorRoute.page, manifest)
    })

    return new Response(html, { status, headers: { 'Content-Type': 'text/html' } })
  } catch (renderError) {
    console.error('Error page render failed:', renderError)
    return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })
  }
}

export default async function renderPage(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url)
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

    const { config, manifest } = await getVikeState()
    const { default: onRenderHtml } = await config.onRenderHtml()

    const html = await onRenderHtml({
      pageContext,
      Page: (PageModule!.Page ?? PageModule!.default)!,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      pageTitleTag: pageContext.title ? `<title>${pageContext.title}</title>` : '',
      serializedContext: serializeContext(pageContext),
      assets: getAssets(route.page, manifest)
    })

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    if (error instanceof AbortRender) {
      return new Response(error.reason || 'Not Found', { status: error.statusCode })
    }
    console.error('Render Error:', error)
    if (isJsonRequest) return Response.json({ is500: true }, { status: 500 })
    return renderErrorPage(req, 500, targetPathname, error)
  }
}
