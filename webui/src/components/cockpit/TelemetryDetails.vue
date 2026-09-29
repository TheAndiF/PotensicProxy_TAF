<template>
  <div class="telemetry-grid">
    <div class="telemetry-row"><span>Relative Höhe</span><strong>{{ meters(store.telemetry.verticalDistance) }}</strong></div>
    <div class="telemetry-row"><span>Altitude-Feld</span><strong>{{ meters(store.telemetry.altitude) }}</strong></div>
    <div class="telemetry-row"><span>TOF / Bodenabstand</span><strong>{{ tofText }}</strong></div>
    <div class="telemetry-row"><span>Horizontale Entfernung</span><strong>{{ meters(store.telemetry.horizontalDistance) }}</strong></div>
    <div class="telemetry-row"><span>Horizontale Geschwindigkeit</span><strong>{{ speed(store.telemetry.horizontalSpeed) }}</strong></div>
    <div class="telemetry-row"><span>Vertikale Geschwindigkeit</span><strong>{{ speed(store.telemetry.verticalSpeed) }}</strong></div>
    <div class="telemetry-row"><span>Satelliten</span><strong>{{ store.telemetry.satellites ?? 0 }}</strong></div>
    <div class="telemetry-row"><span>Heading</span><strong>{{ degrees(store.telemetry.heading) }}</strong></div>
    <div class="telemetry-row"><span>Pitch / Roll</span><strong>{{ degrees(store.telemetry.pitch) }} / {{ degrees(store.telemetry.roll) }}</strong></div>
    <div class="telemetry-row"><span>Drohnenakku</span><strong :class="batteryClass(store.telemetry.battery)">{{ percent(store.telemetry.battery) }}</strong></div>
    <div class="telemetry-row"><span>Drohnen-Spannung</span><strong>{{ volts(store.telemetry.flightVoltage) }}</strong></div>
    <div class="telemetry-row"><span>Controller-Spannung</span><strong>{{ volts(store.telemetry.remoterVoltage) }}</strong></div>
  </div>
  <p class="telemetry-note">
    Die Cockpit-Höhe entspricht wie in der Potensic-App <code>verticalDistance</code>. Das separate
    Altitude-Feld und TOF werden nur als zusätzliche Telemetrie angezeigt und nicht als Cockpit-Höhe verwendet.
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'

const store = useDroneStore()

function validNumber(value: number | undefined) {
  return value != null && Number.isFinite(value)
}
function meters(value: number | undefined) { return validNumber(value) ? `${Number(value).toFixed(1)} m` : '--' }
function speed(value: number | undefined) { return validNumber(value) ? `${Number(value).toFixed(1)} m/s` : '--' }
function volts(value: number | undefined) { return validNumber(value) && Number(value) > 0 ? `${Number(value).toFixed(2)} V` : '--' }
function degrees(value: number | undefined) { return validNumber(value) ? `${Math.round(Number(value))}°` : '--' }
function percent(value: number | undefined) { return validNumber(value) && Number(value) >= 0 && Number(value) <= 100 ? `${Math.round(Number(value))}%` : '--' }
function batteryClass(value: number | undefined) {
  if (!validNumber(value) || Number(value) < 0 || Number(value) > 100) return 'battery-unknown'
  return Number(value) <= 20 ? 'battery-low' : 'battery-ok'
}

const tofText = computed(() => {
  const value = store.telemetry.tofHeight
  return validNumber(value) ? `${Number(value)} (raw)` : '--'
})
</script>

<style scoped>
.telemetry-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px}
.telemetry-row{min-width:0;display:flex;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control-strong);font-size:9px;font-family:var(--mono)}
.telemetry-row span{color:var(--text-muted)}.telemetry-row strong{color:var(--ui-text);text-align:right}.battery-ok{color:var(--ui-success,#52d273)!important}.battery-low{color:var(--ui-danger,#ff496d)!important}.battery-unknown{color:var(--text-muted)!important}
.telemetry-note{margin:8px 1px 0;color:var(--text-muted);font-size:8px;line-height:1.45}.telemetry-note code{color:var(--cyan)}
@media(max-width:900px){.telemetry-grid{grid-template-columns:1fr}}
</style>
