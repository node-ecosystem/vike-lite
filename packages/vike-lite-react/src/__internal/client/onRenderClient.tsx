import type { ComponentType } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import type { PageContextClient } from 'vike-lite'
import { buildInitialClientContext, resolveHydrationView } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { RouterApp } from './RouterApp'

export async function onRenderClient(clientOptions: {
  routes: VikeState['routes'],
  errorRoute: VikeState['errorRoute'],
  hydration: boolean
}) {
  const container = document.querySelector('#root') as HTMLDivElement
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration) as PageContextClient
  const initialView = await resolveHydrationView<ComponentType<any>>(initialContext, isHydration, clientOptions.routes, clientOptions.errorRoute)

  const app = (
    <RouterApp
      {...clientOptions}
      initialView={initialView}
      initialContext={initialContext}
      initialUrl={globalThis.location.href}
    />
  )

  if (isHydration) {
    hydrateRoot(container, app)
  } else {
    container.replaceChildren()
    createRoot(container).render(app)
  }
}
