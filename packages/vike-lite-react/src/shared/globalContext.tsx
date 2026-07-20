import { createContext, type Context } from 'react'
import type { PageContext, PageContextClient } from 'vike-lite'

export interface PageContextValue {
  pageContext: PageContext
  setPageContext: (updater: (prev: PageContextClient) => PageContextClient) => void
}

type PageContextReactContext = Context<PageContextValue | null>

const KEY = Symbol.for('vike-lite-react:context')

export const PageContextReactContext: PageContextReactContext =
  (globalThis as { [KEY]?: PageContextReactContext | undefined })[KEY] ??= createContext<PageContextValue | null>(null)
