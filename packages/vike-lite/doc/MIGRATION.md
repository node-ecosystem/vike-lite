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

### 🪝 Hooks

#### renderPage
```diff
-import { renderPage } from 'vike/server'
+import { renderPage } from 'vike-lite/server'
```

#### navigate
```diff
-import { navigate } from 'vike/client/router'
+import { navigate } from 'vike-lite/client/router'
```

#### reload
```diff
-import { reload } from 'vike/client/router'
+import { reload } from 'vike-lite/client/router'
```

#### redirect
```diff
-import { redirect } from 'vike/server/abort'
+import { redirect } from 'vike-lite/server/abort'
```

#### render
```diff
-import { render } from 'vike/server/abort'
+import { render } from 'vike-lite/server/abort'
```
