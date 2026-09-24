<template>
  <div class="relay-layout">
    <section class="panel-box relay-panel">
      <div class="box-title-row">
        <div>
          <div class="box-title">🌐 Remote / Relay</div>
          <div class="box-subtitle">Optional engineering connection. Not part of the normal flight control path.</div>
        </div>
        <el-tag :type="store.connection.wsConnected ? 'success' : 'info'" effect="dark" size="small">
          {{ store.connection.wsConnected ? 'Connected' : 'Disconnected' }}
        </el-tag>
      </div>

      <div class="relay-form">
        <label class="field-label" for="relay-host">Relay / phone address</label>
        <div class="host-row">
          <el-input
            id="relay-host"
            v-model="store.connection.targetHost"
            size="small"
            placeholder="47.100.253.70:19090"
            @keyup.enter="onReconnect"
          />
          <el-button type="primary" size="small" plain @click="onReconnect">Connect</el-button>
        </div>
        <div class="field-help">
          The address is only used by the optional WebSocket / HTTP transport. Flight Cockpit remains the default view.
        </div>
      </div>
    </section>

    <section class="panel-box stats-panel">
      <div class="box-title">📊 Connection Traffic</div>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">RX packets</span>
          <strong>{{ store.streamStats.packetsRx }}</strong>
          <small>{{ ByteUtils.formatBytes(store.streamStats.bytesRx) }}</small>
        </div>
        <div class="stat-card">
          <span class="stat-label">TX packets</span>
          <strong>{{ store.streamStats.packetsTx }}</strong>
          <small>{{ ByteUtils.formatBytes(store.streamStats.bytesTx) }}</small>
        </div>
        <div class="stat-card">
          <span class="stat-label">Controller USB</span>
          <strong :class="store.connection.usbConnected ? 'ok' : 'muted'">
            {{ store.connection.usbConnected ? 'Connected' : 'Disconnected' }}
          </strong>
          <small>Local controller status</small>
        </div>
        <div class="stat-card">
          <span class="stat-label">Passthrough</span>
          <strong :class="store.connection.wsConnected ? 'ok' : 'muted'">
            {{ store.connection.wsConnected ? 'Ready' : 'Disconnected' }}
          </strong>
          <small>WebSocket transport</small>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
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
.relay-layout {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
  gap: 14px;
  width: 100%;
}

.panel-box {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
}

.box-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.box-title {
  color: var(--cyan);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.box-subtitle,
.field-help {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.45;
}

.relay-form {
  margin-top: 18px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
}

.host-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.stat-card {
  min-height: 84px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: rgba(10, 13, 22, 0.55);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-label {
  color: var(--text-muted);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-card strong {
  color: var(--text);
  font-family: var(--mono);
  font-size: 15px;
}

.stat-card small {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 9px;
}

.ok { color: var(--accent) !important; }
.muted { color: var(--text-muted) !important; }

@media (max-width: 900px) {
  .relay-layout {
    grid-template-columns: 1fr;
  }
}
</style>
