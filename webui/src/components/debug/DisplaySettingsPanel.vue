<template>
  <section class="display-settings-panel">
    <div class="display-copy">
      <div class="display-title">Anzeige</div>
      <div class="display-subtitle">Schriftgröße der Telemetrie-Leiste im Flight Cockpit für große Displays anpassen.</div>
    </div>
    <div class="display-controls">
      <label class="font-size-value">
        <span>Telemetrie</span>
        <input v-model.number="fontSizePx" type="number" :min="minFontSize" :max="maxFontSize" step="1" />
        <span>px</span>
      </label>
      <input v-model.number="fontSizePx" class="font-size-slider" type="range" :min="minFontSize" :max="maxFontSize" step="1" />
      <button class="reset-button" type="button" @click="fontSizePx = defaultFontSize">Standard</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTelemetryDisplaySettings } from '../../composables/useTelemetryDisplaySettings'
const { fontSizePx, minFontSize, maxFontSize, defaultFontSize } = useTelemetryDisplaySettings()
</script>

<style scoped>
.display-settings-panel{display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--card-bg)}
.display-copy{min-width:260px;flex:1}.display-title{font-weight:700;color:var(--cyan);font-size:12px;text-transform:uppercase;letter-spacing:.5px}.display-subtitle{font-size:10px;color:var(--text-muted);margin-top:3px}
.display-controls{display:flex;align-items:center;gap:8px;min-width:390px}.font-size-value{display:flex;align-items:center;gap:5px;color:var(--text-muted);font-size:10px;white-space:nowrap}.font-size-value input{width:58px;height:28px;box-sizing:border-box;border:1px solid var(--ui-border-control);border-radius:6px;background:var(--ui-bg-control);color:var(--ui-text);padding:0 5px;text-align:right}.font-size-slider{width:150px;accent-color:var(--cyan)}.reset-button{height:28px;padding:0 9px;border:1px solid var(--ui-border-control);border-radius:6px;background:var(--ui-bg-control);color:var(--ui-text);cursor:pointer;font-size:10px}
@media(max-width:850px){.display-settings-panel{align-items:flex-start;flex-direction:column}.display-controls{min-width:0;width:100%}.font-size-slider{flex:1}}
</style>
