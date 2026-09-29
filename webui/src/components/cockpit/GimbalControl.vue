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
            <div class="limit-mark top">{{ MAX_ANGLE }}°</div>
            <div class="limit-mark bottom">{{ MIN_ANGLE }}°</div>
            <div class="control-knob" :style="gimbalKnobStyle"><span class="knob-dot"></span></div>
          </div>
          <div class="presets">
            <span class="preset-label">Preset</span>
            <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(0)">0°</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(-45)">-45°</button>
            <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(-90)">-90°</button>
          </div>
        </div>
        <div class="value-grid">
          <div><span class="value-label">Soll</span><strong>{{ targetAngle }}°</strong></div>
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
        <input class="zoom-range" type="range" :min="MIN_ZOOM" :max="MAX_ZOOM" step="0.01" v-model.number="targetZoom" aria-label="Continuous zoom setpoint" />
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
import { computed, ref } from 'vue'

const MIN_ANGLE = -90
const MAX_ANGLE = 30
const MIN_ZOOM = 1
const MAX_ZOOM = 2
const targetAngle = ref(0)
const targetZoom = ref(1)

// No confirmed measured Gimbal/Zoom feedback field exists in the current project data model.
// Keep the actual value empty until a real telemetry source is wired in.
const actualGimbal = ref<number | null>(null)
const actualZoom = ref<number | null>(null)

const dialRef = ref<HTMLElement | null>(null)
const zoomDialRef = ref<HTMLElement | null>(null)
let dragging = false
let zoomDragging = false

const gimbalKnobStyle = computed(() => {
  const normalized = (MAX_ANGLE - targetAngle.value) / (MAX_ANGLE - MIN_ANGLE)
  const travel = 70
  const y = -travel / 2 + normalized * travel
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
})

const zoomKnobStyle = computed(() => {
  const normalized = (targetZoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)
  const travel = 70
  const y = travel / 2 - normalized * travel
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
})

const actualGimbalText = computed(() => actualGimbal.value == null ? '--' : `${actualGimbal.value.toFixed(0)}°`)
const actualZoomText = computed(() => actualZoom.value == null ? '--' : `${actualZoom.value.toFixed(2)}x`)
const gimbalStatus = computed(() => actualGimbal.value == null ? 'Keine Rückmeldung' : Math.abs(actualGimbal.value - targetAngle.value) <= 1 ? 'Erreicht' : 'Fährt')
const zoomStatus = computed(() => actualZoom.value == null ? 'Keine Rückmeldung' : Math.abs(actualZoom.value - targetZoom.value) <= 0.02 ? 'Erreicht' : 'Fährt')

function setAngle(value: number) {
  targetAngle.value = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, Math.round(value)))
}

function setZoom(value: number) {
  if (!Number.isFinite(value)) return
  targetZoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 100) / 100))
}
function onZoomNumberChange(e: Event) { setZoom(Number((e.target as HTMLInputElement).value)) }

function onPointerDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateFromPointer(e)
}
function onPointerMove(e: PointerEvent) { if (dragging) updateFromPointer(e) }
function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}
}
function updateFromPointer(e: PointerEvent) {
  if (!dialRef.value) return
  const rect = dialRef.value.getBoundingClientRect()
  const usable = Math.max(1, rect.height - 30)
  const y = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top))
  const ratio = (y - 15) / usable
  setAngle(MAX_ANGLE - ratio * (MAX_ANGLE - MIN_ANGLE))
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
}
function updateZoomFromPointer(e: PointerEvent) {
  if (!zoomDialRef.value) return
  const rect = zoomDialRef.value.getBoundingClientRect()
  const usable = Math.max(1, rect.height - 30)
  const y = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top))
  const ratio = (y - 15) / usable
  setZoom(MAX_ZOOM - ratio * (MAX_ZOOM - MIN_ZOOM))
}
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
.limit-mark{position:absolute;left:50%;transform:translateX(-50%);font-size:7px;color:var(--text-muted);font-family:var(--mono);white-space:nowrap}.limit-mark.top{top:3px}.limit-mark.bottom{bottom:3px}
.presets{display:flex;flex-direction:column;gap:5px}.preset-label{color:var(--text-muted);font-size:8px;text-transform:uppercase;letter-spacing:.4px}
.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.value-grid>div{min-height:31px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control-strong);display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-family:var(--mono);font-size:9px}.value-grid strong{color:var(--cyan);font-size:10px}.value-label{color:var(--text-muted)}
.feedback-state{margin-top:5px;text-align:center;color:var(--text-muted);font-size:8px;font-family:var(--mono)}
.zoom-range{width:100%;margin-top:7px;accent-color:var(--ui-primary)}.zoom-number{width:64px;height:23px;border:1px solid var(--ui-border-control);border-radius:4px;background:var(--ui-bg-control);color:var(--ui-text);font-family:var(--mono);font-size:9px;padding:0 4px;text-align:right}
</style>
