/* eslint-disable no-var */

declare module 'virtual:vike-lite/routes' {
  type RenderContext = import('./__internal/shared').RenderContext

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

  type Config = {
    onRenderClient: () => Promise<{ default: (opts: { routes: RouteBase[]; errorRoute: RouteBase | null }) => void }>
    onRenderHtml: (ctx: RenderContext) => Promise<string>
  }
  type PageContext = import('./index').PageContext

  export const config: Config

  export const routes: Array<RouteBase & {
    Data?: Imported<'data', (pageContext: PageContext) => Promise<PageContext['data']>>
    Title?: Imported<'title', string | ((pageContext: PageContext) => string)>
  }>

  export const errorRoute: RouteBase | null
}

declare module 'virtual:vike-lite/client-manifest' {
  import type { Manifest } from 'vite'
  const manifest: Manifest
  export default manifest
}

// `undefined` because client adapters reset this reference once
// the initial context injected by the server is consumed (see onRenderClient in each adapter).
declare var __PAGE_CONTEXT__: import('./index').PageContextClient | undefined
