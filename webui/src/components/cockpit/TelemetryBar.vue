<template>
  <div class="hud-bar">
    <div class="hud-item"><span class="lbl">电量</span><span class="val hi">{{ store.telemetry.battery }}%</span></div>
    <div class="hud-item"><span class="lbl">高度</span><span class="val">{{ store.telemetry.altitude?.toFixed(1) || 0 }}m</span></div>
    <div class="hud-item"><span class="lbl">航速</span><span class="val">{{ store.telemetry.horizontalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">垂直速度</span><span class="val">{{ store.telemetry.verticalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">水平距离</span><span class="val">{{ store.telemetry.horizontalDistance?.toFixed(1) || 0 }}m</span></div>
    <div class="hud-item"><span class="lbl">卫星数</span><span class="val">{{ store.telemetry.satellites || 0 }}</span></div>
    <div class="hud-item"><span class="lbl">航向</span><span class="val">{{ store.telemetry.heading || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">俯仰</span><span class="val">{{ store.telemetry.pitch || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">横滚</span><span class="val">{{ store.telemetry.roll || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">手柄电压</span><span class="val">{{ store.telemetry.remoterVoltage?.toFixed(1) || '--' }}V</span></div>
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
