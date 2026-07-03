import { hydration } from 'virtual:vike-lite-solid/config'
import { hydrate, render } from 'solid-js/web'
import { matchRoute } from 'vike-lite/__internal/shared'

import RouterApp, { type ViewComponents, type RouterProps } from '../shared/RouterApp'
import stripBase from '../shared/stripBase'

export default async function onRenderClient(clientOptions: Omit<RouterProps, 'initialView' | 'initialContext' | 'initialUrl'>) {
  const container = document.querySelector('#root') as HTMLDivElement

  let initialView: ViewComponents = { Page: null, Layout: null, Head: null }

  // Clone or initialize the context safely
  const initialContext = globalThis.__PAGE_CONTEXT__ ?? {}

  // Clean up the fallback and assign to the context
  const pathname = initialContext.urlPathname ?? stripBase(globalThis.location.pathname)
  const urlOriginal = initialContext.urlOriginal ?? globalThis.location.href

  initialContext.urlPathname = pathname
  initialContext.urlOriginal = urlOriginal

  // If the server reported a 404 or 500 error, load the error modules!
  if (initialContext.is404 || initialContext.is500 || initialContext.errorMessage) {
    if (clientOptions.errorRoute) {
      const [ErrorPageMod, ErrorLayoutMod, ErrorHeadMod] = await Promise.all([
        clientOptions.errorRoute.Page(),
        clientOptions.errorRoute.Layout?.() ?? null,
        clientOptions.errorRoute.Head?.() ?? null
      ])
      initialView = {
        Page: ErrorPageMod.Page ?? ErrorPageMod.default,
        Layout: ErrorLayoutMod?.Layout ?? ErrorLayoutMod?.default ?? null,
        Head: ErrorHeadMod?.Head ?? ErrorHeadMod?.default ?? null
      }
    }
  } else {
    // Otherwise, perform the normal route match
    const matched = matchRoute(pathname, clientOptions.routes)
    if (matched) {
      const [PageMod, LayoutMod, HeadMod] = await Promise.all([
        matched.route.Page(),
        matched.route.Layout?.() ?? null,
        matched.route.Head?.() ?? null
      ])
      initialView = {
        Page: PageMod.Page ?? PageMod.default,
        Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
        Head: HeadMod?.Head ?? HeadMod?.default ?? null
      }
    } else if (clientOptions.errorRoute) {
      // Fallback: The URL does not exist in the client routing
      const [ErrorPageMod, ErrorLayoutMod, ErrorHeadMod] = await Promise.all([
        clientOptions.errorRoute.Page(),
        clientOptions.errorRoute.Layout?.() ?? null,
        clientOptions.errorRoute.Head?.() ?? null
      ])
      initialView = {
        Page: ErrorPageMod.Page ?? ErrorPageMod.default,
        Layout: ErrorLayoutMod?.Layout ?? ErrorLayoutMod?.default ?? null,
        Head: ErrorHeadMod?.Head ?? ErrorHeadMod?.default ?? null
      }
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

  if (hydration && globalThis.__PAGE_CONTEXT__ && globalThis._$HY) {
    hydrate(App, container)
  } else {
    container.replaceChildren()
    render(App, container)
  }
}
