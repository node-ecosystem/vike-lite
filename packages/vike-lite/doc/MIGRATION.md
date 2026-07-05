### Vite plugin
```diff
// vite.config.ts
import type { UserConfig } from 'vite'
-import vike from 'vike'
+import vikeLite from 'vike-lite/vite'

export default {
  plugins: [
-    vike()
+    vikeLite()
  ]
} satisfies UserConfig
```

### 🖥️ Server Integration

#### `renderPage`
```diff
-import { renderPage } from 'vike/server'
+import { renderPage } from 'vike-lite/server'
```

### 🖥️ Client Router

#### `navigate`
```diff
-import { navigate } from 'vike/client/router'
+import { navigate } from 'vike-lite/client/router'
```

#### `reload`
```diff
-import { reload } from 'vike/client/router'
+import { reload } from 'vike-lite/client/router'
```

### 🖥️ Server Abort

#### `redirect`
```diff
-import { redirect } from 'vike/server/abort'
+import { redirect } from 'vike-lite/server/abort'
```

#### `render`
```diff
-import { render } from 'vike/server/abort'
+import { render } from 'vike-lite/server/abort'
```

#### Search in `+data`
`pageContext.urlParsed` isn't implemente in `vike-lite`. You have to use the `URL`
```diff
export const data = (pageContext) => {
-  const { search } = pageContext.urlParsed
-  const { page } = search
+  const { searchParams } = new URL(pageContext.urlOriginal)
+  const page = searchParams.get('page')
}
```

