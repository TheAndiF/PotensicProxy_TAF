<template>
  <div class="usb-view-layout">
    <PacketConstructor ref="constructorRef" />
    <PacketMonitor @load-hex="onLoadHex" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PacketConstructor from './PacketConstructor.vue'
import PacketMonitor from './PacketMonitor.vue'

const constructorRef = ref<InstanceType<typeof PacketConstructor> | null>(null)

function onLoadHex(hex: string) {
  if (constructorRef.value) {
    constructorRef.value.loadHex(hex)
  }
}
</script>

<style scoped>
.usb-view-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  height: 100%;
}
</style>
