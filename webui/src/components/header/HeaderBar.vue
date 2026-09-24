<template>
  <header class="app-header">
    <div class="brand-section">
      <div class="logo">
        <el-icon :size="20" color="#00ff88"><Compass /></el-icon>
        <span class="title">POTENSIC PROXY - TAF</span>
      </div>
    </div>

    <nav class="tabs-group" aria-label="Main navigation">
      <el-radio-group v-model="store.activeTab" size="small" class="main-tabs">
        <el-radio-button value="cockpit">🎮 Flight Cockpit</el-radio-button>
        <el-radio-button value="usb">⚡ USB Tools</el-radio-button>
        <el-radio-button value="debug">🛠️ Engineering</el-radio-button>
        <el-radio-button value="logs">📋 Logs</el-radio-button>
      </el-radio-group>
    </nav>

    <div class="status-tags">
      <el-tag
        :type="store.connection.usbConnected ? 'success' : 'danger'"
        effect="dark"
        size="small"
      >
        USB: {{ store.connection.usbConnected ? 'Connected' : 'Disconnected' }}
      </el-tag>

      <el-tag
        :type="store.connection.wsConnected ? 'success' : 'info'"
        effect="dark"
        size="small"
      >
        Passthrough: {{ store.connection.wsConnected ? 'Ready' : 'Disconnected' }}
      </el-tag>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Compass } from '@element-plus/icons-vue'
import { useDroneStore } from '../../stores/useDroneStore'

const store = useDroneStore()
</script>

<style scoped>
.app-header {
  background: #0d101a;
  border-bottom: 1px solid var(--border);
  padding: 0 14px;
  display: grid;
  grid-template-columns: minmax(190px, auto) 1fr minmax(230px, auto);
  align-items: center;
  gap: 14px;
  min-height: 50px;
  flex-shrink: 0;
}

.brand-section,
.status-tags {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #00ff88, #00d9ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tabs-group {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.main-tabs :deep(.el-radio-button__inner) {
  min-width: 118px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-color: #30384f;
  background: #151b2a;
  color: var(--text);
  font-size: 11px;
  box-shadow: none;
}

.main-tabs :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: var(--cyan-dim);
  color: var(--cyan);
  border-color: var(--cyan);
  box-shadow: -1px 0 0 0 var(--cyan);
}

.status-tags {
  justify-content: flex-end;
  gap: 6px;
  white-space: nowrap;
}

@media (max-width: 1050px) {
  .app-header {
    grid-template-columns: auto 1fr;
  }

  .status-tags {
    display: none;
  }

  .tabs-group {
    justify-content: flex-end;
  }
}
</style>
