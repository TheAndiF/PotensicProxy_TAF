<template>
  <div class="video-container" ref="containerRef">
    <div class="video-viewport">
      <!-- High Performance WebCodecs / Canvas Video Feed -->
      <canvas
        v-show="(mode === 'webcodecs' || mode === 'snapshot') && hasFrame"
        ref="canvasRef"
        class="video-feed"
      ></canvas>

      <!-- Fallback MJPEG Stream Mode -->
      <img
        v-if="mode === 'mjpeg'"
        :src="mjpegUrl"
        @load="onMjpegLoad"
        @error="onMjpegError"
        class="video-feed"
        alt="Live FPV"
      />

      <!-- Placeholder / Waiting Screen with Diagnostics -->
      <div v-if="!hasFrame" class="video-placeholder">
        <div class="placeholder-icon">🚁</div>
        <div class="placeholder-title">{{ t('video.waitingTitle') }}</div>
        <div class="placeholder-desc">
          {{ t('video.waitingDesc') }}
        </div>

        <!-- Real-time Diagnostics Checklist -->
        <div class="diag-checklist">
          <div class="diag-item">
            <span class="diag-label">{{ t('video.usbPassthrough') }}</span>
            <span :class="store.connection.wsConnected ? 'diag-ok' : 'diag-warn'">
              {{ store.connection.wsConnected ? '✓ Ready' : '✗ Not Connected' }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">{{ t('video.androidUsb') }}</span>
            <span :class="store.connection.usbTransportOpen ? 'diag-ok' : 'diag-warn'">
              {{ store.connection.usbTransportOpen ? '✓ Open' : '✗ Closed' }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">{{ t('video.rxLink') }}</span>
            <span :class="store.connection.usbConnected ? 'diag-ok' : 'diag-warn'">
              {{ store.connection.usbConnected ? '✓ Connected (RX confirmed)' : (store.connection.usbTransportOpen ? '… Waiting for RX' : '✗ Not Connected') }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">{{ t('video.videoExtraction') }}</span>
            <span :class="videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted'">
              {{ videoStats.framesExtracted }} frames (I: {{ videoStats.iFrames }} / P: {{ videoStats.pFrames }})
              {{ videoStats.detectedCodec !== 'unknown' ? `[${videoStats.detectedCodec.toUpperCase()}]` : '' }}
            </span>
          </div>
          <div class="diag-item" v-if="feTraffic.length > 0">
            <span class="diag-label">{{ t('video.feTraffic') }}</span>
            <span class="diag-muted fe-traffic-list">
              <span v-for="item in feTraffic" :key="item.feType" class="fe-traffic-chip" :class="item.feType === 0x06 && item.bytesPerSecond > 0 ? 'diag-ok' : ''">
                {{ item.feTypeHex }}: {{ formatRate(item.bytesPerSecond) }} / {{ item.packetsPerSecond }} pkt/s
              </span>
            </span>
          </div>
          <div class="diag-item" v-if="parserStats.fePacketsParsed > 0">
            <span class="diag-label">{{ t('video.parser') }}</span>
            <span :class="videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted'">
              {{ currentDroneProfile }} / {{ currentVideoTransport }} | FE {{ parserStats.fePacketsParsed }}
              <template v-if="currentVideoTransport === 'w42'"> | w42 valid {{ parserStats.w42HeadersParsed }} / invalid {{ parserStats.w42InvalidHeaders }}</template>
              <template v-else> | ATOM frames {{ atomFramesParsed }}</template>
              | pending {{ parserStats.videoStreamBufferBytes }} B
              {{ parserStats.detectedCodec !== 'unknown' ? `| ${parserStats.detectedCodec.toUpperCase()}` : '' }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">{{ t('video.webcodecs') }}</span>
            <span :class="codecSupportOk ? 'diag-ok' : 'diag-warn'">
              {{ codecSupportText }}
            </span>
          </div>
          <div class="diag-item" v-if="decoderStats.framesDecoded > 0 || decoderStats.droppedFrames > 0">
            <span class="diag-label">{{ t('video.decoder') }}</span>
            <span :class="decoderStats.framesDecoded > 0 ? 'diag-ok' : 'diag-warn'">
              Decoded {{ decoderStats.framesDecoded }} frames (dropped: {{ decoderStats.droppedFrames }})
            </span>
          </div>
        </div>

        <div class="placeholder-actions">
          <button class="taf-btn taf-btn--primary" @click="activateSelectedLiveView">
            ⚡ Activate Stream ({{ currentDroneProfile }})
          </button>
          <button class="taf-btn" @click="requestIdr">
            🔄 Request Keyframe (IDR)
          </button>
          <button class="taf-btn" @click="toggleNextMode">
            🔀 Switch Mode (Current: {{ mode.toUpperCase() }})
          </button>
        </div>
      </div>

      <!-- Transparent status overlay; controls live in the collapsible side drawer. -->
      <div v-if="!compact" class="video-osd">
        <div class="osd-left">
          <span class="osd-tag" :class="hasFrame ? 'live' : 'waiting'">
            {{ hasFrame ? '● Live Video' : '○ Waiting for Stream' }}
          </span>
          <span class="osd-tag">Render: {{ mode.toUpperCase() }}</span>
          <span v-if="resolution" class="osd-tag">{{ resolution }}</span>
          <span v-if="fps > 0" class="osd-tag">{{ fps }} FPS</span>
          <span v-if="hasFrame && mode === 'webcodecs'" class="osd-tag highlight-tag">{{ (decoderStats.codecType || 'h265').toUpperCase() }} HW Decode</span>
        </div>
      </div>

      <div v-if="!compact" class="video-control-drawer" :class="{ open: controlsOpen }">
        <button class="drawer-toggle" type="button" :title="controlsOpen ? 'Hide LiveView controls' : 'Show LiveView controls'" @click="controlsOpen = !controlsOpen">{{ controlsOpen ? '›' : '‹' }}</button>
        <div v-if="controlsOpen" class="drawer-actions">
          <button class="osd-action-btn success" @click="activateSelectedLiveView">⚡ Stream</button>
          <button class="osd-action-btn" @click="requestIdr">🔄 I-Frame</button>
          <button class="osd-action-btn" @click="toggleNextMode">🔀 {{ mode.toUpperCase() }}</button>
          <button class="osd-action-btn" @click="toggleFullscreen" :title="t('video.fullscreenTitle')">⛶ {{ t('video.fullscreen') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'
import { VideoExtractor, ExtractedVideoFrame } from '../../protocol/VideoExtractor'
import { WebCodecsPlayer, VideoPlayerStats } from '../../video/WebCodecsPlayer'
import { useI18n } from '../../i18n'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const compact = computed(() => props.compact)
const controlsOpen = ref(false)
const store = useDroneStore()
const { t } = useI18n()
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Rendering Modes: 'webcodecs' (Direct H.265/H.264) | 'snapshot' (HTTP poll) | 'mjpeg' (HTTP MJPEG)
const mode = ref<'webcodecs' | 'snapshot' | 'mjpeg'>('webcodecs')
const hasFrame = ref(false)
const resolution = ref<string>('')
const fps = ref<number>(0)
const retryCounter = ref(0)
const webCodecsSupported = ref(WebCodecsPlayer.isSupported())
const h265Supported = ref(false)
const h264Supported = ref(false)
const currentDroneProfile = ref('ATOM')
const currentVideoTransport = ref('atom_h264_fe06')
const atomFramesParsed = ref(0)

// Video Extraction & Decoding State
const videoExtractor = VideoExtractor.getInstance()
let webCodecsPlayer: WebCodecsPlayer | null = null
let unsubscribeExtractor: (() => void) | null = null
let backendStatsTimer: any = null
let isDestroyed = false

type FeTrafficStat = {
  feType: number
  feTypeHex: string
  packets: number
  bytes: number
  payloadBytes: number
  bytesPerSecond: number
  packetsPerSecond: number
  lastPacketMs: number
  samples: string[]
}

const feTraffic = ref<FeTrafficStat[]>([])

type ParserStats = {
  usbChunksFed: number
  fePacketsParsed: number
  feStreamBufferBytes: number
  videoStreamBufferBytes: number
  w42MagicHits: number
  w42HeadersParsed: number
  w42InvalidHeaders: number
  w42IncompleteChunks: number
  streamBytesDropped: number
  detectedCodec: string
}

const parserStats = reactive<ParserStats>({
  usbChunksFed: 0,
  fePacketsParsed: 0,
  feStreamBufferBytes: 0,
  videoStreamBufferBytes: 0,
  w42MagicHits: 0,
  w42HeadersParsed: 0,
  w42InvalidHeaders: 0,
  w42IncompleteChunks: 0,
  streamBytesDropped: 0,
  detectedCodec: 'unknown'
})

const videoStats = reactive({
  packetsFed: 0,
  videoChunksParsed: 0,
  framesExtracted: 0,
  iFrames: 0,
  pFrames: 0,
  detectedCodec: 'unknown'
})

const decoderStats = reactive<VideoPlayerStats>({
  fps: 0,
  framesDecoded: 0,
  droppedFrames: 0,
  width: 0,
  height: 0,
  codec: 'Initializing...',
  codecType: 'none',
  latencyMs: 0
})

const codecSupportOk = computed(() => h265Supported.value || h264Supported.value)
const codecSupportText = computed(() => {
  if (!webCodecsSupported.value) return '✗ Browser does not support WebCodecs'
  const items = []
  if (h265Supported.value) items.push('✓ H.265')
  else items.push('✗ H.265 (extension required)')
  if (h264Supported.value) items.push('✓ H.264')
  else items.push('✗ H.264')
  return items.join(' | ')
})

// MJPEG stream URL
const mjpegUrl = computed(() => {
  const host = store.normalizedHost
  const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${httpProto}//${host}/api/video/mjpeg?t=${retryCounter.value}`
})

function onMjpegLoad() {
  hasFrame.value = true
}

function onMjpegError() {
  setTimeout(() => {
    if (!isDestroyed && mode.value === 'mjpeg') {
      retryCounter.value = Date.now()
    }
  }, 3000)
}

function toggleNextMode() {
  if (mode.value === 'webcodecs') {
    mode.value = 'snapshot'
    startSnapshotLoop()
    store.addLog('INFO', 'Switched to HTTP single-frame polling snapshot mode')
  } else if (mode.value === 'snapshot') {
    mode.value = 'mjpeg'
    stopSnapshotLoop()
    retryCounter.value = Date.now()
    store.addLog('INFO', 'Switched to MJPEG direct-stream mode')
  } else {
    mode.value = 'webcodecs'
    stopSnapshotLoop()
    initWebCodecs()
    store.addLog('INFO', 'Switched to WebCodecs hardware-accelerated mode (USB passthrough)')
  }
}

function activateSelectedLiveView() {
  const preferH265 = videoExtractor.getDroneModel() === 'ATOM_2'
  store.addLog('INFO', `Activating LiveView for ${videoExtractor.getDroneModel()}...`)
  DroneControlService.activateLiveView(preferH265)
}

function requestIdr() {
  store.addLog('INFO', 'Manual video keyframe request (IDR / 0xD9)')
  DroneControlService.requestIdr()
}

function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${bytesPerSecond} B/s`
}

async function refreshBackendVideoStats() {
  try {
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const res = await fetch(`${httpProto}//${host}/api/video/stats`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return
    const stats = await res.json()
    if (typeof stats.framesExtracted === 'number') videoStats.framesExtracted = stats.framesExtracted
    if (typeof stats.iFrames === 'number') videoStats.iFrames = stats.iFrames
    if (typeof stats.pFrames === 'number') videoStats.pFrames = stats.pFrames
    if (typeof stats.detectedCodec === 'string') videoStats.detectedCodec = stats.detectedCodec
    if (typeof stats.droneProfile === 'string') currentDroneProfile.value = stats.droneProfile
    if (typeof stats.videoTransport === 'string') currentVideoTransport.value = stats.videoTransport
    if (typeof stats.atomFramesParsed === 'number') atomFramesParsed.value = stats.atomFramesParsed
    if (stats.parser && typeof stats.parser === 'object') Object.assign(parserStats, stats.parser)
    const traffic = Array.isArray(stats.feTraffic) ? stats.feTraffic as FeTrafficStat[] : []
    feTraffic.value = traffic
      .filter(item => item.packets > 0)
      .sort((a, b) => b.bytesPerSecond - a.bytesPerSecond || b.bytes - a.bytes)
      .slice(0, 8)
  } catch (_) {
    // Diagnostics are best-effort and must never disturb video/control paths.
  }
}

function toggleFullscreen() {
  if (!containerRef.value) return
  if (!document.fullscreenElement) {
    const target = containerRef.value.closest('.flight-stage') as HTMLElement | null
    ;(target || containerRef.value).requestFullscreen?.().catch(() => {})
  } else {
    document.exitFullscreen?.().catch(() => {})
  }
}

// === WebCodecs Integration (USB FE 0x06 -> Direct H.265/H.264 Hardware Decoding) ===
async function initWebCodecs() {
  if (!WebCodecsPlayer.isSupported()) {
    console.warn('[VideoPlayer] WebCodecs not supported, falling back to snapshot mode')
    mode.value = 'snapshot'
    startSnapshotLoop()
    return
  }

  // Probe codec capability
  const probe = await WebCodecsPlayer.probeCodecs(1920, 1080)
  h265Supported.value = probe.h265
  h264Supported.value = probe.h264

  if (!webCodecsPlayer) {
    webCodecsPlayer = new WebCodecsPlayer()
  }

  webCodecsPlayer.setCanvas(canvasRef.value)
  // Follow the central drone protocol selection. ATOM capture is H.264 1280x720;
  // ATOM 2 keeps the existing H.265-first behavior.
  const atom = videoExtractor.getDroneModel() === 'ATOM'
  const preferH265 = !atom && probe.h265
  await webCodecsPlayer.init(atom ? 1280 : 1920, atom ? 720 : 1080, preferH265)

  webCodecsPlayer.onStats((stats: VideoPlayerStats) => {
    Object.assign(decoderStats, stats)
    fps.value = stats.fps
    if (stats.framesDecoded > 0) {
      hasFrame.value = true
    }
    if (stats.width > 0 && stats.height > 0) {
      resolution.value = `${stats.width}x${stats.height}`
    }
  })

  // Hook into VideoExtractor stream
  if (unsubscribeExtractor) unsubscribeExtractor()
  unsubscribeExtractor = videoExtractor.onFrame((frame: ExtractedVideoFrame) => {
    videoStats.packetsFed = videoExtractor.packetsFed
    videoStats.videoChunksParsed = videoExtractor.videoChunksParsed
    videoStats.framesExtracted = videoExtractor.framesExtracted
    videoStats.iFrames = videoExtractor.iFrames
    videoStats.pFrames = videoExtractor.pFrames
    videoStats.detectedCodec = videoExtractor.detectedCodec

    if (mode.value === 'webcodecs') {
      webCodecsPlayer?.feedFrame(frame)
    }
  })
}

// === Snapshot Loop Fallback ===
let isSnapshotLoopActive = false
async function startSnapshotLoop() {
  if (isSnapshotLoopActive) return
  isSnapshotLoopActive = true

  while (isSnapshotLoopActive && !isDestroyed && mode.value === 'snapshot') {
    if (store.activeTab !== 'cockpit') {
      await new Promise(r => setTimeout(r, 600))
      continue
    }

    try {
      const host = store.normalizedHost
      const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const res = await fetch(`${httpProto}//${host}/api/video/snapshot?t=${Date.now()}`, {
        signal: AbortSignal.timeout(2000)
      })

      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 500) {
          const bitmap = await createImageBitmap(blob)
          const canvas = canvasRef.value
          if (canvas) {
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
              canvas.width = bitmap.width
              canvas.height = bitmap.height
              resolution.value = `${bitmap.width}x${bitmap.height}`
            }
            const ctx = canvas.getContext('2d')
            if (ctx) ctx.drawImage(bitmap, 0, 0)
          }
          bitmap.close()
          hasFrame.value = true
        }
        await new Promise(r => setTimeout(r, 33))
      } else {
        await new Promise(r => setTimeout(r, 800))
      }
    } catch (_) {
      await new Promise(r => setTimeout(r, 1200))
    }
  }
  isSnapshotLoopActive = false
}

function stopSnapshotLoop() {
  isSnapshotLoopActive = false
}

function onDroneProfileChanged() {
  hasFrame.value = false
  videoStats.framesExtracted = 0
  videoStats.iFrames = 0
  videoStats.pFrames = 0
  if (mode.value === 'webcodecs') initWebCodecs()
}

onMounted(async () => {
  window.addEventListener('drone-profile-changed', onDroneProfileChanged)
  // 1. Initialize WebCodecs
  await initWebCodecs()

  // 2. LiveView activation and recovery are owned by the Android backend.
  //    Avoid duplicate browser-side activation/IDR loops that can repeatedly reset
  //    the camera encoder while FE 0x06 is already flowing. The buttons remain
  //    available for explicit manual H.265/H.264 tests.

  // 3. Backend FE/w42 diagnostics. This is intentionally independent from WebCodecs.
  await refreshBackendVideoStats()
  backendStatsTimer = setInterval(refreshBackendVideoStats, 1000)
})

onUnmounted(() => {
  window.removeEventListener('drone-profile-changed', onDroneProfileChanged)
  isDestroyed = true
  stopSnapshotLoop()
  if (unsubscribeExtractor) unsubscribeExtractor()
  if (webCodecsPlayer) webCodecsPlayer.destroy()
  if (backendStatsTimer) clearInterval(backendStatsTimer)
})
</script>

<style scoped>
.video-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #050508;
  position: relative;
  overflow: hidden;
  height: 100%;
}

.video-viewport {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--ui-bg-stage);
}

.video-feed {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

/* Waiting / Placeholder State */
.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 16, 0.95);
  color: var(--ui-text-strong);
  z-index: 5;
  text-align: center;
  padding: 24px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.placeholder-title {
  font-size: 16px;
  font-weight: 700;
  color: #00e5ff;
  margin-bottom: 8px;
}

.placeholder-desc {
  font-size: 12px;
  color: #888;
  max-width: 440px;
  margin-bottom: 16px;
  line-height: 1.6;
}

.diag-checklist {
  background: rgba(18, 22, 36, 0.8);
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--mono);
  font-size: 11px;
  text-align: left;
  min-width: 340px;
}

.diag-item {
  display: flex;
  justify-content: space-between;
}

.diag-label {
  color: #8c9bb0;
}

.diag-ok {
  color: var(--ui-success);
  font-weight: 600;
}

.diag-warn {
  color: var(--ui-warning);
}

.diag-muted {
  color: #526075;
}

.placeholder-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.video-osd {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--mono);
  font-size: 11px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  z-index: 10;
  pointer-events: none;
}

.osd-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osd-tag, .osd-item {
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(3px);
  height: 30px;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ddd;
}

.osd-tag.live {
  color: #00e676;
  border-color: rgba(0, 230, 118, 0.4);
}

.osd-tag.waiting {
  color: #ff9100;
  border-color: rgba(255, 145, 0, 0.4);
}

.highlight-tag {
  color: var(--ui-success);
  border-color: rgba(0, 255, 136, 0.4);
}


.osd-action-btn {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 229, 255, 0.4);
  color: #00e5ff;
  height: 30px;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-family: var(--mono);
  transition: all 0.2s;
}

.osd-action-btn:hover {
  background: rgba(0, 229, 255, 0.2);
  border-color: #00e5ff;
}

.osd-action-btn.success {
  border-color: rgba(0, 230, 118, 0.5);
  color: #00e676;
}

.osd-action-btn.success:hover {
  background: rgba(0, 230, 118, 0.2);
  border-color: #00e676;
}

.fe-traffic-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.fe-traffic-chip {
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.video-control-drawer{position:absolute;right:0;top:50%;z-index:25;display:flex;align-items:center;transform:translateY(-50%)}
.drawer-toggle{width:24px;height:50px;border:1px solid rgba(255,255,255,.18);border-right:0;border-radius:7px 0 0 7px;background:rgba(4,7,12,.42);color:#fff;cursor:pointer;backdrop-filter:blur(4px)}
.drawer-actions{display:flex;flex-direction:column;gap:6px;padding:7px;background:rgba(4,7,12,.42);border:1px solid rgba(255,255,255,.16);border-right:0;border-radius:7px 0 0 7px;backdrop-filter:blur(4px)}
.drawer-actions .osd-action-btn{width:94px;background:rgba(0,0,0,.35)}
:fullscreen .video-osd{top:14px;left:14px;right:14px}

</style>
