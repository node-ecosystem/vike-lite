### 🌊 HTTP Streaming (SSR)

`vike-lite` can stream the server-rendered HTML to the browser instead of buffering the whole document into a single string before sending it. This lets the browser start receiving (and painting) the `<head>` and the beginning of the page while the rest of the app markup is still being rendered on the server — improving Time To First Byte (TTFB) and perceived performance for large/slow pages.

Streaming is built entirely on the standard Web Streams API (`ReadableStream`), so it works identically on Node.js, Deno, Bun, and Edge runtimes (Cloudflare Workers, Vercel Edge, etc.).

#### Supported adapters
| Adapter | Streaming API used | Supported
| - | - | -
| `vike-lite-react` | `react-dom/server.edge`'s `renderToReadableStream` | ✅
| `vike-lite-vue` | `@vue/server-renderer`'s `renderToWebStream` | ✅
| `vike-lite-solid` | `solid-js/web`'s `renderToStream` | ✅
| `vike-lite-svelte` | _not available_ | ❌

> 💡 **Note:** Svelte is intentionally excluded. `svelte/server`'s `render()` returns fully-buffered markup synchronously and currently has no async/streaming SSR API to hook into. This will be revisited if Svelte ships one.

#### Usage
Enable it via the `streaming` option of your framework adapter's Vite plugin:

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'
import vikeLiteReact from 'vike-lite-react/vite'

export default {
  plugins: [
    vikeLite(),
    vikeLiteReact({
      streaming: true // Default: false
    })
  ]
} satisfies UserConfig
```

The same `streaming` option is available on `vikeLiteVue(...)` and `vikeLiteSolid(...)`.

> 💡 **Note:** `streaming` is ignored when `hydration: false` (Client Takeover): in that mode there's no server-rendered app markup to stream in the first place, since the client discards the SSR output and mounts a fresh tree.

#### How it works
| Step | What happens
| - | -
| 1. Shell | `vike-lite` immediately enqueues the opening HTML shell (`<!DOCTYPE>`, `<head>`, asset links, the injected `__PAGE_CONTEXT__` script, and the opening `<div id="root">`).
| 2. App stream | The framework's own streaming SSR renderer (see table above) produces the app markup as a `ReadableStream`, which is piped through chunk-by-chunk as it becomes available.
| 3. Shell close | Once the app stream ends, the closing tags (`</div>`, the client entry `<script>`, `</body>`, `</html>`) are enqueued and the stream is closed.
| 4. Response | `renderPage()` returns a `Response` with the resulting `ReadableStream<Uint8Array>` body — the same object used for a buffered render, just streamed.

This is implemented centrally in `vike-lite`'s `renderHtmlShellStream()` (used by every framework adapter's `onRenderHtml`), so CSP nonce handling and shell markup stay consistent between the buffered and streamed code paths.

#### Dev mode
Streaming is only effective in **production builds**. During `vite dev`, the dev server middleware always buffers `response.text()` so it can run `transformIndexHtml()` and inject FOUC-prevention `<style>` tags — the same trade-off most other streaming SSR frameworks make in dev mode. Your app still renders correctly in dev with `streaming: true`; it just won't actually stream until you build for production.

#### Error handling
If an error occurs after the shell has already started streaming to the client, an error page can no longer be swapped in (the response has already begun). In that case, the adapter logs the error to the console (e.g. `[vike-lite-react] Streaming render error:`) instead of failing the request — the client sees a truncated response rather than a clean 500 page. Framework adapters intentionally only enable a shell-level rejection (mirroring React's `onShellReady`) before any bytes are sent; errors afterwards are swallowed on purpose to avoid corrupting a stream that's already in flight.

---

This project is licensed under the [MIT License](../../../LICENSE).
