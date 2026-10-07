<template>
  <div class="hud-bar" aria-label="Flight status overlay" :style="{ '--telemetry-font-size': `${sanitizedFontSizePx}px` }">
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.phoneBattery') }}</span><span class="val" :class="batteryClass(store.telemetry.phoneBatteryPercent)">{{ percent(store.telemetry.phoneBatteryPercent) }}</span></div>
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.controllerBattery') }}</span><span class="val" :class="controllerBatteryClass">{{ controllerBattery }}</span></div>
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.droneBattery') }}</span><span class="val" :class="batteryClass(store.telemetry.battery)">{{ percent(store.telemetry.battery) }}</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.altitude') }}</span><span class="val">{{ heightText }}</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.horizontalSpeed') }}</span><span class="val">{{ store.telemetry.horizontalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.verticalSpeed') }}</span><span class="val">{{ store.telemetry.verticalSpeed?.toFixed(1) || 0 }}m/s</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.horizontalDistance') }}</span><span class="val">{{ store.telemetry.horizontalDistance?.toFixed(1) || 0 }}m</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.satellites') }}</span><span class="val">{{ store.telemetry.satellites || 0 }}</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.heading') }}</span><span class="val">{{ store.telemetry.heading || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.pitch') }}</span><span class="val">{{ store.telemetry.pitch || 0 }}°</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.roll') }}</span><span class="val">{{ store.telemetry.roll || 0 }}°</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { useI18n } from '../../i18n'
import { useTelemetryDisplaySettings } from '../../composables/useTelemetryDisplaySettings'

const store = useDroneStore()
const { t } = useI18n()
const { sanitizedFontSizePx } = useTelemetryDisplaySettings()

function isBatteryPercent(value: number | undefined) {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 100
}
function percent(value: number | undefined) {
  return isBatteryPercent(value) ? `${Math.round(value as number)}%` : '--'
}
function batteryClass(value: number | undefined) {
  if (!isBatteryPercent(value)) return 'battery-unknown'
  return (value as number) <= 20 ? 'battery-low' : 'battery-ok'
}

const heightText = computed(() => {
  const value = store.telemetry.verticalDistance
  return value != null && Number.isFinite(value) ? `${value.toFixed(1)}m` : '--'
})

const controllerBattery = computed(() => {
  const pct = store.telemetry.remoterBatteryPercent
  if (pct != null && Number.isFinite(pct) && pct > 0 && pct <= 100) return `${Math.round(pct)}%`
  const voltage = store.telemetry.remoterVoltage
  return voltage && voltage > 0 ? `${voltage.toFixed(1)}V` : '--'
})
const controllerBatteryClass = computed(() => {
  const pct = store.telemetry.remoterBatteryPercent
  if (pct != null && Number.isFinite(pct) && pct > 0 && pct <= 100) return batteryClass(pct)
  return 'battery-unknown'
})
</script>

<style scoped>
.hud-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 7px 12px;
  background: rgba(5, 8, 13, 0.28);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 7px;
  backdrop-filter: blur(3px);
  font-family: var(--mono);
  font-size: var(--telemetry-font-size, 10px);
  pointer-events: none;
  color: #eef3f8;
  text-shadow: 0 1px 3px rgba(0,0,0,.95);
}
.hud-item{display:flex;gap:5px;align-items:center;white-space:nowrap}
.lbl{color:#c3ccd8}.val{color:#fff;font-weight:700}.battery-ok{color:var(--ui-success,#52d273)}.battery-low{color:var(--ui-danger,#ff496d)}.battery-unknown{color:#c3ccd8}.power{padding-right:3px}
@media (max-width:760px){.hud-bar{gap:5px 9px;padding:5px 8px}.hud-item:nth-child(n+9){display:none}}
</style>
