import type { JSX } from 'solid-js'
import type { SetStoreFunction, Store } from 'solid-js/store'
import type { PageContext } from 'vike-lite'

import globalContext from '../../hooks/globalContext'

export default function PageContextProvider(props: {
  children: JSX.Element
  pageContext: Store<PageContext>
  setPageContext: SetStoreFunction<PageContext>
}) {
  const Provider = globalContext.solidContext.Provider

  return (
    <Provider value={{
      get state() { return props.pageContext },
      get setState() { return props.setPageContext }
    }}>
      {props.children}
    </Provider>
  )
}
