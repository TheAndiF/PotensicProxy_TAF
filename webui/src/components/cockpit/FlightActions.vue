<template>
  <div class="actions-container">
    <div class="panel-title">✈️ {{ t('actions.flight') }}</div>
    <div class="btn-grid">
      <button class="taf-btn taf-btn--success" :disabled="updateStartLocked || telemetry.flying || telemetry.takingOff || pstart.state.active" @click="confirmTakeoff">🛫 {{ t('actions.takeoff') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.landing }" :disabled="pstart.state.active || (!telemetry.flying && !telemetry.landing)" @click="landOrCancel">🛬 {{ telemetry.landing ? t('actions.cancelLand') : t('actions.land') }}</button>
      <button class="taf-btn pstart-button" :class="{ 'pstart-button--active': pstart.blinking }" :disabled="!pstart.state.active && (updateStartLocked || telemetry.flying || telemetry.takingOff)" @click="togglePStart">🎯 {{ t('actions.pstart') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--primary': pstart.state.plandPreviewActive }" :disabled="!plandCanPreview && !pstart.state.plandPreviewActive" :title="plandHint" @click="togglePLandPreview">🎯 {{ pstart.state.plandPreviewActive ? 'PLand-Anzeige AUS' : 'PLand-Anzeige' }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.returning }" :disabled="pstart.state.active || (!telemetry.flying && !telemetry.returning)" @click="rthOrCancel">🏠 {{ telemetry.returning ? t('actions.cancelRth') : t('actions.rth') }}</button>
      <button class="taf-btn taf-btn--danger" @click="openEmergencyConfirm">⛔ {{ t('actions.emergency') }}</button>
    </div>
    <div v-if="pstart.state.phase === 'COMPLETE'" class="pstart-status">PLand-Anzeige nach PStart verfügbar – nur Vorschau, keine automatische Landung.</div>
    <div v-if="pstart.state.status" class="pstart-status" :class="{ 'pstart-status--error': pstart.state.phase === 'ABORTED' }">
      <strong>PStart:</strong> {{ pstart.state.status }}
    </div>

    <div class="panel-title" style="margin-top: 10px;">📷 {{ t('actions.camera') }}</div>
    <div class="btn-grid">
      <button class="taf-btn" :disabled="!camera.initialization.ready || camera.capturePending" :title="camera.initialization.ready ? '' : camera.initialization.lastInitMessage" @click="DroneControlService.takePhoto()">📸 {{ camera.captureMode === 'PHOTO' ? t('actions.photoShoot') : t('actions.photoMode') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': camera.recording }" :disabled="!camera.initialization.ready || camera.recordingPending || camera.capturePending" :title="camera.initialization.ready ? '' : camera.initialization.lastInitMessage" @click="DroneControlService.toggleRecord()">🎥 {{ camera.recording ? t('actions.recordStop') : t('actions.recordStart') }}</button>
      <button class="taf-btn taf-btn--primary" @click="DroneControlService.requestIdr()">🔄 {{ t('actions.keyframe') }}</button>
      <button class="taf-btn" @click="DroneControlService.initLiveView()">📡 {{ t('actions.liveview') }}</button>
    </div>

    <div v-if="emergencyConfirmOpen" class="confirm-backdrop" role="presentation" @click.self="cancelEmergency">
      <div class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="t('actions.emergencyConfirmTitle')" @keydown.esc.prevent="cancelEmergency" tabindex="-1">
        <h3>{{ t('actions.emergencyConfirmTitle') }}</h3>
        <p>{{ t('actions.emergencyConfirmText') }}</p>
        <div class="confirm-actions">
          <button class="taf-btn taf-btn--primary" type="button" @click="cancelEmergency">{{ t('actions.cancel') }}</button>
          <button class="taf-btn taf-btn--danger" type="button" @click="confirmEmergency">{{ t('actions.emergencyExecute') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DroneControlService } from '../../services/DroneControlService'
import { useDroneStore } from '../../stores/useDroneStore'
import { useCameraStore } from '../../stores/useCameraStore'
import { usePrecisionStartStore } from '../../stores/usePrecisionStartStore'
import { PrecisionStartService } from '../../services/PrecisionStartService'
import { useI18n } from '../../i18n'
const { t } = useI18n()
const store = useDroneStore()
const camera = useCameraStore()
const pstart = usePrecisionStartStore()
const { telemetry } = store
const emergencyConfirmOpen = ref(false)
const updateStartLocked = ref(false)
let updatePoll: ReturnType<typeof setInterval> | undefined
async function pollUpdateLock() {
  try {
    const response = await fetch('/api/updates/status', { cache: 'no-store' })
    if (response.ok) updateStartLocked.value = !!(await response.json()).startCommandsLocked
  } catch { updateStartLocked.value = true }
}
onMounted(() => { void pollUpdateLock(); updatePoll = setInterval(pollUpdateLock, 1000) })
onUnmounted(() => { if (updatePoll) clearInterval(updatePoll) })
const plandCanPreview = computed(() => pstart.state.phase === 'COMPLETE' && !pstart.state.active && !telemetry.landing && !telemetry.returning)
const plandHint = computed(() => pstart.state.plandPreviewActive ? 'PLand-Modellanzeige ausschalten (kein Landebefehl)' : plandCanPreview.value ? 'PLand-Modellanzeige aktivieren, nur visuell' : 'Erst PStart erfolgreich abschließen; während Landung/RTH nicht verfügbar')
function togglePLandPreview() {
  if (!pstart.state.plandPreviewActive && !plandCanPreview.value) return
  pstart.state.plandPreviewActive = !pstart.state.plandPreviewActive
  store.addLog('INFO', `[PLand] display-only preview ${pstart.state.plandPreviewActive ? 'activated' : 'deactivated'}; no flight commands`)
}

function confirmTakeoff() {
  if (updateStartLocked.value) return
  if (window.confirm(t('actions.takeoffConfirm'))) DroneControlService.takeoff()
}

function togglePStart() {
  if (updateStartLocked.value && !pstart.state.active) return
  void PrecisionStartService.toggle()
}

function landOrCancel() {
  if (telemetry.landing) {
    DroneControlService.cancelLand()
    return
  }
  if (window.confirm(t('actions.landConfirm'))) DroneControlService.land()
}

function rthOrCancel() {
  if (telemetry.returning) {
    DroneControlService.cancelRth()
    return
  }
  if (window.confirm(t('actions.rthConfirm'))) DroneControlService.rth()
}

function openEmergencyConfirm() {
  emergencyConfirmOpen.value = true
}
function cancelEmergency() {
  if (!emergencyConfirmOpen.value) return
  emergencyConfirmOpen.value = false
  store.addLog('INFO', '[Emergency stop] confirmation dialog cancelled')
}
function confirmEmergency() {
  if (!emergencyConfirmOpen.value) return
  emergencyConfirmOpen.value = false
  if (pstart.state.active) PrecisionStartService.abort('Not-Aus durch Benutzer bestätigt', 'manual')
  store.addLog('WARN', '[Emergency stop] explicitly confirmed; executing existing emergency-stop path')
  DroneControlService.emergencyStop()
}
</script>

<style scoped>
.actions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pstart-button--active { animation: pstart-blink .8s steps(2, start) infinite; border-color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan) inset; }
@keyframes pstart-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .35; } }
.pstart-status { padding: 7px 9px; border: 1px solid var(--ui-border); border-radius: 6px; background: var(--ui-bg-control); color: var(--ui-text-muted); font-size: 11px; line-height: 1.35; }
.pstart-status--error { border-color: var(--ui-danger, #ef4444); color: var(--ui-danger, #ef4444); }

.confirm-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: rgba(0,0,0,.66); padding: 20px; }
.confirm-dialog { width: min(460px, 100%); background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
.confirm-dialog h3 { margin: 0 0 10px; }
.confirm-dialog p { margin: 0 0 16px; line-height: 1.45; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
