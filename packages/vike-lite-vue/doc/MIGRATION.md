```diff
// vite.config.ts
import type { UserConfig } from 'vite'
-import vike from 'vike'
-import vikeVue from 'vike-vue/vite'
+import vikeLite from 'vike-lite/vite'
+import vikeLiteVue from 'vike-lite-vue/vite'

export default {
  plugins: [
-    vike(),
-    vikeVue()
+    vikeLite(),
+    vikeLiteVue()
  ]
} satisfies UserConfig
```

### 🪝 Hooks

#### `useData`
In `vike-lite-vue`, if you need to mutate the data, it's recommended to handle it through Vue's reactivity system (e.g., assigning a new value to the ref or using a dedicated setter if provided by your implementation).
```diff
<script setup lang="ts">
-import { useData } from 'vike-vue/useData'
+import { useData } from 'vike-lite-vue'

-// Data is usually returned as-is or reactive
-const data = useData<DataType>()
+// In vike-lite-vue, data handling is simplified
+const { data, setData } = useData<DataType>() // Or adapt based on your specific vike-lite-vue implementation
</script>
```

#### `useHydrated`
```diff
<script setup lang="ts">
-import { useHydrated } from 'vike-vue/useHydrated'
+import { useHydrated } from 'vike-lite-vue'
</script>
```

#### `usePageContext` ~ Search in `Page`
`pageContext.urlParsed` isn't implemented in `vike-lite` and `vike-lite-vue`. Use the native `URL` API directly instead.

Inside the component, if you don't need the whole `usePageContext` object, you can use the `useUrl` composable directly.
```diff
<script setup lang="ts">
import { ref } from 'vue'
-import { usePageContext } from 'vike-vue/usePageContext'
+import { useUrl } from 'vike-lite-vue'

-const pageContext = usePageContext()
-const myQueryParam = ref(pageContext.urlParsed.search.myQueryParam)
+const url = useUrl()
+const myQueryParam = ref(url.searchParams.get('myQueryParam'))
</script>
```

As an alternative, if you already use the `usePageContext` composable for other reasons, you can use the `pageContext` to get the `urlOriginal`.
This way you access the context only once, using Vue's computed to maintain reactivity efficiently.

```diff
<script setup lang="ts">
-import { ref } from 'vue'
-import { usePageContext } from 'vike-vue/usePageContext'
+import { ref, computed } from 'vue'
+import { usePageContext } from 'vike-lite-vue'

const pageContext = usePageContext()
-const myQueryParam = ref(pageContext.urlParsed.search.myQueryParam)
+const url = computed(() => new URL(pageContext.urlOriginal))
+const myQueryParam = ref(url.value.searchParams.get('myQueryParam'))
</script>
```
