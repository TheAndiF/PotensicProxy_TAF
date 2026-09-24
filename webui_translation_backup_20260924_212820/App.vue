<template>
  <div id="app-root">
    <HeaderBar />

    <main class="view-container">
      <CockpitView v-if="store.activeTab === 'cockpit'" />
      <UsbManagerView v-show="store.activeTab === 'usb'" />
      <DebugConsoleView v-if="store.activeTab === 'debug'" />
      <LogConsole v-show="store.activeTab === 'logs'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import HeaderBar from './components/header/HeaderBar.vue'
import CockpitView from './components/cockpit/CockpitView.vue'
import UsbManagerView from './components/usb/UsbManagerView.vue'
import DebugConsoleView from './components/debug/DebugConsoleView.vue'
import LogConsole from './components/logs/LogConsole.vue'
import { useDroneStore } from './stores/useDroneStore'
import { UsbTransportService } from './services/UsbTransportService'

const store = useDroneStore()

onMounted(() => {
  UsbTransportService.getInstance().start()
  store.addLog('INFO', 'Potensic Proxy Vue 3 模块化控制台已启动')
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
