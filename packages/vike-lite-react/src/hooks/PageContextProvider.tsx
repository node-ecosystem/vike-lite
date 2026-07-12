import type { ReactNode } from 'react'
import { PageContextReactContext, type PageContextValue } from './globalContext'

export function PageContextProvider({
  value,
  children
}: {
  value: PageContextValue
  children: ReactNode
}) {
  return (
    <PageContextReactContext.Provider value={value}>
      {children}
    </PageContextReactContext.Provider>
  )
}
