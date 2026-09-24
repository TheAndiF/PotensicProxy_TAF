<template>
  <div class="constructor-panel">
    <div class="panel-title">🛠️ Vue 3 数据构造器 (纯前端二进制构建)</div>
    <p class="desc-text">
      由 Vue 3 纯前端构造二进制报文，通过 WebSocket 透传写入手机 USB 端口。
    </p>

    <!-- Presets Selector -->
    <div class="form-item">
      <div class="item-label">预设协议帧快速载入:</div>
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
      <div class="item-label">FE 传输封装 (FE Type):</div>
      <el-select v-model="feType" size="small" @change="rebuildFrame" style="width: 100%;">
        <el-option value="0x14" label="0x14 - 飞行控制 / 心跳包" />
        <el-option value="0x15" label="0x15 - 相机指令通道" />
        <el-option value="0x12" label="0x12 - AOA 握手协议" />
        <el-option value="0x16" label="0x16 - FPV 射频设置通道" />
        <el-option value="none" label="无 FE 封装 (纯原始数据 RAW HFD)" />
      </el-select>
    </div>

    <div class="form-item" v-if="feType !== 'none'">
      <div class="inline-grid">
        <div>
          <div class="item-label">内层 Short (LE):</div>
          <el-input v-model="cmdShort" size="small" @input="rebuildFrame" placeholder="例: 0x0301" />
        </div>
        <div>
          <div class="item-label">内层 Cmd 字节 (Hex):</div>
          <el-input v-model="cmdByte" size="small" @input="rebuildFrame" placeholder="例: 0x01" />
        </div>
      </div>
    </div>

    <!-- Hex Input/Edit Area -->
    <div class="form-item">
      <div class="label-row">
        <span class="item-label">构造报文 HEX 内容 (可直接修改):</span>
        <span class="byte-count">字节数: {{ byteCount }}B</span>
      </div>
      <el-input
        v-model="hexContent"
        type="textarea"
        :rows="3"
        placeholder="输入或由上方预设自动生成 Hex..."
        style="font-family: var(--mono); font-size: 11px;"
      />
    </div>

    <!-- Repeats & Interval -->
    <div class="inline-grid">
      <div class="form-item">
        <div class="item-label">重发次数:</div>
        <el-input-number v-model="repeats" :min="1" :max="50" size="small" style="width: 100%;" />
      </div>
      <div class="form-item">
        <div class="item-label">间隔 (ms):</div>
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
      🚀 透传发送到手机 USB
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
  { id: 'heartbeat', name: '心跳包 (Heartbeat)' },
  { id: 'handshake', name: 'AOA 握手包' },
  { id: 'takeoff', name: '一键起飞 (Takeoff)' },
  { id: 'land', name: '自动降落 (Land)' },
  { id: 'rth', name: '一键返航 (RTH)' },
  { id: 'emergency', name: '紧急急停 (Stop)' },
  { id: 'photo', name: '拍照 (Photo)' },
  { id: 'record', name: '录像开关 (Record)' },
  { id: 'idr', name: '关键帧请求 (IDR)' },
  { id: 'liveview', name: '图传参数 (LiveView)' },
  { id: 'combined_joy', name: '遥控组合控制包 (127B)' },
  { id: 'rf_probe', name: '射频参数探测' },
  { id: 'wifi_direct', name: '手柄WiFi热点' }
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
    store.addLog('INFO', `Vue3 构造器已载入: ${id} (${bytes.length} 字节)`)
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
  store.addLog('INFO', `已将报文 (${Math.floor(hex.length / 2)} 字节) 填入构造器`)
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

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
