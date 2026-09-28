<template>
  <section class="gimbal-card" aria-label="Gimbal and zoom control preview">
    <div class="gimbal-header">
      <span class="panel-title">🎥 Gimbal Control</span>
      <span class="taf-status-field taf-status-field--warning status-badge">UI only · not connected</span>
    </div>

    <div class="control-pair">
      <div class="control-module">
        <div class="module-title">Gimbal</div>
        <div class="module-body">
          <div class="lever-column">
            <div
              ref="gimbalRef"
              class="axis-lever"
              @pointerdown="onGimbalPointerDown"
              @pointermove="onGimbalPointerMove"
              @pointerup="onGimbalPointerUp"
              @pointercancel="onGimbalPointerUp"
            >
              <div class="axis-track"></div>
              <div class="axis-limit top">{{ MAX_ANGLE }}°</div>
              <div class="axis-limit bottom">{{ MIN_ANGLE }}°</div>
              <div class="axis-knob" :style="gimbalKnobStyle"><span class="knob-dot"></span></div>
            </div>
            <div class="current-value">{{ targetAngle }}°</div>
          </div>

          <div class="preset-column">
            <div class="field-label">Preset</div>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setAngle(0)">0°</button>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setAngle(-45)">-45°</button>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setAngle(-90)">-90°</button>
            <label class="custom-field" for="gimbal-custom">
              <span class="sr-only">Custom gimbal angle</span>
              <input
                id="gimbal-custom"
                v-model.number="targetAngle"
                class="taf-value-input"
                type="number"
                :min="MIN_ANGLE"
                :max="MAX_ANGLE"
                step="1"
                @change="clampTarget"
              />
              <span class="input-unit">°</span>
            </label>
          </div>
        </div>
      </div>

      <div class="control-module">
        <div class="module-title">Zoom</div>
        <div class="module-body">
          <div class="lever-column">
            <div
              ref="zoomRef"
              class="axis-lever"
              @pointerdown="onZoomPointerDown"
              @pointermove="onZoomPointerMove"
              @pointerup="onZoomPointerUp"
              @pointercancel="onZoomPointerUp"
            >
              <div class="axis-track"></div>
              <div class="axis-limit top">2.00x</div>
              <div class="axis-limit bottom">1.00x</div>
              <div class="axis-knob" :style="zoomKnobStyle"><span class="knob-dot"></span></div>
            </div>
            <div class="current-value">{{ zoomValue.toFixed(2) }}x</div>
          </div>

          <div class="preset-column">
            <div class="field-label">Preset</div>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setZoom(1.0)">1.0x</button>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setZoom(1.5)">1.5x</button>
            <button class="taf-btn taf-btn--compact preset-btn" type="button" @click="setZoom(2.0)">2.0x</button>
            <label class="custom-field" for="zoom-custom">
              <span class="sr-only">Custom zoom factor</span>
              <input
                id="zoom-custom"
                v-model.number="zoomValue"
                class="taf-value-input"
                type="number"
                min="1"
                max="2"
                step="0.01"
                @change="clampZoom"
              />
              <span class="input-unit">x</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-note">Preview only. No value is transmitted to the drone, controller or BX3.</div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const MIN_ANGLE = -90
const MAX_ANGLE = 30
const targetAngle = ref(0)
const zoomValue = ref(1.00)
const gimbalRef = ref<HTMLElement | null>(null)
const zoomRef = ref<HTMLElement | null>(null)
let gimbalDragging = false
let zoomDragging = false

function leverTransform(value: number, min: number, max: number) {
  const normalized = (max - value) / (max - min)
  const travel = 74
  const y = -travel / 2 + normalized * travel
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
}

const gimbalKnobStyle = computed(() => leverTransform(targetAngle.value, MIN_ANGLE, MAX_ANGLE))
const zoomKnobStyle = computed(() => leverTransform(zoomValue.value, 1, 2))

function setAngle(value: number) {
  targetAngle.value = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, Math.round(value)))
}

function clampTarget() {
  if (!Number.isFinite(targetAngle.value)) targetAngle.value = 0
  setAngle(targetAngle.value)
}

function setZoom(value: number) {
  zoomValue.value = Math.max(1, Math.min(2, Math.round(value * 100) / 100))
}

function clampZoom() {
  if (!Number.isFinite(zoomValue.value)) zoomValue.value = 1
  setZoom(zoomValue.value)
}

function valueFromPointer(e: PointerEvent, element: HTMLElement | null, min: number, max: number) {
  if (!element) return max
  const rect = element.getBoundingClientRect()
  const margin = 16
  const usable = Math.max(1, rect.height - margin * 2)
  const y = Math.max(margin, Math.min(rect.height - margin, e.clientY - rect.top))
  const ratio = (y - margin) / usable
  return max - ratio * (max - min)
}

function onGimbalPointerDown(e: PointerEvent) {
  gimbalDragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  setAngle(valueFromPointer(e, gimbalRef.value, MIN_ANGLE, MAX_ANGLE))
}

function onGimbalPointerMove(e: PointerEvent) {
  if (gimbalDragging) setAngle(valueFromPointer(e, gimbalRef.value, MIN_ANGLE, MAX_ANGLE))
}

function onGimbalPointerUp(e: PointerEvent) {
  if (!gimbalDragging) return
  gimbalDragging = false
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}
}

function onZoomPointerDown(e: PointerEvent) {
  zoomDragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  setZoom(valueFromPointer(e, zoomRef.value, 1, 2))
}

function onZoomPointerMove(e: PointerEvent) {
  if (zoomDragging) setZoom(valueFromPointer(e, zoomRef.value, 1, 2))
}

function onZoomPointerUp(e: PointerEvent) {
  if (!zoomDragging) return
  zoomDragging = false
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}
}
</script>

<style scoped>
.gimbal-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
}

.gimbal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge {
  min-width: 118px;
}

.control-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.control-module {
  min-width: 0;
  border: 1px solid rgba(48, 56, 79, 0.8);
  border-radius: 7px;
  background: rgba(13, 17, 29, 0.48);
  padding: 8px;
}

.module-title {
  color: var(--cyan);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.45px;
  margin-bottom: 6px;
}

.module-body {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 7px;
  align-items: start;
}

.lever-column,
.preset-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.lever-column {
  align-items: center;
  gap: 5px;
}

.axis-lever {
  width: 54px;
  height: 128px;
  border-radius: 27px;
  background: linear-gradient(#11182a, #0d111d);
  border: 2px solid #2d3752;
  position: relative;
  cursor: ns-resize;
  touch-action: none;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.55);
}

.axis-track {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(to bottom, rgba(0, 217, 255, 0.2), rgba(0, 217, 255, 0.8), rgba(0, 217, 255, 0.2));
}

.axis-knob {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, #ff2a5f, #b31238);
  border: 2px solid #ff5c84;
  position: absolute;
  top: 50%;
  left: 50%;
  box-shadow: 0 0 9px rgba(255, 42, 95, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: transform 0.05s linear;
}

.knob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.axis-limit {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font: 7px var(--mono);
  color: var(--text-muted);
  white-space: nowrap;
}

.axis-limit.top { top: 3px; }
.axis-limit.bottom { bottom: 3px; }

.current-value {
  width: 54px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #30384f;
  border-radius: 6px;
  background: #111726;
  color: var(--cyan);
  font: 10px var(--mono);
  font-variant-numeric: tabular-nums;
}

.field-label {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  height: 18px;
  display: flex;
  align-items: center;
}

.preset-column {
  gap: 5px;
}

.preset-btn {
  width: 100%;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

.custom-field {
  display: flex;
  width: 100%;
  height: 28px;
}

.taf-value-input {
  min-width: 0;
  width: 100%;
  height: 28px;
  border: 1px solid #30384f;
  border-right: 0;
  border-radius: 6px 0 0 6px;
  background: #111726;
  color: var(--text);
  padding: 0 5px;
  font: 10px var(--mono);
  font-variant-numeric: tabular-nums;
  outline: none;
  user-select: text;
}

.taf-value-input:focus {
  border-color: var(--cyan);
}

.input-unit {
  width: 20px;
  flex: 0 0 20px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #30384f;
  border-left: 0;
  border-radius: 0 6px 6px 0;
  background: #151b2a;
  color: var(--cyan);
  font: 10px var(--mono);
}

.preview-note {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 9px;
  line-height: 1.35;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
