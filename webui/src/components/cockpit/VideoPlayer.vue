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
        <div class="placeholder-title">Waiting for drone video stream</div>
        <div class="placeholder-desc">
          Currently using direct frontend USB passthrough mode.
          If the aircraft is powered on and paired, click Activate Stream below to send the initialization sequence.
        </div>

        <!-- Real-time Diagnostics Checklist -->
        <div class="diag-checklist">
          <div class="diag-item">
            <span class="diag-label">USB Passthrough Channel (WebSocket):</span>
            <span :class="store.connection.wsConnected ? 'diag-ok' : 'diag-warn'">
              {{ store.connection.wsConnected ? '✓ Ready' : '✗ Not Connected' }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">0x06 Video Frame Extraction (FE/w42):</span>
            <span :class="videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted'">
              {{ videoStats.framesExtracted }} frames (I: {{ videoStats.iFrames }} / P: {{ videoStats.pFrames }})
              {{ videoStats.detectedCodec !== 'unknown' ? `[${videoStats.detectedCodec.toUpperCase()}]` : '' }}
            </span>
          </div>
          <div class="diag-item">
            <span class="diag-label">Browser Hardware Decode Support (WebCodecs):</span>
            <span :class="codecSupportOk ? 'diag-ok' : 'diag-warn'">
              {{ codecSupportText }}
            </span>
          </div>
          <div class="diag-item" v-if="decoderStats.framesDecoded > 0 || decoderStats.droppedFrames > 0">
            <span class="diag-label">Decoder Status:</span>
            <span :class="decoderStats.framesDecoded > 0 ? 'diag-ok' : 'diag-warn'">
              Decoded {{ decoderStats.framesDecoded }} frames (dropped: {{ decoderStats.droppedFrames }})
            </span>
          </div>
        </div>

        <div class="placeholder-actions">
          <button class="taf-btn taf-btn--primary" @click="() => activateLiveView(true)">
            ⚡ Activate Stream (H.265)
          </button>
          <button class="taf-btn taf-btn--success" @click="() => activateLiveView(false)">
            ⚡ Activate Stream (H.264 Compatible)
          </button>
          <button class="taf-btn" @click="requestIdr">
            🔄 Request Keyframe (IDR)
          </button>
          <button class="taf-btn" @click="toggleNextMode">
            🔀 Switch Mode (Current: {{ mode.toUpperCase() }})
          </button>
        </div>
      </div>

      <!-- Video OSD Header Overlay -->
      <div class="video-osd">
        <div class="osd-left">
          <span class="osd-tag" :class="hasFrame ? 'live' : 'waiting'">
            {{ hasFrame ? '● Live Video' : '○ Waiting for Stream' }}
          </span>
          <span
            class="osd-tag mode-tag"
            @click="toggleNextMode"
            :title="'Click to change render mode (Current: ' + mode.toUpperCase() + ')'"
          >
            Render: {{ mode.toUpperCase() }}
          </span>
          <span v-if="resolution" class="osd-tag">
            {{ resolution }}
          </span>
          <span v-if="fps > 0" class="osd-tag">
            {{ fps }} FPS
          </span>
          <span v-if="hasFrame && mode === 'webcodecs'" class="osd-tag highlight-tag">
            {{ (decoderStats.codecType || 'h265').toUpperCase() }} HW Decode
          </span>
          <span v-if="hasFrame && decoderStats.framesDecoded > 0" class="osd-tag">
            {{ decoderStats.framesDecoded }} 帧
          </span>
        </div>

        <div class="osd-right">
          <button class="osd-action-btn" @click="() => activateLiveView(true)" title="Send full initialization sequence for H.265">
            ⚡ H.265 Stream
          </button>
          <button class="osd-action-btn success" @click="() => activateLiveView(false)" title="Send full initialization sequence for H.264 compatibility">
            ⚡ H.264 Stream
          </button>
          <button class="osd-action-btn" @click="requestIdr" title="Request Keyframe (IDR)">
            🔄 Request I-Frame
          </button>
          <button class="osd-action-btn" @click="toggleFullscreen" title="View video fullscreen">
            ⛶ Fullscreen
          </button>
          <span class="osd-item">
            Battery: {{ store.telemetry.battery }}% ({{ store.telemetry.flightVoltage?.toFixed(1) || '--' }}V)
          </span>
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

const store = useDroneStore()
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

// Video Extraction & Decoding State
const videoExtractor = VideoExtractor.getInstance()
let webCodecsPlayer: WebCodecsPlayer | null = null
let unsubscribeExtractor: (() => void) | null = null
let autoIdrTimer: any = null
let isDestroyed = false

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
    store.addLog('INFO', '已切换为 HTTP 单帧轮询快照模式')
  } else if (mode.value === 'snapshot') {
    mode.value = 'mjpeg'
    stopSnapshotLoop()
    retryCounter.value = Date.now()
    store.addLog('INFO', '已切换为 MJPEG 直流模式')
  } else {
    mode.value = 'webcodecs'
    stopSnapshotLoop()
    initWebCodecs()
    store.addLog('INFO', '已切换为 WebCodecs 硬件加速模式 (USB 直通)')
  }
}

function activateLiveView(preferH265 = true) {
  const codecName = preferH265 ? 'H.265' : 'H.264 兼容模式'
  store.addLog('INFO', `正在下发无人机相机推流激活序列 (${codecName})...`)
  DroneControlService.activateLiveView(preferH265)
}

function requestIdr() {
  store.addLog('INFO', '手动请求图传关键帧 (IDR)')
  DroneControlService.requestIdr()
}

function toggleFullscreen() {
  if (!containerRef.value) return
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen?.().catch(() => {})
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
  // If H.265 is supported, prefer it; otherwise start in H.264
  const preferH265 = probe.h265
  await webCodecsPlayer.init(1920, 1080, preferH265)

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

onMounted(async () => {
  // 1. Initialize WebCodecs
  await initWebCodecs()

  // 2. Auto-kickstart LiveView camera stream (prefers H.265 if supported, otherwise H.264)
  setTimeout(() => {
    const preferH265 = h265Supported.value
    activateLiveView(preferH265)
  }, 400)

  // 3. Auto-retry IDR keyframe if no frames decoded after 5s
  autoIdrTimer = setInterval(() => {
    if (!hasFrame.value && store.connection.wsConnected) {
      DroneControlService.requestIdr()
    }
  }, 5000)
})

onUnmounted(() => {
  isDestroyed = true
  stopSnapshotLoop()
  if (unsubscribeExtractor) unsubscribeExtractor()
  if (webCodecsPlayer) webCodecsPlayer.destroy()
  if (autoIdrTimer) clearInterval(autoIdrTimer)
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
  background: #000;
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
  color: #fff;
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
  border: 1px solid #232a40;
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
  color: #00ff88;
  font-weight: 600;
}

.diag-warn {
  color: #ffb703;
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

.osd-left, .osd-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osd-tag, .osd-item {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  min-height: 28px;
  padding: 4px 8px;
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
  color: #00ff88;
  border-color: rgba(0, 255, 136, 0.4);
}

.mode-tag {
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
}

.mode-tag:hover {
  border-color: #00e5ff;
  color: #00e5ff;
}

.osd-action-btn {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 229, 255, 0.4);
  color: #00e5ff;
  min-height: 28px;
  padding: 4px 8px;
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
</style>


