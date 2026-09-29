import { computed, ref, watch } from 'vue'

export type UiTheme = 'dark' | 'light' | 'gray'

const STORAGE_KEY = 'potensic-proxy-ui-theme'
const initial = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as UiTheme | null
const theme = ref<UiTheme>(initial === 'light' || initial === 'gray' ? initial : 'dark')

function applyTheme(value: UiTheme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.uiTheme = value
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value)
}

watch(theme, applyTheme, { immediate: true })

export function useUiTheme() {
  const label = computed(() => theme.value === 'light' ? 'Light' : theme.value === 'gray' ? 'Gray' : 'Dark')
  return { theme, label }
}
