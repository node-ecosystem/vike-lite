# vike-lite-solid

The official SolidJS integration for `vike-lite`. It provides seamless Server-Side Rendering (SSR), Static Site Generation (SSG), and client hydration out of the box, with a focus on minimalism and performance.

### ⚙️ Install
You need to install both `vike-lite-solid` and the official Vite plugin for SolidJS (`vite-plugin-solid`).
```sh
# npm
npm install -D vike-lite-solid vite-plugin-solid

# pnpm
pnpm add -D vike-lite-solid vite-plugin-solid

# yarn
yarn add -D vike-lite-solid vite-plugin-solid
```

### 📖 Usage
Add the plugin to your `vite.config`.

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'
import vikeLiteSolid from 'vike-lite-solid/vite'

export default {
  plugins: [
    vikeLite(),
    vikeLiteSolid({
      // Default is `true` that enables SolidJS Hydration
      // Set to `false` for Client Takeover (SPA mode)
      hydration: true,
      // Advanced: pass options directly to the underlying vite-plugin-solid
      solid: {
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

### 🪝 Hooks

#### `useData`
Access the data fetched by your `+data` functions directly inside your Solid components.
```tsx
// /pages/+Page.tsx
import type { Component } from 'solid-js'
import { useData } from 'vike-lite-solid'

type MyData = {
  title: string
}

const Page: Component = () => {
  const [data, setData] = useData<MyData>()

  return (
    <div>
      <h1>{data.title}</h1>
      <button onClick={() => setData('title', 'Updated Title!')}>
        Update Data
      </button>
    </div>
  )
}

export default Page
```

> 💡 **Note:** Unlike `vike-solid` (which currently only returns a getter), the `useData` hook in `vike-lite-solid` returns a tuple `[data, setData]`. This allows you to easily mutate the data locally. (`vike-solid` is currently waiting on the [PR](https://github.com/vikejs/vike-solid/pull/217) for this feature).

#### `usePageContext`
Access the current page context, including URL parameters, original pathname, and route information.
```tsx
// /pages/+Page.tsx
import type { Component } from 'solid-js'
import { usePageContext } from 'vike-lite-solid'

const Page: Component = () => {
  const pageContext = usePageContext()

  return (
    <div>
      <p>Current Path: <strong>{pageContext.urlPathname}</strong></p>
    </div>
  )
}

export default Page
```

### `useHydrated`
> 🚧 **TODO:** Implement a `useHydrated()` hook (similar to [vike-solid's implementation](https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/useHydrated.tsx)) to easily detect the hydration state and avoid SSR mismatch errors.

### `useUrl`
```tsx
// /pages/+Page.tsx
import type { Component } from 'solid-js'
import { useUrl } from 'vike-lite-solid'

const Page: Component = () => {
  const url = useUrl()

  return (
    <div>
      <p>Current Query Parameter "myQueryParam": <strong>{url.searchParams.get('myQueryParam')}</strong></p>
    </div>
  )
}

export default Page
```

> 💡 **Note:** Unlike `vike-solid` (which currently use `pageContext.urlParsed`), `vike-lite-solid` uses the `useUrl` hook that is granular and is the result of `new URL()`.

### Differences: `vike-solid` vs `vike-lite-solid`
Why choose `vike-lite`? It's built to be as minimal and fast as possible. Here are the main architectural differences regarding the SolidJS integration:

| **Feature** | `vike-solid` | `vike-lite-solid` | **Why it matters**
| - | - | - | - 
| **Reactivity Architecture** | _Single Source of Truth_ | _Separation of Concerns_ | `vike-solid` serializes everything into a single massive `pageContext`. `vike-lite` separates the reactive state into 2 distinct entities (`pageContextStore` and `view`), taking advantage of Solid's [batch()](https://docs.solidjs.com/reference/reactive-utilities/batch) for blazing-fast atomic updates.
| **Accessibility (A11y)** | _Not_ handled by default | _Automatic_ handled | After a client-side navigation, `vike-lite-solid` moves the focus away from the clicked `<a>` tag by focusing `#root`. This significantly improves UX for keyboard navigation and screen readers.
| `useData()` **Hook** | `getter` only | `[getter, setter]` | `vike-lite-solid` allows you to mutate the route data locally without needing other state managers.

---

This project is licensed under the [MIT License](../../LICENSE).
