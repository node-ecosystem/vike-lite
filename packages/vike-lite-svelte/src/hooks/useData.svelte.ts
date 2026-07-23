import { getContext } from 'svelte'
import { pageContextKey, type InternalContextValue } from '../shared/globalContext'

/**
 * Hook dedicated to `data` for convenience. Returns a reactive getter (`.current`)
 * plus a setter, mirroring the `[ComputedRef, setData]` shape of vike-lite-vue's
 * `useData` — Svelte's rune-based reactivity is the closest match to Vue's
 * `computed()`/`ref()` model among the three existing adapters.
 */
export function useData<Data = unknown>(): [{ readonly current: Data }, (updater: Data | ((prev: Data) => Data)) => void] {
  const ctx = getContext(pageContextKey) as InternalContextValue<Data> | undefined
  if (!ctx) throw new Error('useData() must be called inside a page rendered by vike-lite-svelte')

  const data = $derived(ctx.pageContext.data as Data)

  const setData = (updater: Data | ((prev: Data) => Data)) => {
    const next = typeof updater === 'function'
      ? (updater as (prev: Data) => Data)(ctx.pageContext.data as Data)
      : updater
      // pageContext.data isn't typed as writable on PageContext (server side is meant
      // to be immutable), but the client-side reactive object created by RouterApp
      // does allow it — same cast pattern used by the other adapters' setData.
      ; (ctx.pageContext as { data: Data }).data = next
  }

  return [{ get current() { return data } }, setData]
}
