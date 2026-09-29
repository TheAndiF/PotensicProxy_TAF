<template>
  <div id="app-root">
    <HeaderBar />

    <main class="view-container">
      <CockpitView v-if="store.activeTab === 'cockpit'" />
      <MissionPlannerView v-if="store.activeTab === 'mission'" />
      <MapMainView v-if="store.activeTab === 'map'" />
      <GalleryView v-if="store.activeTab === 'gallery'" />
      <UsbManagerView v-show="store.activeTab === 'usb'" />
      <DebugConsoleView v-if="store.activeTab === 'debug'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import HeaderBar from './components/header/HeaderBar.vue'
import CockpitView from './components/cockpit/CockpitView.vue'
import MissionPlannerView from './components/mission/MissionPlannerView.vue'
import MapMainView from './components/map/MapMainView.vue'
import GalleryView from './components/gallery/GalleryView.vue'
import UsbManagerView from './components/usb/UsbManagerView.vue'
import DebugConsoleView from './components/debug/DebugConsoleView.vue'
import { useDroneStore } from './stores/useDroneStore'
import { UsbTransportService } from './services/UsbTransportService'

const store = useDroneStore()

onMounted(() => {
  UsbTransportService.getInstance().start()
  store.addLog('INFO', 'Potensic Proxy - TAF Vue 3 modular console started')
})

onUnmounted(() => {
  UsbTransportService.getInstance().stop()
})
</script>

<style scoped>
#app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.view-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>


