type PageContextBase<Data = unknown> = {
  routeParams: Record<string, string>
  urlOriginal: string
  urlPathname: string
  search: string
  title?: string
  is404?: boolean
  is500?: boolean
  errorMessage?: string
} & (unknown extends Data ? {
  data?: Data
} : {
  data: Data
})

export type PageContextServer<Data = unknown> = PageContextBase<Data> & {
  isClientSide: false
  nonce?: string
  // request?: Request OR request: Request    // Fetch API Request native
  // responseHeaders: Headers   // To set Set-Cookie, etc.
}

export type PageContextClient<Data = unknown> = PageContextBase<Data> & {
  isClientSide: true
  isHydration?: boolean
}

export type PageContext<Data = unknown> = PageContextServer<Data> | PageContextClient<Data>
