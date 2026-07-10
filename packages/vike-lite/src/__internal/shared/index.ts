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
  nonce?: string
}

export { default as matchRoute } from './matchRoute'
