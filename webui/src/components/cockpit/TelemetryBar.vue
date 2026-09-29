<template>
  <div class="hud-bar" aria-label="Flight status overlay">
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.phoneBattery') }}</span><span class="val hi">{{ percent(store.telemetry.phoneBatteryPercent) }}</span></div>
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.controllerBattery') }}</span><span class="val hi">{{ controllerBattery }}</span></div>
    <div class="hud-item power"><span class="lbl">{{ t('telemetry.droneBattery') }}</span><span class="val hi">{{ droneBattery }}</span></div>
    <div class="hud-item"><span class="lbl">{{ t('telemetry.altitude') }}</span><span class="val">{{ store.telemetry.altitude?.toFixed(1) || 0 }}m</span></div>
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

const store = useDroneStore()
const { t } = useI18n()

function percent(value: number | undefined) {
  return value != null && Number.isFinite(value) && value >= 0 ? `${Math.round(value)}%` : '--'
}

const controllerBattery = computed(() => {
  const pct = store.telemetry.remoterBatteryPercent
  if (pct != null && Number.isFinite(pct) && pct > 0) return `${Math.round(pct)}%`
  const voltage = store.telemetry.remoterVoltage
  return voltage && voltage > 0 ? `${voltage.toFixed(1)}V` : '--'
})

const droneBattery = computed(() => {
  const pct = store.telemetry.battery
  if (Number.isFinite(pct) && pct > 0 && pct <= 100) return `${Math.round(pct)}%`

  // The ATOM battery block exposes confirmed per-cell voltages even on links where
  // the flight-info percentage is not present. Show the measured pack voltage as a
  // factual fallback instead of presenting an initial 0% as a real battery level.
  const cells = [
    store.telemetry.cellVoltage1,
    store.telemetry.cellVoltage2,
    store.telemetry.cellVoltage3,
    store.telemetry.cellVoltage4,
  ].filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
  const packVoltage = cells.reduce((sum, value) => sum + value, 0)
  if (packVoltage > 0) return `${packVoltage.toFixed(1)}V`

  const voltage = store.telemetry.flightVoltage
  return voltage && voltage > 0 ? `${voltage.toFixed(1)}V` : '--'
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
  font-size: 10px;
  pointer-events: none;
  color: #eef3f8;
  text-shadow: 0 1px 3px rgba(0,0,0,.95);
}
.hud-item{display:flex;gap:5px;align-items:center;white-space:nowrap}
.lbl{color:#c3ccd8}.val{color:#fff;font-weight:700}.val.hi{color:#83ffc0}.power{padding-right:3px}
@media (max-width:760px){.hud-bar{font-size:9px;gap:5px 9px;padding:5px 8px}.hud-item:nth-child(n+9){display:none}}
</style>
