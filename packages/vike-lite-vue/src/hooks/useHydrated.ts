import { ref, onMounted, type Ref } from 'vue'

export function useHydrated(): Ref<boolean> {
  const hydrated = ref(false)
  onMounted(() => { hydrated.value = true })
  return hydrated
}
