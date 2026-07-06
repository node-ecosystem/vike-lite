type PageContextBase = {
  routeParams: Record<string, string>
  urlOriginal: string
  urlPathname: string
  search: string
  title?: string
  is404?: boolean
  is500?: boolean
  errorMessage?: string
}

export type PageContext<Data = unknown> = PageContextBase & (
  unknown extends Data ? { data?: Data } : { data: Data }
)

export interface PageContextServer extends PageContextBase {
  isClientSide: false
  nonce?: string
  // request?: Request OR request: Request    // Fetch API Request native
  // responseHeaders: Headers   // To set Set-Cookie, etc.
}

export interface PageContextClient extends PageContextBase {
  isClientSide: true
  isHydration?: boolean
}

export type DataAsync<Data = unknown> = (pageContext: PageContext) => Promise<Data>

export type DataSync<Data = unknown> = (pageContext: PageContext) => Data
