import { ref, watch } from '../../vendor/vue.js';
const STORAGE_KEY = 'potensic.cockpitViewSettings.v1';
function loadSettings() {
    const fallback = {
        mainView: 'video',
        pipVisible: true,
        pipPosition: 'controls',
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return fallback;
        const parsed = JSON.parse(raw);
        return {
            mainView: parsed.mainView === 'map' ? 'map' : 'video',
            pipVisible: parsed.pipVisible !== false,
            pipPosition: parsed.pipPosition === 'overlay' ? 'overlay' : 'controls',
        };
    }
    catch {
        return fallback;
    }
}
const initial = loadSettings();
const mainView = ref(initial.mainView);
const pipVisible = ref(initial.pipVisible);
const pipPosition = ref(initial.pipPosition);
watch([mainView, pipVisible, pipPosition], () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            mainView: mainView.value,
            pipVisible: pipVisible.value,
            pipPosition: pipPosition.value,
        }));
    }
    catch {
        // These UI preferences are non-critical; keep the in-memory state if storage is unavailable.
    }
}, { flush: 'sync' });
export function useCockpitViewSettings() {
    function swapViews() {
        mainView.value = mainView.value === 'video' ? 'map' : 'video';
    }
    return { mainView, pipVisible, pipPosition, swapViews };
}
