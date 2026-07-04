# vike-lite-solid

The official SolidJS integration for `vike-lite`. It provides seamless Server-Side Rendering (SSR), Static Site Generation (SSG), and client hydration out of the box.

### ⚙️ Install
You only need to install `vike-lite-solid` and `vite-plugin-solid` (it's automatically included and configured).
| Package Manager | Command
| - | -
| **npm** | `npm install -D vike-lite-solid vite-plugin-solid`
| **yarn** | `yarn add -D vike-lite-solid vite-plugin-solid`
| **pnpm** | `pnpm add -D vike-lite-solid vite-plugin-solid`

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
      // Default: true (SolidJS Hydration), false (Client Takeover)
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

#### useData
Access the data fetched by your `+data` functions directly inside your Solid components.
```ts
// /pages/+Page.tsx
import { useData } from 'vike-lite-solid'
import type { Component } from 'solid-js'

type MyData = {
  myKey: 'myValue'
}

const Page: Component = (props) => {
  const [data, setData] = useData<MyData>()
  return (
    <div>
      {data.myKey}

      {props.children}
    </div>
  )
}

export Page
```

#### usePageContext
Access the current page context, including URL parameters, original pathname, and route information.
```ts
// /pages/+Page.tsx
import { usePageContext } from 'vike-lite-solid'
import type { Component } from 'solid-js'

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

### useHydrated
_TODO:_ Implement [useHydrated](https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/useHydrated.tsx) to detect hydration state

### Differences
Why choose `vike-lite`? It's built to be as minimal and fast as possible. Here are the architectural differences:

| | `vike-solid` | `vike-lite-solid` | Note
| - | - | - | - 
| `Page` wrapper component | [Dynamic](https://docs.solidjs.com/concepts/control-flow/dynamic) | Direct Render | `vike-lite` reduces AST abstraction overhead. Pages are rendered directly without heavy wrappers, resulting in a **lighter DOM tree**.
| **Reactivity Architecture** | _Separation of Concerns_ | _Single Source of Truth_ | `vike-lite` separates the reactive state into 2 distinct entities (`pageContextStore` and `view`), taking advantage of Solid's [batch](https://docs.solidjs.com/reference/reactive-utilities/batch) for blazing-fast atomic updates. `vike-solid` serializes everything into a single massive `pageContext`.
| Remove client navigation focus when `<a>` is clicked | _Not_ handled  | Automatic handled | After client-side navigation, `vike-lite-solid` moves focus away from the clicked `<a>` by focusing `#root`, improving keyboard, screen-reader UX and accessibility. |

---

This project is licensed under the [MIT License](../../LICENSE).
