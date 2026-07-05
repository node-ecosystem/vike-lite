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

#### `usePageContext` ~ Search in `Page`
`pageContext.urlParsed` isn't implemente in `vike-lite` and in `vike-lite-solid`. You have to use the `URL`
```diff
-import { usePageContext } from 'vike-solid/usePageContext'
+import { usePageContext } from 'vike-lite-solid'

export const Page: Component = () => {
  const pageContext = usePageContext()
-  const { search } = pageContext.urlParsed
-  const { page } = search
+  const { searchParams } = new URL(pageContext.urlOriginal)
+  const page = searchParams.get('page')
}
```
