import { hydrate, render } from 'solid-js/web'
import { matchRoute, stripBase } from 'vike-lite/__internal/shared'
import { buildInitialClientContext, loadViewModules } from 'vike-lite/__internal/client'

import { RouterApp, type ViewComponents, type RouterProps } from '../shared/RouterApp'

export async function onRenderClient(clientOptions: Omit<RouterProps, 'initialView' | 'initialContext' | 'initialUrl'> & { hydration: boolean }) {
  const container = document.querySelector<HTMLDivElement>('#root')!

  let initialView: ViewComponents = { Page: null, Layout: null, Head: null }

  const isHydration = !!(clientOptions.hydration && globalThis.__PAGE_CONTEXT__ && globalThis._$HY)

  // Clone or initialize the context safely, stamping the client-only flags every
  // PageContextClient requires (isClientSide, isHydration) — in linea con gli altri adapter.
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration)

  // Clean up the fallback and assign to the context
  const pathname = initialContext.urlPathname ?? stripBase(globalThis.location.pathname)
  const urlOriginal = initialContext.urlOriginal ?? globalThis.location.href

  initialContext.urlPathname = pathname
  initialContext.urlOriginal = urlOriginal

  // If the server reported a 404 or 500 error, load the error modules!
  if (initialContext.is404 || initialContext.is500 || initialContext.errorMessage) {
    if (clientOptions.errorRoute) {
      initialView = await loadViewModules(clientOptions.errorRoute)
    }
  } else {
    // Otherwise, perform the normal route match
    const matched = matchRoute(pathname, clientOptions.routes)
    if (matched) {
      initialView = await loadViewModules(matched.route)
    } else if (clientOptions.errorRoute) {
      // Fallback: The URL does not exist in the client routing
      initialView = await loadViewModules(clientOptions.errorRoute)
      initialContext.is404 = true
    }
  }

  const App = () => (
    <RouterApp
      {...clientOptions}
      initialView={initialView}
      initialContext={initialContext}
      initialUrl={urlOriginal}
    />
  )

  if (isHydration) {
    hydrate(App, container)
  } else {
    container.replaceChildren()
    render(App, container)
  }
}
