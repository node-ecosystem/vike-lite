import { describe, it, expect } from 'vitest'
import { render } from '@solidjs/testing-library'
import { useHydrated } from '../src/hooks/useHydrated'

function TestComponent() {
  const isHydrated = useHydrated()
  return <div data-testid="status">{isHydrated() ? 'hydrated' : 'pending'}</div>
}

describe('useHydrated', () => {
  it('becomes hydrated after mount', async () => {
    const { findByTestId } = render(() => <TestComponent />)
    const el = await findByTestId('status')
    expect(el.textContent).toBe('hydrated')
  })
})
