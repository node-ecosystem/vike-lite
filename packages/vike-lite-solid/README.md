# vike-lite-solid

### ⚙️ Install
| Package Manager | Command
| - | -
| **npm** | `npm install -D vike-lite-solid vite-plugin-solid`
| **yarn** | `yarn add -D vike-lite-solid vite-plugin-solid`
| **pnpm** | `pnpm add -D vike-lite-solid vite-plugin-solid`

### 📖 Usage
Add Vite plugin

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import vikeLite from 'vike-lite/vite'
import vikeLiteSolid from 'vike-lite-solid/vite'

export default {
  plugins: [
    solidPlugin({ ssr: true }),
    vikeLite(),
    vikeLiteSolid()
  ]
} satisfies UserConfig
```

### 🪝 Hooks

#### useData
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
```ts
// /pages/+Page.tsx
import { usePageContext } from 'vike-lite-solid'
import type { Component } from 'solid-js'

const Page: Component = (props) => {
  const pageContext = usePageContext()
  return (
    <div>
      {pageContext.urlPathname}
    </div>
  )
}

export Page
```

### TODO
- [useHydrated](https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/useHydrated.tsx)

### Differences

| | `vike-lite` | `vike` | Note
| - | - | - | - 
| `Page` component | ❌ | `Dynamic` | Abstraction of AST (Abstract Syntax Tree) compiler is reduced, as a result DOM is lighter
| page reactivity | _Separation of Concerns_ as 2 seprated states (`pageContextStore` and `view`) using the [batch](https://docs.solidjs.com/reference/reactive-utilities/batch) | _Single Source of Truth_ as `pageContext` where components are serialized

---

This project is licensed under the [MIT License](LICENSE).
