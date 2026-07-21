# Vike Lite Vue
<a href="https://npmjs.com/package/vike-lite-vue"><img src="https://img.shields.io/npm/v/vike-lite-vue.svg" alt="npm package"></a>

The official Vue integration for `vike-lite`. It provides seamless Server-Side Rendering (SSR), Static Site Generation (SSG), and client hydration out of the box, with a focus on minimalism and performance.

### ⚙️ Install
You need to install both `vike-lite-vue` and the official Vite plugin for Vue (`@vitejs/plugin-vue`).

```sh
# npm
npm install -D vike-lite-vue @vitejs/plugin-vue
npm install vue

# pnpm
pnpm add -D vike-lite-vue @vitejs/plugin-vue
pnpm add vue

# yarn
yarn add -D vike-lite-vue @vitejs/plugin-vue
yarn add vue
```

### 🛠️ Vite Plugin
Add the plugin to your `vite.config`.

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'
import vikeLiteVue from 'vike-lite-vue/vite'

export default {
  plugins: [
    vikeLite(),
    vikeLiteVue({
    // Default is `true` that enables Vue Hydration
    // Set to `false` for Client Takeover (SPA mode)
    hydration: true,
    // Default is `true` that enables HTML Streaming
    streaming: true
    // Advanced: pass options directly to the underlying @vitejs/plugin-vue
    vue: {
      template: {
        compilerOptions: {
          // e.g. custom compiler options
        }
      }
    }
})
  ]
} satisfies UserConfig
```

| Option | Type | Default | Description
| - | - | - | -
| `hydration` | `boolean` | `true` | When `true`, the server renders the page to HTML and the client hydrates it. When `false`, the client discards the server-rendered HTML on load and mounts a fresh tree — useful for highly interactive pages where paying the hydration-mismatch tax isn't worth it.
| `streaming` | `boolean` | `true` | When `true`, streams the server-rendered app markup via the Web Streams API (`ReadableStream`, using `@vue/server-renderer`'s `renderToWebStream`) instead of buffering it into a single string before sending the response. Works identically on Node.js, Deno, Bun and Edge runtimes.
| `vue` | `Options` (from `@vitejs/plugin-vue`) | `{}` | Passed through to the underlying `@vitejs/plugin-vue` instance. Use this for custom compiler options or any other low-level Vue SFC compiler setting.

### 🪝 Hooks

#### `useData`
Access the data fetched by your `+data` functions directly inside your Vue components.

```html
<!-- /pages/+Page.vue -->
<script setup lang="ts">
import { useData } from 'vike-lite-vue'

type MyData = { title: string }

const [data, setData] = useData<MyData>()
</script>

<template>
  <div>
    <h1>{{ data.title }}</h1>
    <button @click="setData(prev => ({ ...prev, title: 'Updated Title!' }))">
      Update Data
    </button>
  </div>
</template>
```

> 💡 **Note:** `data` is a `ComputedRef` — access it with `data.value` in `<script setup>`, but **without** `.value` directly in `<template>` (Vue automatically unwraps refs there). Like `vike-lite-solid` and `vike-lite-react`, `useData` returns a `[data, setData]` tuple so you can mutate the route data locally without an extra state manager.

#### `usePageContext`
Access the current page context, including URL parameters, original pathname, and route information.

```html
<!-- /pages/+Page.vue -->
<script setup lang="ts">
import { usePageContext } from 'vike-lite-vue'

const pageContext = usePageContext()
</script>

<template>
  <p>Current Path: <strong>{{ pageContext.urlPathname }}</strong></p>
</template>
```

> 💡 **Note:** `pageContext` here is a Vue `reactive()` object, not a ref — access its properties directly (`pageContext.urlPathname`), both in `<script setup>` and in `<template>`.

#### `useHydrated`
Detect whether the application has successfully hydrated on the client. Essential for wrapping client-only libraries (like chart tools or window-dependent logic) to avoid SSR hydration mismatches.

```html
<!-- /pages/+Page.vue -->
<script setup lang="ts">
import { useHydrated } from 'vike-lite-vue'
import ClientOnlyChart from './Chart.vue'

const hydrated = useHydrated()
</script>

<template>
  <div>
    <h1>Statistics</h1>
    <ClientOnlyChart v-if="hydrated" />
    <p v-else>Loading chart…</p>
  </div>
</template>
```

#### `useUrl`
```html
<!-- /pages/+Page.vue -->
<script setup lang="ts">
import { useUrl } from 'vike-lite-vue'

const url = useUrl()
</script>

<template>
  <p>Current Query Parameter "myQueryParam": <strong>{{ url.searchParams.get('myQueryParam') }}</strong></p>
</template>
```

> 💡 **Note:** Like `vike-lite-solid` and `vike-lite-react`, `vike-lite-vue` provides a dedicated `useUrl` composable — a granular alternative to parsing `pageContext.urlOriginal` manually.

### Differences: `vike-vue` vs `vike-lite-vue`

| **Feature** | `vike-vue` | `vike-lite-vue` | **Why it matters**
| - | - | - | -
| **Reactivity Architecture** | _Single Source of Truth_ | _Separation of Concerns_ | `vike-lite-vue` keeps page data (`pageContext`) and the active UI (`view`: Page/Layout/Head) as two separate reactive atoms, so a data update doesn't force Vue to re-resolve which components are mounted, and vice versa.
| **Accessibility (A11y)** | _Not_ handled by default | _Automatic_ handled | After a client-side navigation, `vike-lite-vue` moves the focus to `#root`. This significantly improves UX for keyboard navigation and screen readers.
| `useData()` **Composable** | `getter` only | `[getter, setter]` | `vike-lite-vue` allows you to mutate the route data locally without needing other state managers.
| URL parsed | [pageContext.urlParsed](https://vike.dev/pageContext#urlParsed) | [useUrl()](#useurl) | A dedicated hook, consistent with `vike-lite-vue`

---

This project is licensed under the [MIT License](../../LICENSE).
