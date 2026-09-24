<template>
  <div class="actions-container">
    <div class="panel-title">✈️ Flight Actions</div>
    <div class="btn-grid">
      <button class="taf-btn taf-btn--success" @click="DroneControlService.takeoff()">🛫 Takeoff</button>
      <button class="taf-btn" @click="DroneControlService.land()">🛬 Land</button>
      <button class="taf-btn" @click="DroneControlService.rth()">🏠 RTH</button>
      <button class="taf-btn taf-btn--danger" @click="DroneControlService.emergencyStop()">⛔ Emergency Stop</button>
    </div>

    <div class="panel-title" style="margin-top: 10px;">📷 Camera & Video Control</div>
    <div class="btn-grid">
      <button class="taf-btn" @click="DroneControlService.takePhoto()">📸 Photo</button>
      <button class="taf-btn" @click="DroneControlService.toggleRecord()">🎥 Record Toggle</button>
      <button class="taf-btn taf-btn--primary" @click="DroneControlService.requestIdr()">🔄 Request Keyframe (IDR)</button>
      <button class="taf-btn" @click="DroneControlService.initLiveView()">📡 Initialize LiveView Parameters</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DroneControlService } from '../../services/DroneControlService'
</script>

<style scoped>
.actions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

</style>
