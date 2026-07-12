import { createContext } from 'react'
import type { PageContextClient } from 'vike-lite'

export interface PageContextValue {
  pageContext: PageContextClient
  setPageContext: (updater: (prev: PageContextClient) => PageContextClient) => void
}

const KEY = '__vike_lite_react_context__'
const g = globalThis as any

if (!Object.hasOwn(g, KEY)) {
  g[KEY] = createContext<PageContextValue | null>(null)
}

export const PageContextReactContext = g[KEY] as React.Context<PageContextValue | null>
