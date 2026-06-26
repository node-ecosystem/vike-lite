import type { PageContext } from '..'
import matchRoute from '../shared/matchRoute'
import { AbortRender } from './abort'
import { store } from './store'

const isProd = process.env.NODE_ENV === 'production'

const ESCAPE_LOOKUP: Record<string, string> = {
  '&': String.raw`\u0026`,
  '>': String.raw`\u003e`,
  '<': String.raw`\u003c`,
  '\u{2028}': String.raw`\u2028`,
  '\u{2029}': String.raw`\u2029`
}
const ESCAPE_REGEX = /[&><\u{2028}\u{2029}]/gu

function serializeContext(data: unknown): string {
  return JSON.stringify(data).replaceAll(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match])
}

function getAssets(pageModuleId: string) {
  if (!isProd) return {
    cssLinks: '',
    jsPreloads: '',
    entryClient: '/@id/virtual:entry-client',
  }

  const cssFiles = new Set<string>()
  const jsFiles = new Set<string>()
  const manifest = store.manifest

  function getVirtualEntryClientIdFromManifest() {
    for (const key in manifest) {
      if (manifest[key].isEntry) {
        return key
      }
    }
    throw new Error('virtual:entry-client not found in manifest')
  }

  function collectAssets(key: string) {
    const chunk = manifest![key]
    if (!chunk) throw new Error(`Asset not found in manifest for key: ${key}`)
    jsFiles.add(chunk.file)
    if (chunk.css) for (const css of chunk.css) cssFiles.add(css)
    if (chunk.imports) for (const imp of chunk.imports) collectAssets(imp)
  }

  const virtualEntryClientId = getVirtualEntryClientIdFromManifest()
  collectAssets(virtualEntryClientId)
  collectAssets(pageModuleId.replace('@/', ''))

  return {
    cssLinks: [...cssFiles].map(href => `<link rel="stylesheet" href="/${href}">`).join(''),
    jsPreloads: [...jsFiles].map(href => `<link rel="modulepreload" href="/${href}">`).join(''),
    entryClient: '/' + manifest![virtualEntryClientId].file,
  }
}

async function buildPageContext(urlPathname: string, urlOriginal: string, isJsonRequest: boolean) {
  const matched = matchRoute(urlPathname, store.routes)
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
    isJsonRequest ? null : route.Layout?.() ?? null,
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
  error?: unknown,
): Promise<Response> {
  if (!store.errorRoute) { // <--- Leggiamo errorRoute dallo store
    return new Response(status === 404 ? 'Not Found' : 'Internal Server Error', { status })
  }

  try {
    const { default: onRenderHtml } = await store.config!.onRenderHtml()

    const [PageModule, HeadModule, LayoutModule] = await Promise.all([
      store.errorRoute.Page(),
      store.errorRoute.Head?.() ?? null,
      store.errorRoute.Layout?.() ?? null,
    ])

    const pageContext = {
      urlOriginal: req.url,
      urlPathname: originalPathname,
      routeParams: {},
      is404: status === 404,
      is500: status === 500,
      errorMessage: status === 500 && error instanceof Error ? error.message : undefined,
    } as PageContext

    const html = await onRenderHtml({
      pageContext,
      Page: (PageModule.Page ?? PageModule.default)!,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      pageTitleTag: `<title>${status === 404 ? 'Page Not Found' : 'Server Error'}</title>`,
      serializedContext: serializeContext(pageContext),
      assets: getAssets(store.errorRoute.page),
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

    const { default: onRenderHtml } = await store.config!.onRenderHtml()

    const html = await onRenderHtml({
      pageContext,
      Page: (PageModule!.Page ?? PageModule!.default)!,
      Head: HeadModule ? (HeadModule.Head ?? HeadModule.default)! : undefined,
      Layout: LayoutModule ? (LayoutModule.Layout ?? LayoutModule.default)! : undefined,
      pageTitleTag: pageContext.title ? `<title>${pageContext.title}</title>` : '',
      serializedContext: serializeContext(pageContext),
      assets: getAssets(route.page),
    })

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
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
