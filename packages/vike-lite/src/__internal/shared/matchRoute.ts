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
