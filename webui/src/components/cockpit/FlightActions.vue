<template>
  <div class="actions-container">
    <div class="panel-title">✈️ {{ t('actions.flight') }}</div>
    <div class="btn-grid">
      <button class="taf-btn taf-btn--success" :disabled="telemetry.flying || telemetry.takingOff" @click="confirmTakeoff">🛫 {{ t('actions.takeoff') }}</button>
      <button class="taf-btn" :class="{ 'taf-btn--danger': telemetry.landing }" :disabled="!telemetry.flying && !telemetry.landing" @click="landOrCancel">🛬 {{ telemetry.landing ? t('actions.cancelLand') : t('actions.land') }}</button>
      <button class="taf-btn" :disabled="!telemetry.flying" @click="DroneControlService.rth()">🏠 {{ t('actions.rth') }}</button>
      <button class="taf-btn taf-btn--danger" @click="DroneControlService.emergencyStop()">⛔ {{ t('actions.emergency') }}</button>
    </div>

    <div class="panel-title" style="margin-top: 10px;">📷 {{ t('actions.camera') }}</div>
    <div class="btn-grid">
      <button class="taf-btn" @click="DroneControlService.takePhoto()">📸 {{ t('actions.photo') }}</button>
      <button class="taf-btn" @click="DroneControlService.toggleRecord()">🎥 {{ t('actions.record') }}</button>
      <button class="taf-btn taf-btn--primary" @click="DroneControlService.requestIdr()">🔄 {{ t('actions.keyframe') }}</button>
      <button class="taf-btn" @click="DroneControlService.initLiveView()">📡 {{ t('actions.liveview') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DroneControlService } from '../../services/DroneControlService'
import { useDroneStore } from '../../stores/useDroneStore'
import { useI18n } from '../../i18n'
const { t } = useI18n()
const { telemetry } = useDroneStore()

function confirmTakeoff() {
  if (window.confirm(t('actions.takeoffConfirm'))) DroneControlService.takeoff()
}

function landOrCancel() {
  if (telemetry.landing) DroneControlService.cancelLand()
  else DroneControlService.land()
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

</style>
