export type PageContext<Data = unknown> = {
  routeParams: Record<string, string>
  urlOriginal: string
  urlPathname: string
  data?: Data
  title?: string
  is404?: boolean
  is500?: boolean
  errorMessage?: string
}

export type DataAsync<Data = unknown> = (pageContext: PageContext) => Promise<Data>

export type DataSync<Data = unknown> = (pageContext: PageContext) => Data

export type Route = {
  path: string
  page: string
  layout?: string
  head?: string
  // Public flag: visible to both client and server.
  // The client uses "hasData" and "hasTitle" to decide whether to fetch the .pageContext.json
  // Catch-22:
  // - exclude import "data" from the client bundle
  //   but import it in the server bundle to include it in the server bundle
  //   (it will be available for SSR "data" fetching)
  // - "hasData" flag indicates if "data" can be fetched by the client
  // - "hasTitle" flag indicates if "title" can be fetched by the client
  // - Flags are present only if errorRoute isn't undefined
  hasData?: boolean
  hasTitle?: boolean
}

export type Manifest = Record<string, {
  file: string
  css?: string[]
  imports?: string[]
  isEntry?: boolean
}>
