import { computed, inject, type ComputedRef } from 'vue'

import { pageContextInjectionKey } from './globalContext'

export function useData<Data = unknown>(): [ComputedRef<Data>, (updater: Data | ((prev: Data) => Data)) => void] {
  const ctx = inject(pageContextInjectionKey)
  if (!ctx) throw new Error('useData() must be called inside a page rendered by vike-lite-vue')

  const data = computed(() => ctx.pageContext.data as Data)

  const setData = (updater: Data | ((prev: Data) => Data)) => {
    const next = typeof updater === 'function'
      ? (updater as (prev: Data) => Data)(ctx.pageContext.data as Data)
      : updater
    ctx.pageContext.data = next
  }

  return [data, setData]
}
