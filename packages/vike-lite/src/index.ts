type PageContextBase = {
  routeParams: Record<string, string>
  urlOriginal: string
  urlPathname: string
  search: string
  title?: string
  nonce?: string
  is404?: boolean
  is500?: boolean
  errorMessage?: string
}

export type PageContext<Data = unknown> = PageContextBase & (
  unknown extends Data ? { data?: Data } : { data: Data }
)

export type DataAsync<Data = unknown> = (pageContext: PageContext) => Promise<Data>

export type DataSync<Data = unknown> = (pageContext: PageContext) => Data
