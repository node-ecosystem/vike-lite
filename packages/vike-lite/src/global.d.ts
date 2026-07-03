/* eslint-disable no-var */

declare module 'virtual:routes' {
  export const config: import('./__internal/shared').Config

  type Imported<Name extends string, T> = () => Promise<
    | ({ [K in Name]: T } & { default?: T })
    | ({ [K in Name]?: T } & { default: T })
  >

  type PageContext = import('./index').PageContext
  export const routes: Array<Route & {
    Page: Imported<'Page', HTMLElement>
    Head?: Imported<'Head', HTMLElement>
    Layout?: Imported<'Layout', HTMLElement>
    Data?: Imported<'data', (pageContext: PageContext) => Promise<PageContext['data']>>
    Title?: Imported<'title', string | ((pageContext: PageContext) => string)>
    Prerender?: Imported<'prerender', boolean>
  }>

  export const errorRoute: Route & {
    Page: Imported<'Page', HTMLElement>
    Head?: Imported<'Head', HTMLElement>
    Layout?: Imported<'Layout', HTMLElement>
    Prerender?: Imported<'prerender', boolean>
  }
}

declare module 'virtual:client-manifest' {
  export default Manifest
}

declare var __PAGE_CONTEXT__: import('./index').PageContext
declare var _vike_lite: import('./server/store').VikeState
