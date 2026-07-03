type Route = {
  path: string
  page: string
  layout?: string
  head?: string
  // Public flag: visible to both client and server.
  // The client uses "data" and "title" paths to decide whether to fetch the .pageContext.json
  // Catch-22:
  // - exclude import "data" from the client bundle
  //   but import it in the server bundle to include it in the server bundle
  //   (it will be available for SSR "data" fetching)
  // - "data" path indicates if "data" can be fetched by the client
  // - "title" path indicates if "title" can be fetched by the client
  // - Flags are present only if errorRoute isn't undefined
  data?: string
  title?: string
  prerender?: string
}

type Manifest = Record<string, {
  file: string
  css?: string[]
  imports?: string[]
  isEntry?: boolean
}>
