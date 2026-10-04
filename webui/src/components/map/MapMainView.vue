<template>
  <div class="map-page">
    <section class="map-stage">
      <MapView :show-data-mode="false" />
    </section>
    <aside class="map-settings">
      <MapSettingsView />
    </aside>
  </div>
</template>

<script setup lang="ts">
import MapView from '../cockpit/MapView.vue'
import MapSettingsView from '../settings/MapSettingsView.vue'
</script>

<style scoped>
.map-page{display:grid;grid-template-columns:minmax(0,1fr) minmax(390px,520px);height:100%;background:var(--ui-bg-stage)}
.map-stage{position:relative;min-width:0;min-height:0;border-right:1px solid var(--ui-border)}
.map-stage :deep(.map-view){width:100%;height:100%}
.map-settings{min-width:0;min-height:0;overflow:hidden;background:var(--panel-bg)}
.map-settings :deep(.settings-page){max-width:none;margin:0;padding:14px}
@media (max-width:1000px){.map-page{grid-template-columns:1fr;grid-template-rows:minmax(340px,55vh) minmax(0,1fr)}.map-stage{border-right:0;border-bottom:1px solid var(--ui-border)}}
</style>
