import { mount, hydrate } from 'svelte'
import type { PageContextClient } from 'vike-lite'
import { buildInitialClientContext, resolveHydrationView } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import RouterApp from './RouterApp.svelte'

export async function onRenderClient(clientOptions: { routes: VikeState['routes'], errorRoute: VikeState['errorRoute'], hydration: boolean }) {
  const container = document.querySelector('#root') as HTMLDivElement
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration) as PageContextClient
  const initialView = await resolveHydrationView(initialContext, isHydration, clientOptions.routes, clientOptions.errorRoute)

  const props = {
    ...clientOptions,
    initialView,
    initialContext,
    initialUrl: globalThis.location.href
  }

  if (isHydration) {
    // hydrate() upgrades the server-rendered DOM in place, matching Svelte 5's hydration
    // markers (HTML comments) left by render() — same shape/contract as mount().
    hydrate(RouterApp, { target: container, props })
  } else {
    // Client Takeover: discard whatever the server rendered into the shell and mount fresh
    container.replaceChildren()
    mount(RouterApp, { target: container, props })
  }
}
