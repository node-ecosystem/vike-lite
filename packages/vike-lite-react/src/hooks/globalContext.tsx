import { createContext } from 'react'
import type { PageContext } from 'vike-lite'

export interface PageContextValue {
  pageContext: PageContext
  setPageContext: (updater: (prev: PageContext) => PageContext) => void
}

const KEY = '__vike_lite_react_context__'
const g = globalThis as any

if (!Object.hasOwn(g, KEY)) {
  g[KEY] = createContext<PageContextValue | null>(null)
}

export const PageContextReactContext = g[KEY] as React.Context<PageContextValue | null>
