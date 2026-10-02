import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

export type CameraMediaFile = {
  name: string
  type: 'photo' | 'video'
  timestamp?: number
  timestampSource?: 'camera' | 'filename'
  size?: number
  lrvSize?: number
  createTimeRaw?: string
}

export type GalleryState = 'CLOSED' | 'OPENING' | 'OPEN' | 'LOADING_COUNT' | 'LOADING_LIST' | 'READY' | 'ERROR'
export type CaptureModeState = 'UNKNOWN' | 'PHOTO' | 'VIDEO'
export type CaptureFlowState = 'IDLE' | 'SYNCING' | 'SWITCHING_TO_PHOTO' | 'SWITCHING_TO_VIDEO' | 'PHOTO_PENDING' | 'VIDEO_START_PENDING' | 'VIDEO_STOP_PENDING' | 'ERROR'

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
  const recording = ref(false)
  const recordingPending = ref(false)
  const captureMode = ref<CaptureModeState>('UNKNOWN')
  const captureFlowState = ref<CaptureFlowState>('IDLE')
  const capturePending = computed(() => !['IDLE', 'ERROR'].includes(captureFlowState.value))
  const lastCaptureMessage = ref('')
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

  function parseCameraCreateTime(value: unknown): number | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined
    const raw = value.trim()
    const direct = Date.parse(raw)
    if (Number.isFinite(direct)) return direct
    const m = raw.match(/(20\d{2})[-/.]?(\d{2})[-/.]?(\d{2})[ T_-]?(\d{2})[:._-]?(\d{2})[:._-]?(\d{2})/)
    if (!m) return undefined
    const [, y, mo, d, h, mi, sec] = m
    const ts = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)).getTime()
    return Number.isFinite(ts) ? ts : undefined
  }

  function setGalleryFiles(photoNames: string[], videoNames: string[]) {
    const previous = new Map(media.value.map(item => [item.name, item]))
    const make = (name: string, type: 'photo' | 'video'): CameraMediaFile => {
      const old = previous.get(name)
      if (old) return { ...old, type }
      const timestamp = timestampFromCameraName(name)
      return { name, type, timestamp, timestampSource: timestamp ? 'filename' : undefined }
    }
    photos.value = photoNames.map(name => make(name, 'photo'))
    videos.value = videoNames.map(name => make(name, 'video'))
    galleryLoading.value = false
    galleryState.value = 'READY'
    galleryError.value = ''
  }

  function applyGalleryMetadata(entries: Array<{ file?: string; len?: number; lrv_len?: number; createtime?: string }>) {
    const byName = new Map(entries.map(entry => [String(entry.file || '').trim(), entry]))
    const apply = (item: CameraMediaFile): CameraMediaFile => {
      const entry = byName.get(item.name.trim())
      if (!entry) return item
      const cameraTimestamp = parseCameraCreateTime(entry.createtime)
      return {
        ...item,
        timestamp: cameraTimestamp ?? item.timestamp,
        timestampSource: cameraTimestamp ? 'camera' : item.timestampSource,
        size: Number.isFinite(Number(entry.len)) ? Number(entry.len) : item.size,
        lrvSize: Number.isFinite(Number(entry.lrv_len)) ? Number(entry.lrv_len) : item.lrvSize,
        createTimeRaw: entry.createtime || item.createTimeRaw
      }
    }
    photos.value = photos.value.map(apply)
    videos.value = videos.value.map(apply)
  }

  function getGalleryFile(name: string): CameraMediaFile | undefined {
    return media.value.find(item => item.name === name)
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
    recording,
    recordingPending,
    captureMode,
    captureFlowState,
    capturePending,
    lastCaptureMessage,
    download,
    lastResponse,
    setGalleryFiles,
    applyGalleryMetadata,
    getGalleryFile
  }
})
