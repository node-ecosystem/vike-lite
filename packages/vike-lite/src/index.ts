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
