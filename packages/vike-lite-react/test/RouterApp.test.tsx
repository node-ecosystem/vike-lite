import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RouterApp } from '../src/__internal/client/RouterApp'

afterEach(cleanup)

describe('vike-lite-react RouterApp — null Page guard', () => {
  it('renders nothing (no error-boundary fallback) when the current view has no Page yet', () => {
    // Regression test: `view.Page` is `ComponentType<any> | null` — e.g. during a
    // "client takeover" first render (hydration:false), the initial view is
    // `{ Page: null, Layout: null, Head: null }` until the route-loading effect
    // resolves. `RouterApp` used to render `<Page />` unconditionally, which
    // crashes React ("Element type is invalid: expected a string... but got:
    // null") the instant that state is reached. Because it's wrapped in an error
    // boundary, the crash doesn't propagate out of render() — it shows up as the
    // boundary's fallback UI instead, so we assert on that rather than toThrow().
    const { container } = render(
      <RouterApp
        routes={[]}
        errorRoute={null}
        initialView={{ Page: null, Layout: null, Head: null }}
        initialContext={{
          urlPathname: '/',
          urlOriginal: 'http://localhost/',
          search: '',
          routeParams: {},
          isClientSide: true,
          isHydration: false
        } as any}
        initialUrl="http://localhost/"
      />
    )

    expect(container.textContent).not.toMatch(/Element type is invalid/)
    expect(container.textContent).toBe('')
  })

  it('renders the Page (wrapped in Layout) once both are present', () => {
    const Page = () => <div data-testid="page">page content</div>
    const Layout = ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>

    const { getByTestId } = render(
      <RouterApp
        routes={[]}
        errorRoute={null}
        initialView={{ Page, Layout, Head: null }}
        initialContext={{
          urlPathname: '/',
          urlOriginal: 'http://localhost/',
          search: '',
          routeParams: {},
          isClientSide: true,
          isHydration: false
        } as any}
        initialUrl="http://localhost/"
      />
    )

    expect(getByTestId('layout')).toContainElement(getByTestId('page'))
  })
})
