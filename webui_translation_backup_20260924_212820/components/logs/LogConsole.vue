<template>
  <div class="logs-container">
    <div class="logs-header">
      <span class="title">Live System Logs</span>
      <button class="btn btn-clear" @click="store.clearLogs()">Clear</button>
    </div>

    <div ref="scrollRef" class="logs-scroll">
      <div
        v-for="log in store.logs"
        :key="log.id"
        class="log-line"
        :class="log.level.toLowerCase()"
      >
        <span class="log-time">[{{ log.timestamp }}]</span>
        <span class="log-level">[{{ log.level }}]</span>
        <span class="log-msg">{{ log.message }}</span>
      </div>

      <div v-if="store.logs.length === 0" class="empty-logs">
        No log entries
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'

const store = useDroneStore()
const scrollRef = ref<HTMLElement | null>(null)

watch(
  () => store.logs.length,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  }
)
</script>

<style scoped>
.logs-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.logs-scroll {
  flex: 1;
  overflow: auto;
  font-family: monospace;
  font-size: 12px;
}

.log-line {
  padding: 2px 0;
}

.log-time,
.log-level {
  margin-right: 8px;
}

.empty-logs {
  opacity: 0.6;
}

.btn {
  cursor: pointer;
}
</style>
