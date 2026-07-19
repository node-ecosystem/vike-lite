```diff
// vite.config.ts
import type { UserConfig } from 'vite'
-import vike from 'vike'
-import vikeSolid from 'vike-solid/vite'
+import vikeLite from 'vike-lite/vite'
+import vikeLiteSolid from 'vike-lite-solid/vite'

export default {
  plugins: [
-    vike(),
-    vikeSolid()
+    vikeLite(),
+    vikeLiteSolid()
  ]
} satisfies UserConfig
```

### 🪝 Hooks

#### `useData`
```diff
-import { useData } from 'vike-solid/useData'

-const data = useData<DataType>()

+import { useData } from 'vike-lite-solid'

+const [data, setData] = useData<DataType>()
```

#### `useHydrated`
```diff
-import { useHydrated } from 'vike-solid/useHydrated'
+import { useHydrated } from 'vike-lite-solid'
```

#### `usePageContext` ~ Search in `Page`
`pageContext.urlParsed` isn't implemente in `vike-lite` and in `vike-lite-solid`. Use the `URL` API directly instead.

Inside the component if you don't need the `usePageContext` hook, you can use the `useUrl` hook directly.
```diff
import { createSignal } from 'solid-js'
-import { usePageContext } from 'vike-solid/usePageContext'
+import { useUrl } from 'vike-lite-solid'

export const Page: Component = () => {
-  const [myQueryParam, setMyQueryParam] = createSignal(pageContext.urlParsed.search.myQueryParam)
+  const url = useUrl()
+  const [myQueryParam, setMyQueryParam] = createSignal(url().searchParams.get('myQueryParam'))
}
```

As alternative, if you already use the `usePageContext` hook, you can use the `pageContext` to get the `urlOriginal`.
By this way you access at the context only 1 time.

```diff
-import { createSignal } from 'solid-js'
-import { usePageContext } from 'vike-solid/usePageContext'
+import { createSignal, createMemo } from 'solid-js'
+import { usePageContext } from 'vike-lite-solid'

export const Page: Component = () => {
  const pageContext = usePageContext()
-  const [myQueryParam, setMyQueryParam] = createSignal(pageContext.urlParsed.search.myQueryParam)
+  const url = createMemo(() => new URL(pageContext.urlOriginal))
+  const [myQueryParam, setMyQueryParam] = createSignal(url().searchParams.get('myQueryParam'))
}
```
