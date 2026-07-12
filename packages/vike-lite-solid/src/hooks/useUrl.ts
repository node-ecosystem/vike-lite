import { createMemo, type Accessor } from 'solid-js'

import { usePageContext } from './usePageContext'

export function useUrl(): Accessor<URL> {
  const ctx = usePageContext()
  const url = createMemo(() => new URL(ctx.urlOriginal, 'http://localhost'))
  return url
}
