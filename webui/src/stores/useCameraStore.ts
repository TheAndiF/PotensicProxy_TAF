import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

export type CameraMediaFile = {
  name: string
  type: 'photo' | 'video'
  timestamp?: number
  timestampSource?: 'filename'
}

export type GalleryState = 'CLOSED' | 'OPENING' | 'OPEN' | 'LOADING_COUNT' | 'LOADING_LIST' | 'READY' | 'ERROR'

export const useCameraStore = defineStore('camera', () => {
  const videoResolutionIndex = ref<number | null>(null)
  const photoResolutionIndex = ref<number | null>(null)
  const videoEv = ref<number | null>(null)
  const photoEv = ref<number | null>(null)
  const zoomTarget = ref(1)
  const zoomActual = ref<number | null>(null)
  const zoomMax = ref(4)
  const zoomMaxSource = ref<'fallback' | 'camera'>('fallback')
  const zoomPending = ref(false)
  const zoomLastUpdate = ref<number | null>(null)
  const manualMode = reactive({
    loaded: false,
    manual: false,
    shutterDen: 100,
    iso: 100,
    manualWb: false,
    wb: 5600,
    raw: false,
    photoOsd: false,
    photoGps: false
  })

  const sd = reactive({
    state: null as number | null,
    freeMb: null as number | null,
    totalMb: null as number | null,
    lastStatus: ''
  })

  const galleryEntered = ref(false)
  const galleryState = ref<GalleryState>('CLOSED')
  const galleryError = ref('')
  const photos = ref<CameraMediaFile[]>([])
  const videos = ref<CameraMediaFile[]>([])
  const galleryLoading = ref(false)
  const download = reactive({
    fileName: '',
    progress: 0,
    active: false,
    error: ''
  })
  const lastResponse = ref('')

  const media = computed(() => [...videos.value, ...photos.value])

  function timestampFromCameraName(name: string): number | undefined {
    // Common camera filename forms: ...YYYYMMDD_HHMMSS..., ...YYYY-MM-DD_HH-MM-SS...
    // and compact ...YYYYMMDDHHMMSS.... Keep this filename-derived only; do not invent a time.
    const separated = name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[T_ -]?(\d{2})[-_:]?(\d{2})[-_:]?(\d{2})/)
    if (!separated) return undefined
    const [, y, mo, d, h, mi, sec] = separated
    const ts = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)).getTime()
    return Number.isFinite(ts) ? ts : undefined
  }

  function setGalleryFiles(photoNames: string[], videoNames: string[]) {
    photos.value = photoNames.map(name => ({ name, type: 'photo' as const, timestamp: timestampFromCameraName(name), timestampSource: 'filename' as const }))
    videos.value = videoNames.map(name => ({ name, type: 'video' as const, timestamp: timestampFromCameraName(name), timestampSource: 'filename' as const }))
    galleryLoading.value = false
    galleryState.value = 'READY'
    galleryError.value = ''
  }

  return {
    videoResolutionIndex,
    photoResolutionIndex,
    videoEv,
    photoEv,
    zoomTarget,
    zoomActual,
    zoomMax,
    zoomMaxSource,
    zoomPending,
    zoomLastUpdate,
    manualMode,
    sd,
    galleryEntered,
    galleryState,
    galleryError,
    photos,
    videos,
    media,
    galleryLoading,
    download,
    lastResponse,
    setGalleryFiles
  }
})
