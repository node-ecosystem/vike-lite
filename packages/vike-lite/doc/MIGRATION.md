### 📦 Vite plugin
 Replace the Vite plugin import in your `vite.config`:
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

### 🌐 Client Router
The signature is the same, but navigate() in vike-lite is synchronous (it doesn't return a Promise). Remove any await when calling it:
#### `navigate`
```diff
-import { navigate } from 'vike/client/router'
+import { navigate } from 'vike-lite/client/router'

-await navigate()
+navigate()
```

#### `reload`
```diff
-import { reload } from 'vike/client/router'
+import { reload } from 'vike-lite/client/router'
```

### 🖥️ Server Abort
Same behavior, different import path:
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

### 🖥️ Server Integration
The renderPage API works the same way, only the import path changes:
#### `renderPage`
```diff
-import { renderPage } from 'vike/server'
+import { renderPage } from 'vike-lite/server'
```

### 🪝 Hooks & Page Context
#### Accessing search params in `+data`
`vike-lite` does not include pageContext.urlParsed by default (to keep the runtime minimal). Use the native `URL` API instead:
```diff
export const data = (pageContext) => {
-  const { search } = pageContext.urlParsed
-  const { page } = search
+  // Note: the second argument is a fallback base needed for relative URLs (SSR)
+  const url = new URL(pageContext.urlOriginal)
+
+  // Get a single query parameter
+  const page = url.searchParams.get('page')
+
+  // OR get all query parameters as an object
+  const search = Object.fromEntries(url.searchParams.entries())
}
```

