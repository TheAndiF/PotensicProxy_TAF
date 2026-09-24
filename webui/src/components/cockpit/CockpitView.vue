<template>
  <div class="cockpit-layout">
    <!-- Left: Video & Telemetry -->
    <div class="left-section">
      <VideoPlayer />
      <TelemetryBar />
    </div>

    <!-- Right: Virtual Joysticks & Actions Panel -->
    <div class="right-panel">
      <div class="panel-title">🕹️ Virtual Joystick Control</div>
      <div class="joysticks-container">
        <!-- Left Stick: Throttle (Y) / Yaw (X) -->
        <VirtualJoystick
          label="Throttle / Yaw"
          v-model="leftStickModel"
          :rc-echo="{ x: store.rcHardwareJoysticks.yaw, y: store.rcHardwareJoysticks.throttle }"
          @change="onJoystickChange"
        />

        <!-- Right Stick: Pitch (Y) / Roll (X) -->
        <VirtualJoystick
          label="Pitch / Roll"
          v-model="rightStickModel"
          :rc-echo="{ x: store.rcHardwareJoysticks.roll, y: store.rcHardwareJoysticks.pitch }"
          @change="onRightStickChange"
        />
      </div>

      <GimbalControl />
      <FlightActions />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import TelemetryBar from './TelemetryBar.vue'
import VirtualJoystick from './VirtualJoystick.vue'
import GimbalControl from './GimbalControl.vue'
import FlightActions from './FlightActions.vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'

const store = useDroneStore()

const leftStickModel = computed({
  get: () => ({ x: store.userJoysticks.yaw, y: store.userJoysticks.throttle }),
  set: (val) => {
    store.userJoysticks.yaw = val.x
    store.userJoysticks.throttle = val.y
  }
})

const rightStickModel = computed({
  get: () => ({ x: store.userJoysticks.roll, y: store.userJoysticks.pitch }),
  set: (val) => {
    store.userJoysticks.roll = val.x
    store.userJoysticks.pitch = val.y
  }
})

let lastSend = 0
function onJoystickChange() {
  throttleSend()
}

function onRightStickChange(val: { x: number; y: number }) {
  store.userJoysticks.roll = val.x
  store.userJoysticks.pitch = val.y
  throttleSend()
}

function throttleSend() {
  const now = Date.now()
  if (now - lastSend >= 20) {
    lastSend = now
    DroneControlService.sendJoysticks()
  }
}
</script>

<style scoped>
.cockpit-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  height: 100%;
}

.left-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
  position: relative;
  overflow: hidden;
}

.right-panel {
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 14px;
  gap: 12px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.joysticks-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 10px 0;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}
</style>

