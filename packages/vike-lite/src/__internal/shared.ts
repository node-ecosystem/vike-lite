export interface RenderContext {
  pageContext: any
  Page: unknown
  Head?: unknown
  Layout?: unknown
  pageTitleTag: string
  serializedContext: string
  assets: {
    cssLinks: string
    jsPreloads: string
    entryClient: string
  }
  nonce?: string
}

const regexCache = new Map<string, { regex: RegExp; paramNames: string[] }>()

function escapeRegex(str: string) {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

export function matchRoute(
  urlPathname: string,
  routes: typeof import('virtual:vike-lite/routes').routes
) {
  for (const route of routes) {
    if (!route.path.includes(':')) {
      if (route.path === urlPathname || route.path + '/' === urlPathname) {
        return { route, routeParams: {} }
      }
      continue
    }

    let compiled = regexCache.get(route.path)
    if (!compiled) {
      const paramNames: string[] = []
      const regexPath = route.path
        .split('/')
        .map(segment => {
          if (segment.startsWith(':')) {
            paramNames.push(segment.slice(1))
            return '([^/]+)'
          }
          return escapeRegex(segment)
        })
        .join('/')
      compiled = { regex: new RegExp(`^${regexPath}/?$`), paramNames }
      regexCache.set(route.path, compiled)
    }

    const match = urlPathname.match(compiled.regex)
    if (match) {
      const routeParams: Record<string, string> = {}
      for (let i = 0; i < compiled.paramNames.length; i++) {
        routeParams[compiled.paramNames[i]] = decodeURIComponent(match[i + 1])
      }
      return { route, routeParams }
    }
  }

  return null
}

export const BASE_URL = (() => {
  const { BASE_URL } = import.meta.env
  return BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
})()

export function stripBase(pathname: string): string {
  if (BASE_URL === '') return pathname
  if (pathname === BASE_URL) return '/'
  if (pathname.startsWith(BASE_URL + '/')) return pathname.slice(BASE_URL.length)
  return pathname
}
