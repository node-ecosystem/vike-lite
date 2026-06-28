export interface RenderContext {
  pageContext: any
  Page: unknown
  Head?: unknown
  Layout?: unknown
  pageTitleTag: string
  serializedContext: string
  assets: {
    cssLinks: string
    jsPreloads: string
    entryClient: string
  }
}

export type Config = {
  onRenderHtml: () => Promise<{ default: (ctx: RenderContext) => string }>
  onRenderClient: () => Promise<{ default: (opts: { routes: any[]; errorRoute: any }) => void }>
}

export { default as matchRoute } from './matchRoute'
