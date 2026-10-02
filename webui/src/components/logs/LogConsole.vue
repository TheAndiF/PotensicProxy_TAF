<template>
  <div class="logs-container">
    <div class="logs-header">
      <span class="title">Live System Logs</span>
      <div class="logs-actions">
        <span class="line-count">{{ store.logs.length }} / 1000 lines</span>
        <button class="btn" @click="saveLog">Save Log</button>
        <button class="btn btn-clear" @click="store.clearLogs()">Clear</button>
      </div>
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

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function saveLog() {
  const snapshot = store.logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`)
  const content = snapshot.length ? `${snapshot.join('\r\n')}\r\n` : ''
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const now = new Date()
  const filename = `PotensicProxy_TAF_LiveLog_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.log`
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

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
  min-height: 0;
}

.logs-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 4px 0 8px;
  background: inherit;
}

.logs-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.line-count {
  opacity: 0.75;
  font-family: monospace;
  font-size: 12px;
  white-space: nowrap;
}

.logs-scroll {
  flex: 1;
  min-height: 0;
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
