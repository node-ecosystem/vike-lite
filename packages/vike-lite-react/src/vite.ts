import react, { type Options as ReactPluginOptions } from '@vitejs/plugin-react'
import { createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
import type { Plugin } from 'vite'

export interface VikeLiteReactOptions {
  /**
   * Enable client hydration (SSR + hydrate) or full client takeover (SPA mode).
   * @default true
   */
  hydration?: boolean
  /**
   * Advanced: pass options directly to the underlying @vitejs/plugin-react.
   */
  react?: ReactPluginOptions
}

export default function vikeLiteReact({ hydration = true, react: reactOptions }: VikeLiteReactOptions = {}): Plugin[] {
  const adapter = createFrameworkAdapterPlugin({ packageName: 'vike-lite-react', hydration })

  return [...react(reactOptions), adapter]
}
