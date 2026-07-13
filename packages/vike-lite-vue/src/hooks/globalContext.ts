import type { PageContextClient } from 'vike-lite'
import type { InjectionKey, Reactive } from 'vue'

export interface PageContextValue {
  pageContext: Reactive<PageContextClient>
}

const KEY = '_vike_lite_vue_context'
const g = globalThis as any

if (!Object.hasOwn(g, KEY)) {
  g[KEY] = Symbol('vike-lite-vue:pageContext') as InjectionKey<PageContextValue>
}

export const pageContextInjectionKey = g[KEY] as InjectionKey<PageContextValue>
