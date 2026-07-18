import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useHydrated } from '../src/hooks/useHydrated'

const TestComponent = defineComponent({
  setup() {
    const hydrated = useHydrated()
    return () => h('div', hydrated.value ? 'hydrated' : 'pending')
  }
})

describe('useHydrated', () => {
  it('becomes hydrated after mount', async () => {
    const wrapper = mount(TestComponent)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('hydrated')
  })
})
