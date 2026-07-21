### TODO
- `create-vike-lite` → CLI for scaffolding (pages, vite.config.ts, tsconfig)
- add `vite-patcher` references
- add recipes (`examples` folder)
- Streaming SSR (`streaming: true`) is available for React, Vue and Solid via
  `renderHtmlShellStream` (Web Streams `ReadableStream`, works on Node.js, Deno,
  Bun and Edge runtimes). Svelte is intentionally excluded: `svelte/server`'s
  `render()` returns fully-buffered markup synchronously, with no async/streaming
  SSR API to hook into — revisit if Svelte ships one.
- Streaming is only effective in production builds: the Vite dev middleware
  always buffers `response.text()` to run `transformIndexHtml`/FOUC-style
  injection, same as most other streaming SSR frameworks in dev mode.
