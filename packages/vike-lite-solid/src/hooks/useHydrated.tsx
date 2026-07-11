import { createSignal, onMount, sharedConfig } from 'solid-js'

let isHydrated: () => boolean
let setHydrated: (val: boolean) => void

// This block is executed only once when the file is imported
if (sharedConfig.context) {
  // SSR: on the server (or the very first moment of hydration) it will always be false
  isHydrated = () => false
} else {
  // CSR: we are on the client, we use a real signal
  const [hydrated, set] = createSignal(false)
  isHydrated = hydrated
  setHydrated = set
}

/**
 * Hook to safely render client-only components without triggering Hydration Mismatch.
 * 
 * Returns `false` during Server-Side Rendering and the initial Hydration phase.
 * Returns `true` immediately after the component is mounted on the client.
 * @link https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/useHydrated.tsx
 * @example
 * ```tsx
 * const isHydrated = useHydrated()
 * 
 * return (
 *   <Show fallback={<p>Loading player...</p>} when={isHydrated()}>
 *     <VideoPlayer />
 *   </Show>
 * )
 * ```
 */
export function useHydrated() {
  onMount(() => {
    // ONLY on Client AFTER hydration
    // Update the global signal, so all listening components re-render
    if (setHydrated) setHydrated(true)
  })

  return isHydrated
}
