import { ref, watch } from 'vue'

export type MainCockpitView = 'video' | 'map'
export type PipPosition = 'overlay' | 'controls'

const STORAGE_KEY = 'potensic.cockpitViewSettings.v1'

interface StoredCockpitViewSettings {
  mainView: MainCockpitView
  pipVisible: boolean
  pipPosition: PipPosition
}

function loadSettings(): StoredCockpitViewSettings {
  const fallback: StoredCockpitViewSettings = {
    mainView: 'video',
    pipVisible: true,
    pipPosition: 'controls',
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredCockpitViewSettings>
    return {
      mainView: parsed.mainView === 'map' ? 'map' : 'video',
      pipVisible: parsed.pipVisible !== false,
      pipPosition: parsed.pipPosition === 'overlay' ? 'overlay' : 'controls',
    }
  } catch {
    return fallback
  }
}

const initial = loadSettings()
const mainView = ref<MainCockpitView>(initial.mainView)
const pipVisible = ref(initial.pipVisible)
const pipPosition = ref<PipPosition>(initial.pipPosition)

watch([mainView, pipVisible, pipPosition], () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mainView: mainView.value,
      pipVisible: pipVisible.value,
      pipPosition: pipPosition.value,
    }))
  } catch {
    // These UI preferences are non-critical; keep the in-memory state if storage is unavailable.
  }
}, { flush: 'sync' })

export function useCockpitViewSettings() {
  function swapViews() {
    mainView.value = mainView.value === 'video' ? 'map' : 'video'
  }

  return { mainView, pipVisible, pipPosition, swapViews }
}
