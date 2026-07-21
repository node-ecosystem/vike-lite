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
   * Stream the server-rendered app markup via the Web Streams API (`ReadableStream`)
   * instead of buffering it into a single string before sending the response.
   * Uses `react-dom/server.edge`'s `renderToReadableStream`, so it works the same
   * way on Node.js, Deno, Bun and Edge runtimes. Ignored when `hydration: false`
   * (Client Takeover has no server-rendered app markup to stream).
   * @default true
   */
  streaming?: boolean
  /**
   * Advanced: pass options directly to the underlying @vitejs/plugin-react.
   */
  react?: ReactPluginOptions
}

export default function vikeLiteReact({ hydration = true, streaming = true, react: reactOptions }: VikeLiteReactOptions = {}): Plugin[] {
  const adapter = createFrameworkAdapterPlugin({ packageName: 'vike-lite-react', hydration, streaming })

  return [...react(reactOptions), adapter]
}
