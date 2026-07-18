import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHydrated } from '../src/hooks/useHydrated'

describe('useHydrated', () => {
  it('becomes true after the component mounts', () => {
    const { result } = renderHook(() => useHydrated())
    expect(result.current).toBe(true)
  })
})
