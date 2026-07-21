# Vike Lite React
<a href="https://npmjs.com/package/vike-lite-react"><img src="https://img.shields.io/npm/v/vike-lite-react.svg" alt="npm package"></a>

The official React integration for `vike-lite`. It provides seamless Server-Side Rendering (SSR), Static Site Generation (SSG), and client hydration out of the box, with a focus on minimalism and performance.

### ⚙️ Install
You need to install both `vike-lite-react` and the official Vite plugin for React (`@vitejs/plugin-react`).

```sh
# npm
npm install -D vike-lite-react @vitejs/plugin-react
npm install react react-dom

# pnpm
pnpm add -D vike-lite-react @vitejs/plugin-react
pnpm add react react-dom

# yarn
yarn add -D vike-lite-react @vitejs/plugin-react
yarn add react react-dom
```

### 🛠️ Vite Plugin

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'
import vikeLiteReact from 'vike-lite-react/vite'

export default {
  plugins: [
    vikeLite(),
    vikeLiteReact({
      // Default is `true` that enables React Hydration
      // Set to `false` for Client Takeover (SPA mode)
      hydration: true,
      // Advanced: pass options directly to the underlying @vitejs/plugin-react
      react: {
        babel: {
          plugins: [
            // e.g. add custom babel plugins
          ]
        }
      }
    })
  ]
} satisfies UserConfig
```

| Option | Type | Default | Description
| - | - | - | -
| `hydration` | `boolean` | `true` | When `true`, the server renders the page to HTML and the client hydrates it (`hydrateRoot`). When `false`, the client discards the server-rendered HTML on load and mounts a fresh tree (`createRoot`) — useful for highly interactive pages where paying the hydration-mismatch tax isn't worth it.
| `streaming` | `boolean` | `false` | When `true`, streams the server-rendered app markup via the Web Streams API (`ReadableStream`, using `react-dom/server.edge`'s `renderToReadableStream`) instead of buffering it into a single string before sending the response. Works identically on Node.js, Deno, Bun and Edge runtimes. Ignored when `hydration: false`. See [HTTP Streaming](../vike-lite/doc/differences/STREAMING.md).
| `react` | `Options` (from `@vitejs/plugin-react`) | `{}` | Passed through to the underlying `@vitejs/plugin-react` instance. Use this for `jsxImportSource` (e.g. Emotion), custom Babel plugins, or `jsxRuntime: 'classic'`.

### 🪝 Hooks

#### `useData`
Access the data fetched by your `+data` functions directly inside your React components.
```tsx
// /pages/+Page.tsx
import { useData } from 'vike-lite-react'

type MyData = {
  title: string
}

export default function Page() {
  const [data, setData] = useData<MyData>()

  return (
    <div>
      <h1>{data.title}</h1>
      <button onClick={() => setData(prev => ({ ...prev, title: 'Updated Title!' }))}>
        Update Data
      </button>
    </div>
  )
}
```

> 💡 **Note:** Like `vike-lite-solid`, the `useData` hook in `vike-lite-react` returns a tuple `[data, setData]`, letting you mutate the route data locally without needing an extra state manager.

#### `usePageContext`
Access the current page context, including URL parameters, original pathname, and route information.
```tsx
// /pages/+Page.tsx
import { usePageContext } from 'vike-lite-react'

export function Page() {
  const pageContext = usePageContext()

  return (
    <div>
      <p>Current Path: <strong>{pageContext.urlPathname}</strong></p>
    </div>
  )
}
```

#### `useHydrated`
Detect whether the application has successfully hydrated on the client. Essential for wrapping client-only libraries (like chart tools or window-dependent logic) to avoid SSR hydration mismatches.

```tsx
// /pages/+Page.tsx
import { useHydrated } from 'vike-lite-react'
import ClientOnlyChart from './Chart'

export function Page() {
  const hydrated = useHydrated()

  return (
    <div>
      <h1>Statistics</h1>
      {hydrated ? <ClientOnlyChart /> : <p>Loading chart…</p>}
    </div>
  )
}
```

#### `useUrl`
```tsx
// /pages/+Page.tsx
import { useUrl } from 'vike-lite-react'

export function Page() {
  const url = useUrl()

  return (
    <div>
      <p>Current Query Parameter "myQueryParam": <strong>{url.searchParams.get('myQueryParam')}</strong></p>
    </div>
  )
}
```

### Differences: `vike-react` vs `vike-lite-react`
Why choose `vike-lite`? It's built to be as minimal and fast as possible. Here are the main architectural differences regarding the React integration:

| **Feature** | `vike-react` | `vike-lite-react` | **Why it matters**
| - | - | - | -
| **Reactivity Architecture** | _Single Source of Truth_ | _Separation of Concerns_ | `vike-lite-react` keeps page data (`pageContext`) and the active UI (`view`: Page/Layout/Head) as two separate `useState` atoms, so a data update doesn't force React to re-resolve which components are mounted, and vice versa.
| **Accessibility (A11y)** | _Not_ handled by default | _Automatic_ handled | After a client-side navigation, `vike-lite-react` moves the focus to `#root`. This significantly improves UX for keyboard navigation and screen readers.
| `useData()` **Hook** | `getter` only | `[getter, setter]` | `vike-lite-react` allows you to mutate the route data locally without needing other state managers.
| URL parsed | [pageContext.urlParsed](https://vike.dev/pageContext#urlParsed) | [useUrl()](#useurl) | A dedicated hook, consistent with `vike-lite-react`

---

This project is licensed under the [MIT License](../../LICENSE).
