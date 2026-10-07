<template>
  <div
    ref="trackRef"
    class="axis-control"
    role="slider"
    tabindex="0"
    :aria-label="label"
    :aria-valuemin="-safeLimit"
    :aria-valuemax="safeLimit"
    :aria-valuenow="safeValue"
    :aria-valuetext="safeValue === 0 ? 'Neutralstellung' : String(safeValue)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onLostPointerCapture"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
    @blur="releaseToNeutral"
  >
    <div class="axis-track"></div>
    <div class="axis-center-mark" aria-hidden="true"></div>
    <div class="axis-fill" :style="fillStyle" aria-hidden="true"></div>
    <div class="axis-thumb" :style="thumbStyle" aria-hidden="true"><span class="axis-thumb-dot"></span></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: number
  limit: number
  label: string
}>()

const emit = defineEmits<{
  (e: 'control-start'): void
  (e: 'update:modelValue', value: number): void
  (e: 'control-end'): void
}>()

const trackRef = ref<HTMLElement | null>(null)
let dragging = false
let keyboardActive = false

const safeLimit = computed(() => Math.max(1, Math.round(Math.abs(Number(props.limit) || 1))))
const safeValue = computed(() => Math.max(-safeLimit.value, Math.min(safeLimit.value, Math.round(Number(props.modelValue) || 0))))
const normalized = computed(() => safeValue.value / safeLimit.value)
const thumbStyle = computed(() => ({ left: `${50 + normalized.value * 45}%` }))
const fillStyle = computed(() => {
  const target = 50 + normalized.value * 45
  return normalized.value >= 0
    ? { left: '50%', width: `${target - 50}%` }
    : { left: `${target}%`, width: `${50 - target}%` }
})

function setFromPointer(e: PointerEvent) {
  const el = trackRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const usable = Math.max(1, rect.width * 0.90)
  const center = rect.left + rect.width / 2
  const dx = Math.max(-usable / 2, Math.min(usable / 2, e.clientX - center))
  emit('update:modelValue', Math.round((dx / (usable / 2)) * safeLimit.value))
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  emit('control-start')
  setFromPointer(e)
}
function onPointerMove(e: PointerEvent) {
  if (dragging) setFromPointer(e)
}
function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  emit('update:modelValue', 0)
  try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) { /* already released */ }
  emit('control-end')
}
function onLostPointerCapture() {
  if (!dragging) return
  dragging = false
  emit('update:modelValue', 0)
  emit('control-end')
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  if (!keyboardActive) {
    keyboardActive = true
    emit('control-start')
  }
  const direction = e.key === 'ArrowLeft' ? -1 : 1
  emit('update:modelValue', Math.max(-safeLimit.value, Math.min(safeLimit.value, safeValue.value + direction)))
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  releaseToNeutral()
}
function releaseToNeutral() {
  if (!dragging && !keyboardActive && safeValue.value === 0) return
  dragging = false
  keyboardActive = false
  emit('update:modelValue', 0)
  emit('control-end')
}
</script>

<style scoped>
.axis-control{position:relative;width:100%;height:28px;touch-action:none;cursor:ew-resize;outline:none;user-select:none}.axis-control:focus-visible{border-radius:14px;box-shadow:0 0 0 2px rgba(0,217,255,.35)}.axis-track{position:absolute;left:5%;right:5%;top:50%;height:4px;transform:translateY(-50%);border-radius:3px;background:var(--ui-border-control)}.axis-center-mark{position:absolute;left:50%;top:5px;bottom:5px;width:1px;transform:translateX(-50%);background:var(--ui-text-muted);opacity:.65}.axis-fill{position:absolute;top:50%;height:4px;transform:translateY(-50%);border-radius:3px;background:var(--cyan);pointer-events:none}.axis-thumb{position:absolute;top:50%;width:20px;height:20px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(255,255,255,.9);background:#5b6270;box-shadow:0 1px 5px rgba(0,0,0,.45);display:grid;place-items:center;pointer-events:none}.axis-thumb-dot{width:5px;height:5px;border-radius:50%;background:var(--cyan)}
</style>
