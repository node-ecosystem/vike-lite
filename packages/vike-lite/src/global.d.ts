/* eslint-disable no-var */

declare module 'virtual:routes' {
  type Config = {
    onRenderHtml: () => Promise<{ default: (ctx: RenderContext) => Promise<string> }>
    onRenderClient: () => Promise<{ default: (opts: { routes: any[]; errorRoute: any }) => void }>
  }
  type PageContext = import('./index').PageContext

  export const config: Config

  type Imported<Name extends string, T> = () => Promise<
    | ({ [K in Name]: T } & { default?: T })
    | ({ [K in Name]?: T } & { default: T })
  >

  type RouteBase = Route & {
    Page: Imported<'Page', unknown>
    Head?: Imported<'Head', unknown>
    Layout?: Imported<'Layout', unknown>
    Prerender?: Imported<'prerender',
      | boolean
      | string[]
      | (() => boolean | string[] | Promise<boolean | string[]>)
    >
  }

  export const routes: Array<RouteBase & {
    Data?: Imported<'data', (pageContext: PageContext) => Promise<PageContext['data']>>
    Title?: Imported<'title', string | ((pageContext: PageContext) => string)>
  }>

  export const errorRoute: RouteBase | null
}

declare module 'virtual:client-manifest' {
  import type { Manifest } from 'vite'
  const manifest: Manifest
  export default manifest
}

declare var __PAGE_CONTEXT__: import('./index').PageContext | undefined
declare var _vike_lite: import('./server/store').VikeState
