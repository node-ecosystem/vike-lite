declare module 'virtual:routes' {
  export const config: import('./__internal/shared').Config

  type Imported<Name extends string, T> = () => Promise<
    | ({ [K in Name]: T } & { default?: T })
    | ({ [K in Name]?: T } & { default: T })
  >

  type PageContext = import('./index').PageContext
  export const routes: Array<{
    path: string
    page: string
    Page: Imported<'Page', HTMLElement>
    head?: string
    Head?: Imported<'Head', HTMLElement>
    layout?: string
    Layout?: Imported<'Layout', HTMLElement>
    hasData: boolean
    data?: Imported<'data', (pageContext: PageContext) => Promise<PageContext['data']>>
    hasTitle: boolean
    title?: Imported<'title', string | ((pageContext: PageContext) => string)>
  }>

  export const errorRoute: {
    path: string
    page: string
    Page: Imported<'Page', HTMLElement>
    Head?: Imported<'Head', HTMLElement>
    Layout?: Imported<'Layout', HTMLElement>
  }
}

declare module 'virtual:client-manifest' {
  export default Manifest
}

declare global {
  declare var __PAGE_CONTEXT__: import('./index').PageContext
  declare var _vike_lite: import('./server/store').VikeState
}
