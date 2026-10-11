import { computed, ref, watch } from '../../vendor/vue.js';
const STORAGE_KEY = 'potensic.telemetryBar.fontSizePx';
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 10;
function sanitize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return DEFAULT_FONT_SIZE;
    return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(numeric)));
}
const fontSizePx = ref(sanitize(Number(localStorage.getItem(STORAGE_KEY) || DEFAULT_FONT_SIZE)));
watch(fontSizePx, value => {
    const normalized = sanitize(value);
    if (normalized !== value)
        fontSizePx.value = normalized;
    localStorage.setItem(STORAGE_KEY, String(normalized));
});
export function useTelemetryDisplaySettings() {
    const sanitizedFontSizePx = computed(() => sanitize(fontSizePx.value));
    return { fontSizePx, sanitizedFontSizePx, minFontSize: MIN_FONT_SIZE, maxFontSize: MAX_FONT_SIZE, defaultFontSize: DEFAULT_FONT_SIZE };
}
