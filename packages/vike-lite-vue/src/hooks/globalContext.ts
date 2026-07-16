import type { PageContextClient } from 'vike-lite'
import type { InjectionKey, Reactive } from 'vue'

export interface PageContextValue {
  pageContext: Reactive<PageContextClient>
}

const KEY = Symbol.for('vike-lite-vue:context')

type PageContextInjectionKey = InjectionKey<PageContextValue>

export const pageContextInjectionKey: PageContextInjectionKey =
  (globalThis as { [KEY]?: PageContextInjectionKey })[KEY] ??= Symbol('vike-lite-vue:pageContext')
