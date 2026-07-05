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
