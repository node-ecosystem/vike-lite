export default function matchRoute(urlPathname: string, routes: Route[]) {
  for (const route of routes) {
    const paramNames: string[] = []
    const regexPath = route.path.replaceAll(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName)
      return '([^/]+)'
    })

    // Exact match for the route
    const regex = new RegExp(`^${regexPath}/?$`)
    const match = urlPathname.match(regex)

    if (match) {
      let index = 0
      const routeParams: Record<string, string> = {}
      for (const name of paramNames) {
        routeParams[name] = match[++index]
      }
      return { route, routeParams }
    }
  }

  return null
}
