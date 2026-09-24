<template>
  <section class="gimbal-card" aria-label="Gimbal control preview">
    <div class="gimbal-header">
      <span class="panel-title">🎥 Gimbal Control</span>
      <span class="status-badge">UI only · not connected</span>
    </div>

    <div class="gimbal-content">
      <div
        ref="dialRef"
        class="gimbal-dial"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="axis-line"></div>
        <div class="limit-mark top">{{ MAX_ANGLE }}°</div>
        <div class="limit-mark bottom">{{ MIN_ANGLE }}°</div>
        <div class="gimbal-knob" :style="knobStyle">
          <span class="knob-dot"></span>
        </div>
      </div>

      <div class="gimbal-controls">
        <label class="field-label" for="gimbal-target">Target angle</label>
        <div class="angle-input-wrap">
          <input
            id="gimbal-target"
            v-model.number="targetAngle"
            class="angle-input"
            type="number"
            :min="MIN_ANGLE"
            :max="MAX_ANGLE"
            step="1"
            @change="clampTarget"
          />
          <span class="degree-unit">°</span>
        </div>

        <div class="preset-grid">
          <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(0)">0°</button>
          <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(-45)">-45°</button>
          <button class="taf-btn taf-btn--compact" type="button" @click="setAngle(-90)">-90°</button>
        </div>

        <div class="preview-note">
          Preview only. No value is transmitted to the drone, controller or BX3.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const MIN_ANGLE = -90
const MAX_ANGLE = 30
const targetAngle = ref(0)
const dialRef = ref<HTMLElement | null>(null)
let dragging = false

const knobStyle = computed(() => {
  const normalized = (MAX_ANGLE - targetAngle.value) / (MAX_ANGLE - MIN_ANGLE)
  const travel = 70
  const y = -travel / 2 + normalized * travel
  return { transform: `translate(-50%, calc(-50% + ${y}px))` }
})

function setAngle(value: number) {
  targetAngle.value = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, Math.round(value)))
}

function clampTarget() {
  if (!Number.isFinite(targetAngle.value)) targetAngle.value = 0
  setAngle(targetAngle.value)
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateFromPointer(e)
}

function onPointerMove(e: PointerEvent) {
  if (dragging) updateFromPointer(e)
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch (_) {}
}

function updateFromPointer(e: PointerEvent) {
  if (!dialRef.value) return
  const rect = dialRef.value.getBoundingClientRect()
  const usable = Math.max(1, rect.height - 30)
  const y = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top))
  const ratio = (y - 15) / usable
  setAngle(MAX_ANGLE - ratio * (MAX_ANGLE - MIN_ANGLE))
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
  margin-bottom: 10px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge {
  font-size: 9px;
  font-family: var(--mono);
  color: var(--warn);
  border: 1px solid rgba(255, 183, 3, 0.35);
  border-radius: 999px;
  padding: 3px 6px;
  white-space: nowrap;
}

.gimbal-content {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: center;
}

.gimbal-dial {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a2035, #0d111d);
  border: 2px solid #2d3752;
  position: relative;
  cursor: ns-resize;
  touch-action: none;
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.6);
}

.axis-line {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 50%;
  width: 1px;
  background: linear-gradient(to bottom, rgba(0, 217, 255, 0.2), rgba(0, 217, 255, 0.8), rgba(0, 217, 255, 0.2));
}

.gimbal-knob {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, #ff2a5f, #b31238);
  border: 2px solid #ff5c84;
  position: absolute;
  top: 50%;
  left: 50%;
  box-shadow: 0 0 10px rgba(255, 42, 95, 0.6);
  transition: transform 0.05s linear;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.knob-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.limit-mark {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  color: var(--text-muted);
  font-family: var(--mono);
}

.limit-mark.top { top: 3px; }
.limit-mark.bottom { bottom: 3px; }

.gimbal-controls {
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.angle-input-wrap {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.angle-input {
  width: 88px;
  height: 30px;
  border: 1px solid #30384f;
  border-radius: 6px 0 0 6px;
  background: #111726;
  color: var(--text);
  padding: 0 8px;
  font-family: var(--mono);
  font-size: 12px;
  outline: none;
  user-select: text;
}

.angle-input:focus {
  border-color: var(--cyan);
}

.degree-unit {
  height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid #30384f;
  border-left: 0;
  border-radius: 0 6px 6px 0;
  color: var(--cyan);
  background: #151b2a;
  font-family: var(--mono);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin-bottom: 8px;
}

.preview-note {
  color: var(--text-muted);
  font-size: 9px;
  line-height: 1.35;
}
</style>
