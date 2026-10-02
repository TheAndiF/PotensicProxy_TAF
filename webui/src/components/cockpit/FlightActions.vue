<template>
  <div class="actions-container">
    <div class="panel-title">✈️ {{ t('actions.flight') }}</div>
    <div class="btn-grid">
      <button class="taf-btn taf-btn--success" :disabled="telemetry.flying || telemetry.takingOff" @click="confirmTakeoff">🛫 {{ t('actions.takeoff') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.landing }" :disabled="!telemetry.flying && !telemetry.landing" @click="landOrCancel">🛬 {{ telemetry.landing ? t('actions.cancelLand') : t('actions.land') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.returning }" :disabled="!telemetry.flying && !telemetry.returning" @click="rthOrCancel">🏠 {{ telemetry.returning ? t('actions.cancelRth') : t('actions.rth') }}</button>
      <button class="taf-btn taf-btn--danger" @click="openEmergencyConfirm">⛔ {{ t('actions.emergency') }}</button>
    </div>

    <div class="panel-title" style="margin-top: 10px;">📷 {{ t('actions.camera') }}</div>
    <div class="btn-grid">
      <button class="taf-btn" :disabled="camera.capturePending" @click="DroneControlService.takePhoto()">📸 {{ t('actions.photo') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': camera.recording }" :disabled="camera.recordingPending || camera.capturePending" @click="DroneControlService.toggleRecord()">🎥 {{ camera.recording ? t('actions.recordStop') : t('actions.recordStart') }}</button>
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
import { ref } from 'vue'
import { DroneControlService } from '../../services/DroneControlService'
import { useDroneStore } from '../../stores/useDroneStore'
import { useCameraStore } from '../../stores/useCameraStore'
import { useI18n } from '../../i18n'
const { t } = useI18n()
const store = useDroneStore()
const camera = useCameraStore()
const { telemetry } = store
const emergencyConfirmOpen = ref(false)

function confirmTakeoff() {
  if (window.confirm(t('actions.takeoffConfirm'))) DroneControlService.takeoff()
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

.confirm-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: rgba(0,0,0,.66); padding: 20px; }
.confirm-dialog { width: min(460px, 100%); background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
.confirm-dialog h3 { margin: 0 0 10px; }
.confirm-dialog p { margin: 0 0 16px; line-height: 1.45; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
