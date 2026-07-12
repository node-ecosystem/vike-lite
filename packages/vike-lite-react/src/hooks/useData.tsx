import { useContext, useCallback } from 'react'

import { PageContextReactContext } from './globalContext'

export function useData<Data = unknown>(): [Data, (updater: Data | ((prev: Data) => Data)) => void] {
  const ctx = useContext(PageContextReactContext)
  if (!ctx) throw new Error('useData() must be called inside a page rendered by vike-lite-react')

  const data = ctx.pageContext.data as Data

  const setData = useCallback((updater: Data | ((prev: Data) => Data)) => {
    ctx.setPageContext(prev => ({
      ...prev,
      data: typeof updater === 'function' ? (updater as (prev: Data) => Data)(prev.data as Data) : updater
    }))
  }, [ctx])

  return [data, setData]
}
