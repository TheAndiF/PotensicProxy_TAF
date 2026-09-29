import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

export type CameraMediaFile = {
  name: string
  type: 'photo' | 'video'
}

export const useCameraStore = defineStore('camera', () => {
  const videoResolutionIndex = ref<number | null>(null)
  const photoResolutionIndex = ref<number | null>(null)
  const videoEv = ref<number | null>(null)
  const photoEv = ref<number | null>(null)
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

  function setGalleryFiles(photoNames: string[], videoNames: string[]) {
    photos.value = photoNames.map(name => ({ name, type: 'photo' as const }))
    videos.value = videoNames.map(name => ({ name, type: 'video' as const }))
    galleryLoading.value = false
  }

  return {
    videoResolutionIndex,
    photoResolutionIndex,
    videoEv,
    photoEv,
    manualMode,
    sd,
    galleryEntered,
    photos,
    videos,
    media,
    galleryLoading,
    download,
    lastResponse,
    setGalleryFiles
  }
})
