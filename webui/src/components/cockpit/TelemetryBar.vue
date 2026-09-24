<template>
  <div class="hud-bar">
    <div class="hud-item"><span class="lbl">Battery</span><span class="val hi">{{ store.telemetry.battery }}%</span></div>
    <div class="hud-item"><span class="lbl">Altitude</span><span class="val">{{ store.telemetry.altitude?.toFixed(1) || 0 }}m</span></div>
    <div class="hud-item"><span class="lbl">Horizontal Speed</span><span class="val">{{ store.telemetry.horizontalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">Vertical Speed</span><span class="val">{{ store.telemetry.verticalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">Horizontal Distance</span><span class="val">{{ store.telemetry.horizontalDistance?.toFixed(1) || 0 }}m</span></div>
    <div class="hud-item"><span class="lbl">Satellites</span><span class="val">{{ store.telemetry.satellites || 0 }}</span></div>
    <div class="hud-item"><span class="lbl">Heading</span><span class="val">{{ store.telemetry.heading || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">Pitch</span><span class="val">{{ store.telemetry.pitch || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">Roll</span><span class="val">{{ store.telemetry.roll || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">Controller Voltage</span><span class="val">{{ store.telemetry.remoterVoltage?.toFixed(1) || '--' }}V</span></div>
  </div>
</template>

<script setup lang="ts">
import { useDroneStore } from '../../stores/useDroneStore'

const store = useDroneStore()
</script>

<style scoped>
.hud-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 16px;
  background: rgba(14, 17, 28, 0.95);
  border-top: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 11px;
}

.hud-item {
  display: flex;
  gap: 6px;
  align-items: center;
}

.lbl {
  color: var(--text-muted);
}

.val {
  color: #fff;
  font-weight: bold;
}

.val.hi {
  color: var(--accent);
}
</style>

