<template>
  <div class="gallery-page">
    <div class="gallery-header">
      <div>
        <h2>🖼️ Gallery</h2>
        <p>Normal camera media and the separate Recognition image library.</p>
      </div>
      <div class="gallery-tabs" role="tablist" aria-label="Gallery type">
        <button :class="['filter-btn', { active: galleryTab === 'camera' }]" @click="galleryTab = 'camera'">Camera</button>
        <button :class="['filter-btn', { active: galleryTab === 'recognition' }]" @click="openRecognition">Recognition</button>
      </div>
    </div>

    <template v-if="galleryTab === 'camera'">
      <div class="gallery-toolbar ui-card">
        <div class="filter-group">
          <button :class="['filter-btn', { active: filter === 'all' }]" @click="filter = 'all'">All <span>{{ camera.media.length }}</span></button>
          <button :class="['filter-btn', { active: filter === 'photo' }]" @click="filter = 'photo'">Photos <span>{{ camera.photos.length }}</span></button>
          <button :class="['filter-btn', { active: filter === 'video' }]" @click="filter = 'video'">Videos <span>{{ camera.videos.length }}</span></button>
        </div>
        <div class="gallery-actions">
          <button v-if="!camera.galleryEntered" class="taf-btn" @click="CameraMediaService.enterGallery()">Open gallery</button>
          <button v-else class="taf-btn" @click="CameraMediaService.refreshGallery()">↻ Refresh</button>
          <button v-if="camera.galleryEntered" class="taf-btn" @click="CameraMediaService.quitGallery()">Close</button>
        </div>
      </div>

      <div class="gallery-toolbar ui-card">
        <div class="gallery-status">
          <span class="taf-status-field">Gallery: {{ camera.galleryState }}</span>
          <span v-if="camera.download.active" class="taf-status-field">Downloading {{ camera.download.fileName }} · {{ camera.download.progress }}%</span>
        </div>
        <small class="path-note">Photos → Pictures/PotensicProxy/Camera/ · Videos → Movies/PotensicProxy/Camera/</small>
      </div>

      <div v-if="camera.galleryError" class="download-error ui-card"><strong>Gallery error:</strong> {{ camera.galleryError }}</div>

      <div class="gallery-content ui-card">
        <div v-if="camera.galleryLoading && ['OPENING','LOADING_COUNT','LOADING_LIST'].includes(camera.galleryState)" class="gallery-empty">Reading media list… <small>{{ camera.galleryState }}</small></div>
        <div v-else-if="filteredMedia.length === 0" class="gallery-empty">
          {{ camera.galleryEntered ? 'No camera media loaded.' : 'Open the camera gallery to load photos and videos.' }}
        </div>
        <div v-else class="media-grid">
          <article v-for="file in filteredMedia" :key="file.type + ':' + file.name" class="media-card">
            <div class="media-preview" :class="file.type">
              <span>{{ file.type === 'photo' ? '🖼️' : '🎞️' }}</span>
              <small>{{ file.type === 'photo' ? 'PHOTO' : 'VIDEO' }}</small>
            </div>
            <div class="media-meta">
              <div class="media-name" :title="file.name">{{ file.name }}</div>
              <div class="media-type">{{ file.type === 'photo' ? 'Photo' : 'Video' }}</div>
              <div class="media-time">🕒 {{ formatRemoteTimestamp(file) }}</div>
            </div>
            <div class="media-actions">
              <button class="taf-btn taf-btn--compact" :disabled="camera.download.active" @click="download(file.name)">{{ file.type === 'photo' ? '↓ Save on Android' : '↓ Download' }}</button>
              <button class="taf-btn taf-btn--compact taf-btn--danger" :disabled="camera.download.active" @click="deleteFile(file.name)">Delete</button>
            </div>
          </article>
        </div>
      </div>

      <div v-if="camera.download.error" class="download-error ui-card">
        <strong>Download failed:</strong> {{ camera.download.error }}
      </div>

      <div class="protocol-note">Normal Camera path remains unchanged: camera/SD media is managed here. Saving a photo creates an Android copy in Pictures/PotensicProxy/Camera/ and does not automatically delete the drone source.</div>
    </template>

    <template v-else>
      <div class="recognition-controls ui-card">
        <div>
          <div class="ui-subtitle">Recognition capture sources</div>
          <small>Both modes use the same Recognition library and metadata schema; only the image source differs.</small>
        </div>
        <div class="reco-actions">
          <button class="taf-btn" :disabled="recoBusy || camera.download.active" @click="captureLiveReco">⚡ Live Reco</button>
          <button class="taf-btn" :disabled="recoBusy || camera.download.active" @click="captureDroneReco">📷 Drone Reco</button>
          <button class="taf-btn taf-btn--compact" :disabled="recoBusy" @click="loadRecognitionImages">↻ Refresh</button>
        </div>
      </div>

      <div class="mode-explainer">
        <div class="mode-card ui-card">
          <strong>Live Reco</strong>
          <span>Decoded LiveView frame → immediate Android save → Recognition pipeline.</span>
          <small>No temporary photo exists on the drone.</small>
        </div>
        <div class="mode-card ui-card">
          <strong>Drone Reco</strong>
          <span>Full camera photo → transfer → Android verification → drone delete acknowledgement.</span>
          <small>If transfer or verification fails, the source remains on the drone.</small>
        </div>
      </div>

      <div class="gallery-toolbar ui-card">
        <div class="filter-group">
          <button :class="['filter-btn', { active: recoFilter === 'all' }]" @click="recoFilter = 'all'">All <span>{{ recognitionImages.length }}</span></button>
          <button :class="['filter-btn', { active: recoFilter === 'live' }]" @click="recoFilter = 'live'">Live <span>{{ liveRecoCount }}</span></button>
          <button :class="['filter-btn', { active: recoFilter === 'drone' }]" @click="recoFilter = 'drone'">Drone <span>{{ droneRecoCount }}</span></button>
        </div>
        <div class="gallery-status">
          <span class="taf-status-field">Pictures/PotensicProxy/Recognition/</span>
          <span v-if="recoBusy" class="taf-status-field">{{ recoStatus }}</span>
        </div>
      </div>

      <div v-if="recoError" class="download-error ui-card"><strong>Recognition capture:</strong> {{ recoError }}</div>

      <div class="android-media ui-card">
        <div v-if="recognitionImages.length === 0" class="gallery-empty">No Recognition images saved yet.</div>
        <div v-else class="android-grid">
          <article v-for="item in filteredRecognitionImages" :key="item.id" class="android-card">
            <div class="reco-preview-wrap">
              <img v-if="item.mimeType !== 'image/x-adobe-dng'" :src="AndroidMediaService.imageUrl(item.id)" :alt="item.name">
              <div v-else class="android-raw-preview">RAW / DNG</div>
              <span :class="['source-badge', item.source === 'drone-reco' ? 'drone' : 'live']">{{ sourceLabel(item) }}</span>
              <span v-if="item.verified" class="verified-badge">✓ verified</span>
            </div>
            <div class="android-card-meta">
              <strong :title="item.name">{{ item.name }}</strong>
              <small>{{ formatSize(item.size) }} · {{ formatDate(item.captureTime || item.createdAt) }}</small>
              <small v-if="metadataSummary(item)">{{ metadataSummary(item) }}</small>
              <details v-if="item.metadata" class="metadata-details">
                <summary>Metadata</summary>
                <pre>{{ prettyMetadata(item) }}</pre>
              </details>
            </div>
          </article>
        </div>
      </div>

      <div class="protocol-note">Recognition entries store source, timestamp, available telemetry, GPS/height, attitude, gimbal, controls, camera state, connection state, SHA-256 and MediaStore verification status. Recognition model results can later be appended to the same metadata schema.</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CameraMediaService } from '../../services/CameraMediaService'
import { AndroidMediaService, type AndroidStoredImage } from '../../services/AndroidMediaService'
import { RecognitionCaptureService } from '../../services/RecognitionCaptureService'
import { useCameraStore, type CameraMediaFile } from '../../stores/useCameraStore'
import { useDroneStore } from '../../stores/useDroneStore'

const camera = useCameraStore()
const drone = useDroneStore()
const galleryTab = ref<'camera' | 'recognition'>('camera')
const filter = ref<'all' | 'photo' | 'video'>('all')
const recoFilter = ref<'all' | 'live' | 'drone'>('all')
const recognitionImages = ref<AndroidStoredImage[]>([])
const recoError = ref('')
const recoBusy = ref(false)
const recoStatus = ref('')

const filteredMedia = computed<CameraMediaFile[]>(() => {
  if (filter.value === 'photo') return camera.photos
  if (filter.value === 'video') return camera.videos
  return camera.media
})

const filteredRecognitionImages = computed(() => recognitionImages.value.filter(item => {
  if (recoFilter.value === 'live') return item.source === 'live-reco' || item.metadata?.source === 'LIVE_RECO'
  if (recoFilter.value === 'drone') return item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO'
  return true
}))
const liveRecoCount = computed(() => recognitionImages.value.filter(item => item.source === 'live-reco' || item.metadata?.source === 'LIVE_RECO').length)
const droneRecoCount = computed(() => recognitionImages.value.filter(item => item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO').length)

async function download(fileName: string) {
  try {
    await CameraMediaService.downloadFile(fileName, { library: 'camera', source: 'drone-camera' })
  } catch (e: any) {
    drone.addLog('ERROR', `Camera download failed: ${e?.message || e}`)
  }
}

async function openRecognition() {
  galleryTab.value = 'recognition'
  await loadRecognitionImages()
}

async function loadRecognitionImages() {
  try {
    recognitionImages.value = await AndroidMediaService.listImages('recognition')
    recoError.value = ''
  } catch (e: any) {
    recoError.value = `Could not read Recognition image index: ${e?.message || e}`
  }
}

async function captureLiveReco() {
  recoBusy.value = true
  recoStatus.value = 'Capturing LiveView frame…'
  recoError.value = ''
  try {
    await RecognitionCaptureService.captureLiveReco()
    recoStatus.value = 'Live Reco saved and verified'
    await loadRecognitionImages()
  } catch (e: any) {
    recoError.value = e?.message || String(e)
    drone.addLog('ERROR', `Live Reco failed: ${recoError.value}`)
  } finally {
    recoBusy.value = false
  }
}

async function captureDroneReco() {
  recoBusy.value = true
  recoStatus.value = 'Taking full-resolution camera photo…'
  recoError.value = ''
  try {
    await RecognitionCaptureService.captureDroneReco()
    recoStatus.value = 'Drone Reco transferred, verified and source delete acknowledged'
    await loadRecognitionImages()
  } catch (e: any) {
    recoError.value = e?.message || String(e)
    drone.addLog('ERROR', `Drone Reco failed: ${recoError.value}`)
  } finally {
    recoBusy.value = false
  }
}

function sourceLabel(item: AndroidStoredImage) {
  return item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO' ? 'DRONE' : 'LIVE'
}

function metadataSummary(item: AndroidStoredImage) {
  const metadata: any = item.metadata
  const telemetry = metadata?.telemetry
  if (!telemetry) return ''
  const parts: string[] = []
  if (telemetry.gpsLocationValid && Number.isFinite(telemetry.latitude) && Number.isFinite(telemetry.longitude)) {
    parts.push(`${Number(telemetry.latitude).toFixed(6)}, ${Number(telemetry.longitude).toFixed(6)}`)
  }
  if (Number.isFinite(telemetry.verticalDistance)) parts.push(`H ${Number(telemetry.verticalDistance).toFixed(1)} m`)
  if (Number.isFinite(telemetry.gimbalPitch)) parts.push(`Gimbal ${Number(telemetry.gimbalPitch).toFixed(1)}°`)
  return parts.join(' · ')
}

function prettyMetadata(item: AndroidStoredImage) {
  return JSON.stringify({ image: item.image, sha256: item.sha256, verified: item.verified, ...item.metadata }, null, 2)
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(value: number) { return value ? new Date(value).toLocaleString() : '—' }
function formatRemoteTimestamp(file: CameraMediaFile) {
  return file.timestamp ? `${new Date(file.timestamp).toLocaleString()}${file.timestampSource === 'camera' ? ' · Kamera' : ' · Dateiname'}` : 'Zeitstempel nicht verfügbar'
}
function onAndroidMediaSaved(event: Event) {
  const saved = (event as CustomEvent<AndroidStoredImage>).detail
  if (saved?.library === 'recognition') void loadRecognitionImages()
}

onMounted(() => window.addEventListener('taf-android-media-saved', onAndroidMediaSaved))
onBeforeUnmount(() => window.removeEventListener('taf-android-media-saved', onAndroidMediaSaved))

function deleteFile(fileName: string) {
  if (window.confirm(`Delete camera file "${fileName}"?`)) CameraMediaService.deleteFile(fileName)
}
</script>

<style scoped>
.gallery-page{height:100%;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:14px;background:var(--ui-bg-stage)}
.gallery-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.gallery-header h2{margin:0;color:var(--cyan)}.gallery-header p{margin:4px 0 0;color:var(--ui-text-muted);font-size:12px}.gallery-actions,.gallery-tabs,.reco-actions{display:flex;gap:7px;flex-wrap:wrap}
.gallery-toolbar{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.filter-group{display:flex;gap:6px;flex-wrap:wrap}.filter-btn{height:30px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control);color:var(--ui-text);padding:0 10px;cursor:pointer}.filter-btn.active{border-color:var(--cyan);color:var(--cyan)}.filter-btn span{opacity:.7;margin-left:4px}.gallery-status{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.path-note{color:var(--ui-text-muted)}
.gallery-content{padding:12px;min-height:260px}.gallery-empty{min-height:180px;display:grid;place-items:center;color:var(--ui-text-muted);font-size:13px}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.media-card{border:1px solid var(--ui-border-control);border-radius:8px;background:var(--ui-bg-control-strong);overflow:hidden}.media-preview{height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:var(--ui-bg-stage);font-size:36px}.media-preview small{font-size:10px;letter-spacing:1px;color:var(--ui-text-muted)}.media-meta{padding:10px}.media-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px var(--ui-font-mono);color:var(--ui-text)}.media-type{margin-top:4px;font-size:10px;color:var(--ui-text-muted)}.media-time{margin-top:4px;font-size:10px;color:var(--ui-text-muted)}.media-actions{display:flex;gap:6px;padding:0 10px 10px}.media-actions .taf-btn{flex:1}.download-error{padding:10px;color:var(--ui-danger)}.protocol-note{font-size:10px;color:var(--ui-text-muted);opacity:.85}
.recognition-controls{padding:12px;display:flex;align-items:center;justify-content:space-between;gap:14px}.recognition-controls small{color:var(--ui-text-muted)}.mode-explainer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mode-card{padding:12px;display:flex;flex-direction:column;gap:5px}.mode-card strong{color:var(--cyan)}.mode-card span{font-size:12px}.mode-card small{color:var(--ui-text-muted);font-size:10px}
.android-media{padding:12px}.android-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.android-card{border:1px solid var(--ui-border-control);border-radius:8px;overflow:hidden;background:var(--ui-bg-control-strong)}.reco-preview-wrap{position:relative}.android-card img{display:block;width:100%;height:150px;object-fit:cover;background:var(--ui-bg-stage)}.android-raw-preview{height:150px;display:grid;place-items:center;background:var(--ui-bg-stage);color:var(--ui-text-muted);font:12px var(--ui-font-mono)}.source-badge,.verified-badge{position:absolute;top:7px;padding:3px 6px;border-radius:4px;background:var(--ui-bg-control-strong);border:1px solid var(--ui-border-control);font:9px var(--ui-font-mono)}.source-badge{left:7px;color:var(--cyan)}.verified-badge{right:7px;color:var(--ui-success,#53d18d)}.android-card-meta{padding:9px;display:flex;flex-direction:column;gap:4px}.android-card-meta strong{font:11px var(--ui-font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.android-card-meta small{font-size:10px;color:var(--ui-text-muted)}.metadata-details{margin-top:5px;font-size:10px}.metadata-details summary{cursor:pointer;color:var(--cyan)}.metadata-details pre{max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--ui-bg-stage);padding:8px;border-radius:5px;font:9px var(--ui-font-mono)}
@media (max-width:760px){.gallery-header,.gallery-toolbar,.recognition-controls{align-items:flex-start;flex-direction:column}.gallery-status{justify-content:flex-start}.mode-explainer{grid-template-columns:1fr}}
</style>
