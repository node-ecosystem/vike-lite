import type { PageContextClient, PageContextServer } from 'vike-lite'

export interface InternalContextValue<Data = unknown> {
  /** Reactive (created via `$state`) on the client; a plain object on the server. */
  readonly pageContext: PageContextClient<Data> | PageContextServer<Data>
}

const KEY = Symbol.for('vike-lite-svelte:context')

type PageContextKey = symbol

/**
 * Stored on `globalThis` under a `Symbol.for` registry key (not a plain module-level
 * `Symbol()`) so it stays a true singleton even if this module ends up duplicated by
 * a bundler — same technique used by vike-lite-vue's injection key.
 */
export const pageContextKey: PageContextKey =
  ((globalThis as { [KEY]?: PageContextKey })[KEY] ??= Symbol('vike-lite-svelte:pageContext'))
