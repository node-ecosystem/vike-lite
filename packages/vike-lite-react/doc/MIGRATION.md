```diff
// vite.config.ts
import type { UserConfig } from 'vite'
-import vike from 'vike'
-import vikeReact from 'vike-react/vite'
+import vikeLite from 'vike-lite/vite'
+import vikeLiteReact from 'vike-lite-react/vite'

export default {
  plugins: [
-    vike(),
-    vikeReact()
+    vikeLite(),
+    vikeLiteReact()
  ]
} satisfies UserConfig
```

### 🪝 Hooks

#### `useData`
```diff
-import { useData } from 'vike-react/useData'
+import { useData } from 'vike-lite-react'

-const data = useData<DataType>()
+const [data, setData] = useData<DataType>()
```

#### `useHydrated`
```diff
-import { useHydrated } from 'vike-react/useHydrated'
+import { useHydrated } from 'vike-lite-react'
```

#### `usePageContext` ~ Search in `Page`
`pageContext.urlParsed` isn't implemente in `vike-lite` and in `vike-lite-react`. Use the `URL` API directly instead.

Inside the component if you don't need the `usePageContext` hook, you can use the `useUrl` hook directly.
```diff
import { useState } from 'react'
-import { usePageContext } from 'vike-react/usePageContext'
+import { useUrl } from 'vike-lite-react'

export default function Page() {
-  const pageContext = usePageContext()
-  const [myQueryParam, setMyQueryParam] = useState(pageContext.urlParsed.search.myQueryParam)
+  const url = useUrl()
+  const [myQueryParam, setMyQueryParam] = useState(url.searchParams.get('myQueryParam'))
}
```

As alternative, if you already use the `usePageContext` hook, you can use the `pageContext` to get the `urlOriginal`.
By this way you access at the context only 1 time.

```diff
-import { useState } from 'react'
-import { usePageContext } from 'vike-react/usePageContext'
+import { useState, useMemo } from 'react'
+import { usePageContext } from 'vike-lite-react'

export default function Page() {
  const pageContext = usePageContext()
-  const [myQueryParam, setMyQueryParam] = useState(pageContext.urlParsed.search.myQueryParam)
+  const url = useMemo(() => new URL(pageContext.urlOriginal), [pageContext.urlOriginal])
+  const [myQueryParam, setMyQueryParam] = useState(url.searchParams.get('myQueryParam'))
}
```
