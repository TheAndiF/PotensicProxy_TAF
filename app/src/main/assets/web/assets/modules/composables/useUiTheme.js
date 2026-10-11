import { computed, ref, watch } from '../../vendor/vue.js';
const STORAGE_KEY = 'potensic-proxy-ui-theme';
const initial = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
const theme = ref(initial === 'light' || initial === 'gray' ? initial : 'dark');
function applyTheme(value) {
    if (typeof document !== 'undefined')
        document.documentElement.dataset.uiTheme = value;
    if (typeof localStorage !== 'undefined')
        localStorage.setItem(STORAGE_KEY, value);
}
watch(theme, applyTheme, { immediate: true });
export function useUiTheme() {
    const label = computed(() => theme.value === 'light' ? 'Light' : theme.value === 'gray' ? 'Gray' : 'Dark');
    return { theme, label };
}
