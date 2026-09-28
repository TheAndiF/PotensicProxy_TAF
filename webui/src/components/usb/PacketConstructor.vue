<template>
  <div class="constructor-panel">
    <div class="panel-title">🛠️ Vue 3 Packet Builder</div>
    <p class="desc-text">
      Build binary packets in Vue 3 and send them to the phone USB port via WebSocket passthrough.
    </p>

    <!-- Presets Selector -->
    <div class="form-item">
      <div class="item-label">Protocol Presets:</div>
      <div class="preset-chips">
        <el-tag
          v-for="p in presets"
          :key="p.id"
          :effect="currentPreset === p.id ? 'dark' : 'plain'"
          class="preset-chip"
          @click="applyPreset(p.id)"
        >
          {{ p.name }}
        </el-tag>
      </div>
    </div>

    <!-- FE Frame Options -->
    <div class="form-item">
      <div class="item-label">FE Transport Type (FE Type):</div>
      <el-select v-model="feType" size="small" @change="rebuildFrame" style="width: 100%;">
        <el-option value="0x14" label="0x14 - Flight Control / Heartbeat" />
        <el-option value="0x15" label="0x15 - Camera Command Channel" />
        <el-option value="0x12" label="0x12 - AOA Handshake Protocol" />
        <el-option value="0x16" label="0x16 - FPV RF Configuration Channel" />
        <el-option value="none" label="No FE Wrapper (Raw HFD Data)" />
      </el-select>
    </div>

    <div class="form-item" v-if="feType !== 'none'">
      <div class="inline-grid">
        <div>
          <div class="item-label">Inner Short (LE):</div>
          <el-input v-model="cmdShort" size="small" @input="rebuildFrame" placeholder="e.g.: 0x0301" />
        </div>
        <div>
          <div class="item-label">Inner Cmd Byte (Hex):</div>
          <el-input v-model="cmdByte" size="small" @input="rebuildFrame" placeholder="e.g.: 0x01" />
        </div>
      </div>
    </div>

    <!-- Hex Input/Edit Area -->
    <div class="form-item">
      <div class="label-row">
        <span class="item-label">Packet HEX Payload (editable):</span>
        <span class="byte-count">Bytes: {{ byteCount }}B</span>
      </div>
      <el-input
        v-model="hexContent"
        type="textarea"
        :rows="3"
        placeholder="Enter HEX or generate from preset above..."
        style="font-family: var(--mono); font-size: 11px;"
      />
    </div>

    <!-- Repeats & Interval -->
    <div class="inline-grid">
      <div class="form-item">
        <div class="item-label">Repeat Count:</div>
        <el-input-number v-model="repeats" :min="1" :max="50" size="small" style="width: 100%;" />
      </div>
      <div class="form-item">
        <div class="item-label">Interval (ms):</div>
        <el-input-number v-model="interval" :min="10" :max="1000" :step="10" size="small" style="width: 100%;" />
      </div>
    </div>

    <!-- Send Button -->
    <el-button
      type="primary"
      size="default"
      class="send-btn"
      @click="onSend"
      :disabled="!hexContent.trim()"
    >
      🚀 Send via Passthrough to Phone USB
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PacketBuilder } from '../../protocol/PacketBuilder'
import { FeTransport } from '../../protocol/FeTransport'
import { FfFdCommand } from '../../protocol/FfFdCommand'
import { ByteUtils } from '../../utils/ByteUtils'
import { DroneControlService } from '../../services/DroneControlService'
import { useDroneStore } from '../../stores/useDroneStore'

const store = useDroneStore()

const presets = [
  { id: 'heartbeat', name: 'Heartbeat (Heartbeat)' },
  { id: 'handshake', name: 'AOA Handshake' },
  { id: 'takeoff', name: 'Takeoff (Takeoff)' },
  { id: 'land', name: 'Land (Land)' },
  { id: 'rth', name: 'RTH (RTH)' },
  { id: 'emergency', name: 'Emergency Stop (Stop)' },
  { id: 'photo', name: 'Photo (Photo)' },
  { id: 'record', name: 'Record Toggle (Record)' },
  { id: 'idr', name: 'Request IDR (IDR)' },
  { id: 'liveview', name: 'LiveView Parameters (LiveView)' },
  { id: 'combined_joy', name: 'Combined RC Control (127B)' },
  { id: 'rf_probe', name: 'RF Parameter Probe' },
  { id: 'wifi_direct', name: 'Controller Wi-Fi Hotspot' }
]

const currentPreset = ref('takeoff')
const feType = ref('0x14')
const cmdShort = ref('0x0301')
const cmdByte = ref('0x01')
const hexContent = ref('')
const repeats = ref(1)
const interval = ref(50)

const byteCount = computed(() => {
  const clean = hexContent.value.replace(/[\s\r\n]/g, '')
  return Math.floor(clean.length / 2)
})

function applyPreset(id: string) {
  currentPreset.value = id
  let bytes: Uint8Array | null = null

  switch (id) {
    case 'heartbeat': bytes = PacketBuilder.buildHeartbeat(); feType.value = '0x14'; break
    case 'handshake': bytes = PacketBuilder.buildHandshake(); feType.value = '0x12'; break
    case 'takeoff': bytes = PacketBuilder.buildTakeoff(); feType.value = '0x14'; break
    case 'land': bytes = PacketBuilder.buildLand(); feType.value = '0x14'; break
    case 'rth': bytes = PacketBuilder.buildRTH(); feType.value = '0x14'; break
    case 'emergency': bytes = PacketBuilder.buildEmergencyStop(); feType.value = '0x14'; break
    case 'photo': bytes = PacketBuilder.buildTakePhoto(); feType.value = '0x15'; break
    case 'record': bytes = PacketBuilder.buildToggleRecord(); feType.value = '0x15'; break
    case 'idr': bytes = PacketBuilder.buildIdrRequest(); feType.value = '0x15'; break
    case 'liveview': bytes = PacketBuilder.buildLiveViewParams(); feType.value = '0x15'; break
    case 'combined_joy':
      bytes = PacketBuilder.buildCombinedControl(
        store.userJoysticks.throttle, store.userJoysticks.yaw, store.userJoysticks.pitch, store.userJoysticks.roll
      )
      feType.value = 'none'
      break
    case 'rf_probe': bytes = PacketBuilder.buildRfProbe(true); feType.value = '0x14'; break
    case 'wifi_direct': bytes = PacketBuilder.buildWifiDirectSwitch(true); feType.value = '0x15'; break
  }

  if (bytes) {
    hexContent.value = ByteUtils.bytesToHex(bytes)
    store.addLog('INFO', `Vue3 constructor loaded: ${id} (${bytes.length} bytes)`)
  }
}

function rebuildFrame() {
  if (feType.value === 'none') return
  try {
    const s = parseInt(cmdShort.value, 16) || 0x1200
    const b = parseInt(cmdByte.value, 16) || 0
    const f = parseInt(feType.value, 16) || 0x14
    const inner = FfFdCommand.buildWithCmdByte(b, null, s)
    const full = FeTransport.wrap(inner, f)
    hexContent.value = ByteUtils.bytesToHex(full)
  } catch (_) {}
}

function onSend() {
  DroneControlService.sendRawHex(hexContent.value, repeats.value, interval.value)
}

function loadHex(hex: string) {
  hexContent.value = hex
  store.addLog('INFO', `Loaded packet (${Math.floor(hex.length / 2)} bytes) into builder`)
}

defineExpose({
  loadHex
})

onMounted(() => {
  applyPreset('takeoff')
})
</script>

<style scoped>
.constructor-panel {
  background: var(--panel-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 14px;
  overflow-y: auto;
  gap: 12px;
}

.desc-text {
  color: var(--text-muted);
  font-size: 11px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.item-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.label-row {
  display: flex;
  justify-content: space-between;
}

.byte-count {
  font-size: 10px;
  color: var(--cyan);
}

.inline-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.preset-chip {
  cursor: pointer;
  user-select: none;
}

.send-btn {
  width: 100%;
  margin-top: 6px;
  font-weight: bold;
}
</style>


