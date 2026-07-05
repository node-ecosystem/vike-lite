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
