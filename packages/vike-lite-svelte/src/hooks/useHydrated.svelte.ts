import { onMount } from 'svelte'

/**
 * Returns `true` once the component has mounted on the client (always `false`
 * during SSR). Useful for rendering something only after hydration, e.g. to
 * avoid a server/client markup mismatch for browser-only content.
 */
export function useHydrated(): { readonly current: boolean } {
  let hydrated = $state(false)
  onMount(() => { hydrated = true })
  return { get current() { return hydrated } }
}
