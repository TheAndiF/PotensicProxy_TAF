<template>
  <div class="stick-wrapper">
    <div class="stick-title">{{ label }}</div>
    <div
      class="stick-box"
      ref="boxRef"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="stick-knob" :style="knobStyle"></div>
      <div class="stick-rc-dot" :style="rcDotStyle" v-if="hasRcDot"></div>
    </div>
    <div class="stick-values">
      <span>{{ valueLabels[0] }}: {{ modelValue.y }}</span>
      <span>{{ valueLabels[1] }}: {{ modelValue.x }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  label: string
  valueLabels?: [string, string]
  modelValue: { x: number; y: number }
  rcEcho?: { x: number; y: number }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: { x: number; y: number }): void
  (e: 'change', value: { x: number; y: number }): void
}>()

const boxRef = ref<HTMLElement | null>(null)
let isDragging = false

const hasRcDot = computed(() => !!props.rcEcho)
const valueLabels = computed<[string, string]>(() => props.valueLabels || ['Y', 'X'])

const knobStyle = computed(() => ({
  transform: `translate(${props.modelValue.x * 0.04}px, ${-props.modelValue.y * 0.04}px)`
}))

const rcDotStyle = computed(() => {
  if (!props.rcEcho) return {}
  return {
    transform: `translate(${props.rcEcho.x * 0.04}px, ${-props.rcEcho.y * 0.04}px)`
  }
})

function onPointerDown(e: PointerEvent) {
  isDragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  updatePosition(e)
}

function onPointerMove(e: PointerEvent) {
  if (isDragging) updatePosition(e)
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging) return
  isDragging = false
  try {
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  } catch (_) {}
  emit('update:modelValue', { x: 0, y: 0 })
  emit('change', { x: 0, y: 0 })
}

function updatePosition(e: PointerEvent) {
  if (!boxRef.value) return
  const rect = boxRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxR = rect.width / 2 - 20

  let dx = e.clientX - cx
  let dy = e.clientY - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > maxR) {
    dx = (dx / dist) * maxR
    dy = (dy / dist) * maxR
  }

  const x = Math.round((dx / maxR) * 1000)
  const y = Math.round((-dy / maxR) * 1000)

  emit('update:modelValue', { x, y })
  emit('change', { x, y })
}
</script>

<style scoped>
.stick-wrapper{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0}
.stick-title{align-self:stretch;text-align:left;font-size:10px;font-weight:700;color:var(--cyan);text-transform:uppercase;letter-spacing:.45px}
.stick-box{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#1a2035,#0d111d);border:2px solid #2d3752;position:relative;cursor:crosshair;touch-action:none;box-shadow:inset 0 0 15px rgba(0,0,0,.6)}
.stick-knob{width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#ff2a5f,#b31238);border:2px solid #ff5c84;position:absolute;top:40px;left:40px;box-shadow:0 0 10px rgba(255,42,95,.6);pointer-events:none;transition:transform .05s linear}
.stick-rc-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);position:absolute;top:55px;left:55px;box-shadow:0 0 8px var(--accent);pointer-events:none;opacity:.85;z-index:5}
.stick-values{width:100%;display:flex;justify-content:center;gap:12px;font-size:9px;font-family:var(--mono);color:var(--text-muted);white-space:nowrap}
</style>
