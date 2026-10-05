<template>
  <section class="camera-card" aria-label="Camera control preview">
    <div class="camera-header">
      <span class="panel-title">📷 Camera Control</span>
    </div>

    <div class="camera-grid">
      <div class="control-column">
        <div class="sub-title">Gimbal</div>
        <div class="control-body">
          <div
            ref="dialRef"
            class="vertical-dial"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <div class="axis-line"></div>
            <div class="limit-mark top">+100%</div>
            <div class="center-mark">0</div>
            <div class="limit-mark bottom">-100%</div>
            <div class="control-knob" :style="gimbalKnobStyle"><span class="knob-dot"></span></div>
          </div>
          <div class="presets">
            <span class="preset-label">Preset</span>
            <button class="taf-btn taf-btn--compact" type="button" @click="setPresetAngle(0)">0°</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setPresetAngle(-45)">-45°</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setPresetAngle(-90)">-90°</button>
          </div>
        </div>
        <div class="value-grid">
          <div><span class="value-label">Tempo</span><strong>{{ gimbalCommandText }}</strong></div>
          <div><span class="value-label">Ist</span><strong>{{ actualGimbalText }}</strong></div>
        </div>
        <div class="feedback-state">{{ gimbalStatus }}</div>
      </div>

      <div class="control-column">
        <div class="sub-title">Zoom</div>
        <div class="control-body">
          <div
            ref="zoomDialRef"
            class="vertical-dial"
            @pointerdown="onZoomPointerDown"
            @pointermove="onZoomPointerMove"
            @pointerup="onZoomPointerUp"
            @pointercancel="onZoomPointerUp"
          >
            <div class="axis-line"></div>
            <div class="limit-mark top">{{ MAX_ZOOM.toFixed(2) }}x</div>
            <div class="limit-mark bottom">{{ MIN_ZOOM.toFixed(2) }}x</div>
            <div class="control-knob" :style="zoomKnobStyle"><span class="knob-dot"></span></div>
          </div>
          <div class="presets">
            <span class="preset-label">Preset</span>
            <button class="taf-btn taf-btn--compact" type="button" @click="setZoom(1)">1.0x</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setZoom(1.5)">1.5x</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setZoom(2)">2.0x</button>
          </div>
        </div>
        <div class="value-grid">
          <div><span class="value-label">Soll</span><input class="zoom-number" type="number" :min="MIN_ZOOM" :max="MAX_ZOOM" step="0.01" :value="targetZoom.toFixed(2)" @change="onZoomNumberChange" /></div>
          <div><span class="value-label">Ist</span><strong>{{ actualZoomText }}</strong></div>
        </div>
        <div class="feedback-state">{{ zoomStatus }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCameraStore } from '../../stores/useCameraStore'
import { CameraMediaService } from '../../services/CameraMediaService'
import { DroneControlService } from '../../services/DroneControlService'
import { useDroneStore } from '../../stores/useDroneStore'

const MIN_ZOOM = 1
const camera = useCameraStore()
const store = useDroneStore()
const MAX_ZOOM = computed(() => Math.max(MIN_ZOOM, camera.zoomMax || 4))
const pendingGimbalAngle = ref<0 | -45 | -90 | null>(null)
const targetZoom = computed(() => camera.zoomTarget)

const actualGimbal = computed<number | null>(() => store.telemetry.gimbalStateValid ? (store.telemetry.gimbalPitch ?? null) : null)
const actualZoom = computed(() => camera.zoomActual)

const dialRef = ref<HTMLElement | null>(null)
const zoomDialRef = ref<HTMLElement | null>(null)
let dragging = false
let zoomDragging = false

const gimbalKnobStyle = computed(() => {
  const travel = 70
  const command = Math.max(-1000, Math.min(1000, store.gimbalControl.command))
  const y = -(command / 1000) * (travel / 2)
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
})

const zoomKnobStyle = computed(() => {
  const normalized = (targetZoom.value - MIN_ZOOM) / Math.max(0.01, MAX_ZOOM.value - MIN_ZOOM)
  const travel = 70
  const y = travel / 2 - normalized * travel
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
})

const actualGimbalText = computed(() => actualGimbal.value == null ? '--' : `${actualGimbal.value.toFixed(0)}°`)
const gimbalCommandText = computed(() => `${store.gimbalControl.command >= 0 ? '+' : ''}${Math.round(store.gimbalControl.command / 10)}%`)
const actualZoomText = computed(() => actualZoom.value == null ? '--' : `${actualZoom.value.toFixed(2)}x`)
const gimbalStatus = computed(() => pendingGimbalAngle.value != null ? 'Warte auf Gimbal-Einstellungen …' : store.gimbalControl.active ? (store.gimbalControl.command > 0 ? 'Fährt aufwärts' : store.gimbalControl.command < 0 ? 'Fährt abwärts' : 'Neutral') : actualGimbal.value == null ? 'Keine Rückmeldung' : 'Bereit')
const zoomStatus = computed(() => camera.zoomPending ? 'Warte auf Kamera …' : actualZoom.value == null ? 'Keine Rückmeldung' : Math.abs(actualZoom.value - targetZoom.value) <= 0.02 ? 'Erreicht' : 'Abweichung')

function setPresetAngle(value: 0 | -45 | -90) {
  store.gimbalControl.targetAngle = value
  const sent = DroneControlService.setGimbalPitchPreset(value)
  pendingGimbalAngle.value = sent ? null : value
}


let lastZoomSend = 0
let queuedZoomTimer: ReturnType<typeof setTimeout> | null = null
function setZoom(value: number, immediate = false) {
  if (!Number.isFinite(value)) return
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM.value, Math.round(value * 100) / 100))
  camera.zoomTarget = clamped
  const now = Date.now()
  const due = immediate || now - lastZoomSend >= 33
  if (due) {
    if (queuedZoomTimer) { clearTimeout(queuedZoomTimer); queuedZoomTimer = null }
    lastZoomSend = now
    CameraMediaService.setZoom(clamped)
  } else if (!queuedZoomTimer) {
    queuedZoomTimer = setTimeout(() => {
      queuedZoomTimer = null
      lastZoomSend = Date.now()
      CameraMediaService.setZoom(camera.zoomTarget)
    }, Math.max(1, 33 - (now - lastZoomSend)))
  }
}
function onZoomNumberChange(e: Event) { setZoom(Number((e.target as HTMLInputElement).value), true) }

function onPointerDown(e: PointerEvent) {
  dragging = true
  pendingGimbalAngle.value = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateFromPointer(e)
}
function onPointerMove(e: PointerEvent) { if (dragging) updateFromPointer(e) }
function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}
  DroneControlService.stopDirectGimbal('stick released')
}
function updateFromPointer(e: PointerEvent) {
  if (!dialRef.value) return
  const rect = dialRef.value.getBoundingClientRect()
  const centerY = rect.top + rect.height / 2
  const maxTravel = Math.max(1, rect.height / 2 - 15)
  const dy = Math.max(-maxTravel, Math.min(maxTravel, e.clientY - centerY))
  const command = Math.round((-dy / maxTravel) * 1000)
  DroneControlService.setDirectGimbalCommand(command)
}
function onZoomPointerDown(e: PointerEvent) {
  zoomDragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateZoomFromPointer(e)
}
function onZoomPointerMove(e: PointerEvent) { if (zoomDragging) updateZoomFromPointer(e) }
function onZoomPointerUp(e: PointerEvent) {
  if (!zoomDragging) return
  zoomDragging = false
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}
  setZoom(camera.zoomTarget, true)
}
function updateZoomFromPointer(e: PointerEvent) {
  if (!zoomDialRef.value) return
  const rect = zoomDialRef.value.getBoundingClientRect()
  const usable = Math.max(1, rect.height - 30)
  const y = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top))
  const ratio = (y - 15) / usable
  setZoom(MAX_ZOOM.value - ratio * (MAX_ZOOM.value - MIN_ZOOM))
}
watch(() => store.telemetry.gimbalSettingsValid, valid => {
  if (!valid) return
  if (pendingGimbalAngle.value != null) {
    const angle = pendingGimbalAngle.value
    if (DroneControlService.setGimbalPitchPreset(angle)) pendingGimbalAngle.value = null
    return
  }
  if (store.gimbalControl.mode === 'direct') return
  const ctrl = store.telemetry.gimbalPitchControl
  if (ctrl === 1) store.gimbalControl.targetAngle = 0
  else if (ctrl === 3) store.gimbalControl.targetAngle = -45
  else if (ctrl === 2) store.gimbalControl.targetAngle = -90
})

onMounted(() => {
  DroneControlService.requestGimbalSettings()
  CameraMediaService.getZoom()
})
</script>

<style scoped>
.camera-card{background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px}
.camera-header{display:flex;align-items:center;margin-bottom:10px}
.camera-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.control-column{min-width:0;border:1px solid #2a3248;border-radius:7px;padding:8px;background:rgba(10,13,22,.28)}
.sub-title{font-size:10px;font-weight:700;color:var(--cyan);text-transform:uppercase;letter-spacing:.45px;margin-bottom:7px}
.control-body{display:grid;grid-template-columns:74px minmax(0,1fr);gap:7px;align-items:center}
.vertical-dial{width:70px;height:120px;border-radius:34px;background:radial-gradient(circle,#1a2035,#0d111d);border:2px solid #2d3752;position:relative;cursor:ns-resize;touch-action:none;box-shadow:inset 0 0 15px rgba(0,0,0,.6)}
.axis-line{position:absolute;top:18px;bottom:18px;left:50%;width:1px;background:linear-gradient(to bottom,rgba(0,217,255,.2),rgba(0,217,255,.8),rgba(0,217,255,.2))}
.control-knob{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle,var(--ui-danger),#b31238);border:2px solid #ff5c84;position:absolute;top:50%;left:50%;box-shadow:0 0 10px rgba(255,42,95,.6);transition:transform .05s linear;display:flex;align-items:center;justify-content:center;pointer-events:none}
.knob-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent)}
.limit-mark{position:absolute;left:50%;transform:translateX(-50%);font-size:7px;color:var(--text-muted);font-family:var(--mono);white-space:nowrap}.limit-mark.top{top:3px}.limit-mark.bottom{bottom:3px}.center-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:7px;color:var(--text-muted);font-family:var(--mono);pointer-events:none}
.presets{display:flex;flex-direction:column;gap:5px}.preset-label{color:var(--text-muted);font-size:8px;text-transform:uppercase;letter-spacing:.4px}
.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.value-grid>div{min-height:31px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control-strong);display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-family:var(--mono);font-size:9px}.value-grid strong{color:var(--cyan);font-size:10px}.value-label{color:var(--text-muted)}
.feedback-state{margin-top:5px;text-align:center;color:var(--text-muted);font-size:8px;font-family:var(--mono)}
.zoom-number{width:64px;height:23px;border:1px solid var(--ui-border-control);border-radius:4px;background:var(--ui-bg-control);color:var(--ui-text);font-family:var(--mono);font-size:9px;padding:0 4px;text-align:right}
</style>
