<template>
  <section class="landing-assist ui-card">
    <button class="landing-assist-header" type="button" @click="panelOpen = !panelOpen" :aria-expanded="panelOpen">
      <span>🛬 Landehilfe</span><span>{{ panelOpen ? '▾' : '▸' }}</span>
    </button>

    <div v-if="panelOpen" class="landing-assist-body">
      <label class="crosshair-toggle">
        <input v-model="crosshairVisible" type="checkbox" />
        <span>Zielkreuz im Livebild</span>
      </label>

      <div class="fineness-box">
        <div class="fineness-heading">
          <span>Feinheit</span>
          <label class="fineness-value">
            <span>Feinheit:</span>
            <input
              v-model.number="fineControlPercent"
              type="number"
              :min="MIN_FINE_PERCENT"
              :max="MAX_FINE_PERCENT"
              step="1"
              @change="normalizeFineControlPercent"
            />
            <span>%</span>
          </label>
        </div>
        <input
          v-model.number="fineControlPercent"
          class="fineness-slider"
          type="range"
          :min="MIN_FINE_PERCENT"
          :max="MAX_FINE_PERCENT"
          step="1"
          @input="normalizeFineControlPercent"
        />
        <div class="fineness-scale">
          <span>{{ MIN_FINE_PERCENT }} %</span>
          <span>Steuerbereich ±{{ assistLimit }}</span>
          <span>{{ MAX_FINE_PERCENT }} %</span>
        </div>
      </div>

      <div class="fine-controls-group">
        <div class="fine-controls-title">Feinsteuerung</div>
        <div class="assist-note">Throttle, Yaw, Pitch und Roll zentrieren beim Loslassen automatisch auf 0.</div>
        <div class="slider-grid">
        <label v-for="axis in axes" :key="axis.key" class="axis-row">
          <span class="axis-label">{{ axis.label }}</span>
          <input
            type="range"
            :min="-assistLimit"
            :max="assistLimit"
            step="1"
            :value="store.userJoysticks[axis.key]"
            @pointerdown="beginControl"
            @pointerup="endControl(axis.key)"
            @pointercancel="endControl(axis.key)"
            @input="setAxis(axis.key, $event)"
          />
          <span class="axis-value">{{ store.userJoysticks[axis.key] }}</span>
        </label>
        </div>
      </div>

      <div class="assist-actions">
        <button class="taf-btn" type="button" :disabled="snapshotBusy" @click="takeSnapshot">
          {{ snapshotBusy ? '⏳ Speichern…' : '📸 Live-Foto' }}
        </button>

        <div class="rth-box">
          <label class="rth-height-label">
            <span>RTH-Höhe</span>
            <span class="rth-input-wrap"><input v-model.number="returnHeight" class="rth-height-input" type="number" min="20" max="120" step="1" /> m</span>
          </label>
          <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.returning }" type="button" :disabled="!telemetry.settingsValid && !telemetry.returning" @click="handleRth">
            🏠 {{ telemetry.returning ? 'RTH abbrechen' : `RTH (${sanitizedRthHeight} m)` }}
          </button>
        </div>
      </div>

      <div v-if="status" class="assist-status">{{ status }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'
import { AndroidMediaService } from '../../services/AndroidMediaService'
import { useLandingAssistSettings } from '../../composables/useLandingAssistSettings'

type FlightAxis = 'throttle' | 'yaw' | 'pitch' | 'roll'

const emit = defineEmits<{
  (e: 'control-start'): void
  (e: 'control-end'): void
  (e: 'change'): void
}>()

const NORMAL_JOYSTICK_LIMIT = 1000
const MIN_FINE_PERCENT = 10
const MAX_FINE_PERCENT = 25
const store = useDroneStore()
const telemetry = store.telemetry
const { crosshairVisible, panelOpen, returnHeight, fineControlPercent } = useLandingAssistSettings()
const snapshotBusy = ref(false)
const status = ref('')
let activePointers = 0

const axes: Array<{ key: FlightAxis; label: string }> = [
  { key: 'throttle', label: 'Throttle' },
  { key: 'yaw', label: 'Yaw' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'roll', label: 'Roll' },
]

const sanitizedRthHeight = computed(() => Math.max(20, Math.min(120, Math.round(Number(returnHeight.value) || 120))))
const sanitizedFineControlPercent = computed(() => Math.max(MIN_FINE_PERCENT, Math.min(MAX_FINE_PERCENT, Math.round(Number(fineControlPercent.value) || 15))))
const assistLimit = computed(() => Math.round(NORMAL_JOYSTICK_LIMIT * sanitizedFineControlPercent.value / 100))


function normalizeFineControlPercent() {
  fineControlPercent.value = sanitizedFineControlPercent.value
}

watch(assistLimit, limit => {
  for (const axis of axes) {
    const current = Number(store.userJoysticks[axis.key]) || 0
    if (Math.abs(current) > limit) {
      store.userJoysticks[axis.key] = Math.max(-limit, Math.min(limit, current))
      emit('change')
    }
  }
})

function beginControl() {
  activePointers += 1
  if (activePointers === 1) emit('control-start')
}

function setAxis(axis: FlightAxis, event: Event) {
  const target = event.target as HTMLInputElement
  const value = Math.max(-assistLimit.value, Math.min(assistLimit.value, Number(target.value) || 0))
  store.userJoysticks[axis] = Math.round(value)
  emit('change')
}

function endControl(axis: FlightAxis) {
  store.userJoysticks[axis] = 0
  emit('change')
  activePointers = Math.max(0, activePointers - 1)
  if (activePointers === 0) emit('control-end')
}

async function takeSnapshot() {
  if (snapshotBusy.value) return
  snapshotBusy.value = true
  status.value = 'Live-Foto wird gespeichert…'
  try {
    const saved = await AndroidMediaService.saveCockpitSnapshot()
    status.value = `Gespeichert: ${saved.relativePath}/${saved.name}`
    store.addLog('INFO', `[Landing assist] cockpit snapshot saved: ${saved.relativePath}/${saved.name}`)
  } catch (error: any) {
    status.value = `Live-Foto fehlgeschlagen: ${error?.message || error}`
    store.addLog('WARN', `[Landing assist] cockpit snapshot failed: ${error?.message || error}`)
  } finally {
    snapshotBusy.value = false
  }
}

async function handleRth() {
  if (telemetry.returning) {
    DroneControlService.cancelRth()
    return
  }
  if (!telemetry.settingsValid) {
    status.value = 'RTH nicht gestartet: Flug-Einstellungen (0x0003) sind noch nicht gültig.'
    return
  }

  const target = sanitizedRthHeight.value
  returnHeight.value = target
  if (!window.confirm(`RTH mit ${target} m Rückkehrhöhe starten?`)) return

  status.value = `Setze RTH-Höhe auf ${target} m…`
  DroneControlService.applyFlightSettings({
    limitHeight: telemetry.limitHeight || 0,
    limitDistance: telemetry.limitDistance || 0,
    returnHeight: target,
    beginnerMode: !!telemetry.beginnerMode,
    americaRockerMode: telemetry.americaRockerMode !== false,
    surroundRadius: telemetry.surroundRadius || 0,
    clockwise: telemetry.surroundClockwise !== false,
    surroundSpeed: telemetry.surroundSpeed || 0,
    speedMode: telemetry.settingSpeedMode == null || telemetry.settingSpeedMode < 0 ? 1 : telemetry.settingSpeedMode,
  })

  // Give the flight controller time to publish the synchronized 0x0003 settings.
  const deadline = Date.now() + 1800
  while (Date.now() < deadline) {
    if (telemetry.settingsValid && telemetry.returnHeight === target) break
    await new Promise(resolve => window.setTimeout(resolve, 100))
  }
  if (telemetry.returnHeight !== target) {
    status.value = `RTH nicht gestartet: Rückkehrhöhe ${target} m wurde nicht bestätigt (aktuell ${telemetry.returnHeight || 0} m).`
    store.addLog('WARN', `[Landing assist] RTH aborted: requested returnHeight=${target}, confirmed=${telemetry.returnHeight || 0}`)
    return
  }

  status.value = `RTH gestartet, bestätigte Rückkehrhöhe: ${target} m.`
  DroneControlService.rth()
}
</script>

<style scoped>
.landing-assist{padding:0;overflow:visible;flex:0 0 auto}.landing-assist-header{width:100%;height:36px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;border:0;background:var(--ui-bg-card);color:var(--ui-text);font-weight:700;cursor:pointer}.landing-assist-body{display:flex;flex-direction:column;gap:10px;padding:10px}.crosshair-toggle{display:flex;align-items:center;gap:8px;font-size:var(--ui-font-xs);font-weight:700}.assist-note,.assist-status{font-size:var(--ui-font-xs);color:var(--ui-text-muted);line-height:1.35}.fineness-box{display:flex;flex-direction:column;gap:7px;padding:10px;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control)}.fineness-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:var(--ui-font-xs);font-weight:800;color:var(--ui-text)}.fineness-value{display:flex;align-items:center;gap:4px;font-weight:700}.fineness-value input{width:48px;height:26px;box-sizing:border-box;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-card);color:var(--ui-text);padding:0 4px;text-align:right;font-family:var(--ui-font-mono)}.fineness-slider{width:100%;accent-color:var(--cyan)}.fineness-scale{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--ui-text-muted);font-family:var(--ui-font-mono)}.fine-controls-group{display:flex;flex-direction:column;gap:7px;padding:9px;border:1px solid var(--ui-border);border-radius:var(--ui-radius-md)}.fine-controls-title{font-size:var(--ui-font-xs);font-weight:800;color:var(--ui-text)}.slider-grid{display:flex;flex-direction:column;gap:8px}.axis-row{display:grid;grid-template-columns:58px 1fr 42px;gap:8px;align-items:center;font-size:var(--ui-font-xs)}.axis-label{font-weight:700;color:var(--ui-text)}.axis-row input[type=range]{width:100%;accent-color:var(--cyan);touch-action:none}.axis-value{text-align:right;font-family:var(--ui-font-mono);color:var(--ui-text-muted)}.assist-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;align-items:stretch}.rth-box{display:flex;flex-direction:column;gap:6px}.rth-height-label{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:var(--ui-font-xs);color:var(--ui-text-muted)}.rth-input-wrap{white-space:nowrap}.rth-height-input{width:58px;height:28px;box-sizing:border-box;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control);color:var(--ui-text);padding:0 6px;text-align:right}.assist-status{border-top:1px solid var(--ui-border);padding-top:7px}
</style>
