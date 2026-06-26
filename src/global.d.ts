declare module 'virtual:routes' {
  type Imported<Name extends string, T> = () => Promise<
    | ({ [K in Name]: T } & { default?: T })
    | ({ [K in Name]?: T } & { default: T })
  >
  type PageContext = import('./index').PageContext
  export const config: import('./index').Config
  export const routes: Array<{
    path: string
    page: string
    hasData: boolean
    hasTitle: boolean
    Page: Imported<'Page', HTMLElement>
    Head?: Imported<'Head', HTMLElement>
    Layout?: Imported<'Layout', HTMLElement>
    data?: Imported<'data', (pageContext: PageContext) => Promise<PageContext['data']>>
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
  const manifest: import('./index').Manifest
  export default manifest
}
