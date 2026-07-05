import { createMemo } from 'solid-js'

import usePageContext from './usePageContext'

export default function useUrl() {
  const ctx = usePageContext()

  const url = createMemo(() => new URL(ctx.urlOriginal, 'http://localhost'))

  return url
}
