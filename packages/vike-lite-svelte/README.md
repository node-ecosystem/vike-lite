# Vike Lite Svelte
<a href="https://npmjs.com/package/vike-lite-svelte"><img src="https://img.shields.io/npm/v/vike-lite-svelte.svg" alt="npm package"></a>

The official Svelte 5 integration for `vike-lite`. It provides seamless Server-Side Rendering (SSR), Static Site Generation (SSG), and client hydration out of the box, with a focus on minimalism, performance, and native Svelte 5 Runes.

### ⚙️ Install
You need to install `vike-lite-svelte`, the official Vite plugin for Svelte (`@sveltejs/vite-plugin-svelte`), and `svelte` version 5.

```sh
# npm
npm install -D vike-lite-svelte @sveltejs/vite-plugin-svelte
npm install svelte

# pnpm
pnpm add -D vike-lite-svelte @sveltejs/vite-plugin-svelte
pnpm add svelte

# yarn
yarn add -D vike-lite-svelte @sveltejs/vite-plugin-svelte
yarn add svelte
```

### 🛠️ Vite Plugin
Add the plugin to your `vite.config`.

```ts
// vite.config.ts
import vikeLite from 'vike-lite/vite'
import vikeLiteSvelte from 'vike-lite-svelte/vite'
import type { UserConfig } from 'vite'

export default {
  plugins: [
    vikeLite(),
    vikeLiteSvelte({
      // Default is `true` that enables Svelte Hydration
      // Set to `false` for Client Takeover (SPA mode)
      hydration: true,
      // Advanced: pass options directly to the underlying @sveltejs/vite-plugin-svelte
      svelte: {
        compilerOptions: {
          // e.g. custom compiler options
        }
      }
    })
  ]
} satisfies UserConfig
```

| Option | Type | Default | Description
| - | - | - | -
| `hydration` | `boolean` | `true` | When `true`, the server renders the page to HTML and the client hydrates it. When `false`, the client discards the server-rendered HTML on load and mounts a fresh tree — useful for highly interactive pages where paying the hydration-mismatch tax isn't worth it.
| `solid` | `Options` (from `@sveltejs/vite-plugin-svelte`) | `{}` | Passed through to the underlying `@sveltejs/vite-plugin-svelte` instance. Use this for custom preprocessors or compiler settings.

### 🪝 Hooks

> 💡 **Note on Svelte 5 Reactivity:**: Hooks that return reactive data in `vike-lite-svelte` return an object with a `.current` getter. This guarantees that Svelte 5 Runes (`$state`, `$derived`) maintain their reactivity without needing to be manually wrapped in `$derived` by the consumer.

#### `useData`
Access the data fetched by your `+data` functions directly inside your Svelte components. It returns a tuple containing the reactive data object and a setter.
```html
<!-- /pages/+Page.svelte -->
<script lang="ts">
  import { useData } from 'vike-lite-svelte'

  type MyData = {
    title: string
  }

  let [data, setData] = useData<MyData>()
</script>

<div>
  <!-- Access the reactive state via .current -->
  <h1>{data.current.title}</h1>
  
  <button onclick={() => setData((prev) => ({ ...prev, title: 'Updated Title!' }))}>
    Update Data
  </button>
</div>
```


#### `usePageContext`
Access the current page context, including URL parameters, original pathname, and route information.
```html
<!-- /pages/+Page.svelte -->
<script lang="ts">
  import { usePageContext } from 'vike-lite-svelte'

  // Context is injected once, so no .current wrapper is needed
  let pageContext = usePageContext()
</script>

<div>
  <p>Current Path: <strong>{pageContext.urlPathname}</strong></p>
</div>
```

### `useHydrated`
Detect whether the application has successfully hydrated on the client. Essential for wrapping client-only libraries (like chart tools or window-dependent logic) to avoid SSR hydration mismatches.

```html
<!-- /pages/+Page.svelte -->
<script lang="ts">
  import { useHydrated } from 'vike-lite-svelte'
  import ClientOnlyChart from './Chart.svelte'

  let hydrated = useHydrated()
</script>

<div>
  <h1>Statistics</h1>
  {#if hydrated.current}
    <ClientOnlyChart />
  {:else}
    <p>Loading chart…</p>
  {/if}
</div>
```

### `useUrl`
Get a reactive, fully parsed `URL` object that updates on every navigation.
```html
<!-- /pages/+Page.svelte -->
<script lang="ts">
  import { useUrl } from 'vike-lite-svelte'

  let url = useUrl()
</script>

<div>
  <p>Current Query Parameter "myQueryParam": <strong>{url.current.searchParams.get('myQueryParam')}</strong></p>
</div>
```

> 💡 **Note:** Unlike `vike-svelte` (which currently uses `pageContext.urlParsed`), `vike-lite-svelte` uses the `useUrl` hook that is granular and is the native result of `new URL()`.

### Differences: `vike-svelte` vs `vike-lite-svelte`
Currently `vike-svelte` doesn't exist.

### Why `vike-lite-svelte` instead of `SvelteKit`?
SvelteKit is a fantastic, full-featured meta-framework. However, sometimes you need something lighter, highly decoupled, or more agnostic. `vike-lite` brings the Svelte 5 SSR/SSG experience to Vite with a different philosophy:

| Feature | SvelteKit | `vike-lite-svelte` | Why it matters
| - | - | - | -
| Agnostic Core | Strongly tied to Svelte | Framework Agnostic | `vike-lite` lets you use Svelte 5, React, Vue, or Solid in the exact same way, sharing the same `vike-lite` core logic. Great for micro-frontends or teams transitioning between frameworks.
| Routing | File-system only (`+page.svelte`) | Explicit Route Arrays | `vike-lite` automatically generates your routes array, but exposes it directly to you. This means you have ultimate control over route-matching under the hood.
| Server/API logic | Custom Endpoint files (`+server.ts`) | Bring Your Own Server | `vike-lite-svelte` focuses only on rendering. For APIs, you can natively attach Hono, Express, or Fastify directly via Vite's `serverEntry` option, without learning a new framework-specific endpoint syntax.
| Reactivity | Full SvelteKit Context | 100% Native Runes | `vike-lite-svelte` is built from the ground up for Svelte 5. It entirely abandons legacy patterns in favor of the hyper-optimized `$state` and `$derived` Runes.
| Accessibility (A11y) | Manual setup often required | Automatically handled | After a client-side navigation, `vike-lite-svelte` removes focus from the clicked `<a>` tag by focusing `#root`. This significantly improves UX for keyboard navigation and screen readers out of the box.

---

This project is licensed under the [MIT License](../../LICENSE).
