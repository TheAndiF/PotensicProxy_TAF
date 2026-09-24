<template>
  <header class="app-header">
    <div class="brand-section">
      <div class="logo">
        <el-icon :size="20" color="#00ff88"><Compass /></el-icon>
        <span class="title">POTENSIC PROXY</span>
      </div>

      <div class="status-tags">
        <el-tag
          :type="store.connection.usbConnected ? 'success' : 'danger'"
          effect="dark"
          size="small"
        >
          手柄USB: {{ store.connection.usbConnected ? '已连接' : '未连接' }}
        </el-tag>

        <el-tag
          :type="store.connection.wsConnected ? 'success' : 'info'"
          effect="dark"
          size="small"
        >
          透传通道: {{ store.connection.wsConnected ? '实时就绪' : '已断开' }}
        </el-tag>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-group">
      <el-radio-group v-model="store.activeTab" size="small">
        <el-radio-button value="cockpit">🎮 飞行驾驶舱</el-radio-button>
        <el-radio-button value="usb">⚡ USB 透传与构造</el-radio-button>
        <el-radio-button value="debug">🛠️ 调试与工程终端</el-radio-button>
        <el-radio-button value="logs">📋 运行日志</el-radio-button>
      </el-radio-group>
    </div>

    <!-- Target Phone Connection & Stats -->
    <div class="right-controls">
      <div class="host-input-wrap">
        <span class="host-label">中转/手机地址:</span>
        <el-input
          v-model="store.connection.targetHost"
          size="small"
          placeholder="47.100.253.70:19090"
          style="width: 175px;"
          @change="onReconnect"
        />
        <el-button size="small" type="primary" plain @click="onReconnect">连接</el-button>
      </div>

      <div class="packet-counters">
        <span>RX: {{ store.streamStats.packetsRx }} pkts ({{ ByteUtils.formatBytes(store.streamStats.bytesRx) }})</span>
        <span class="divider">|</span>
        <span>TX: {{ store.streamStats.packetsTx }} pkts</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Compass } from '@element-plus/icons-vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { UsbTransportService } from '../../services/UsbTransportService'
import { ByteUtils } from '../../utils/ByteUtils'

const store = useDroneStore()

function onReconnect() {
  store.setTargetHost(store.connection.targetHost)
  UsbTransportService.getInstance().connect()
}
</script>

<style scoped>
.app-header {
  background: #0d101a;
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  flex-shrink: 0;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
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

.status-tags {
  display: flex;
  gap: 6px;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.host-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.host-label {
  font-size: 11px;
  color: var(--text-muted);
}

.packet-counters {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
}

.divider {
  color: var(--border);
}
</style>
