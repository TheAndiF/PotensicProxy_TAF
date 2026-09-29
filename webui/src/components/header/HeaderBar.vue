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
        <el-radio-button value="cockpit">🎮 {{ t('header.cockpit') }}</el-radio-button>
        <el-radio-button value="mission">🧭 {{ t('header.mission') }}</el-radio-button>
        <el-radio-button value="map">🗺️ {{ t('header.map') }}</el-radio-button>
        <el-radio-button value="gallery">🖼️ {{ t('header.gallery') }}</el-radio-button>
        <el-radio-button value="usb">⚡ {{ t('header.usb') }}</el-radio-button>
        <el-radio-button value="debug">🛠️ {{ t('header.system') }}</el-radio-button>
      </el-radio-group>
    </nav>

    <div class="status-tags">
      <label class="theme-picker" :title="t('theme.title')">
        <span>{{ t('theme.title') }}</span>
        <select v-model="theme">
          <option value="dark">{{ t('theme.dark') }}</option>
          <option value="light">{{ t('theme.light') }}</option>
          <option value="gray">{{ t('theme.gray') }}</option>
        </select>
      </label>
      <el-tag
        :type="store.connection.usbConnected ? 'success' : 'danger'"
        effect="dark"
        size="small"
      >
        USB: {{ store.connection.usbConnected ? t('status.connected') : t('status.disconnected') }}
      </el-tag>

      <el-tag
        :type="store.connection.wsConnected ? 'success' : 'info'"
        effect="dark"
        size="small"
      >
        Passthrough: {{ store.connection.wsConnected ? t('status.ready') : t('status.disconnected') }}
      </el-tag>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Compass } from '@element-plus/icons-vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { useI18n } from '../../i18n'
import { useUiTheme } from '../../composables/useUiTheme'

const store = useDroneStore()
const { t } = useI18n()
const { theme } = useUiTheme()
</script>

<style scoped>
.app-header {
  background: var(--ui-bg-header);
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
  background: linear-gradient(135deg, var(--ui-success), var(--ui-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tabs-group {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.main-tabs :deep(.el-radio-button__inner) {
  min-width: 108px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-color: var(--ui-border-control);
  background: var(--ui-bg-control);
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

.theme-picker{height:30px;display:flex;align-items:center;gap:6px;padding:0 7px;border:1px solid var(--ui-border-control);border-radius:6px;background:var(--ui-bg-control);color:var(--ui-text-muted);font-size:10px}
.theme-picker select{border:0;background:transparent;color:var(--ui-text);outline:none;font-size:10px}

.status-tags :deep(.el-tag) {
  height: 30px;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 0 9px;
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
