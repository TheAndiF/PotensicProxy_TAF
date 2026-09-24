<template>
  <div class="monitor-panel">
    <!-- Main Toolbar -->
    <div class="monitor-toolbar">
      <!-- Direction & Quick Toggles -->
      <div class="toolbar-left">
        <el-radio-group v-model="filterDir" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="rx">RX 接收</el-radio-button>
          <el-radio-button value="tx">TX 发送</el-radio-button>
        </el-radio-group>

        <!-- One-Click Quick Telemetry Filter -->
        <el-button
          :type="hideTelemetry ? 'warning' : 'default'"
          :plain="!hideTelemetry"
          size="small"
          class="quick-filter-btn"
          @click="hideTelemetry = !hideTelemetry"
          :title="hideTelemetry ? '点击恢复显示遥测数据' : '点击过滤掉高频飞行遥测、摇杆回传和视频帧'"
        >
          {{ hideTelemetry ? '🚫 已隐藏常规遥测' : '👁️ 隐藏常规遥测' }}
        </el-button>

        <!-- Drop Telemetry at Ingestion to protect queue -->
        <el-tooltip content="开启后高频遥测不录入历史列表，避免关键指令被冲刷覆盖" placement="top">
          <el-checkbox
            v-model="store.ignoreTelemetryAtIngestion"
            label="防队列冲刷"
            size="small"
            class="ingestion-checkbox"
          />
        </el-tooltip>
      </div>

      <!-- Search & Utility Actions -->
      <div class="toolbar-right">
        <el-input
          v-model="searchKeyword"
          size="small"
          placeholder="搜索分类/摘要/HEX..."
          style="width: 175px;"
          clearable
        />
        <el-checkbox v-model="autoScroll" label="自动滚屏" size="small" />
        <el-button size="small" type="danger" plain @click="store.clearPackets()">清屏</el-button>
      </div>
    </div>

    <!-- Category Filter Bar (Row 2) -->
    <div class="category-filter-bar">
      <div class="cat-chips">
        <span class="cat-label">类型过滤:</span>
        <el-tag
          :effect="selectedCategory === 'all' ? 'dark' : 'plain'"
          class="filter-chip"
          size="small"
          @click="selectCategory('all')"
        >
          全部
        </el-tag>
        <el-tag
          v-for="cat in categoryOptions"
          :key="cat.value"
          :effect="selectedCategory === cat.value ? 'dark' : 'plain'"
          class="filter-chip"
          :class="'chip-' + cat.value"
          size="small"
          @click="selectCategory(cat.value)"
        >
          {{ cat.icon }} {{ cat.label }}
        </el-tag>
      </div>

      <!-- FE Type & Filter Stats -->
      <div class="filter-aux">
        <el-select
          v-model="selectedFeType"
          placeholder="FE 类型"
          clearable
          size="small"
          style="width: 135px;"
        >
          <el-option value="all" label="全部 FE 类型" />
          <el-option value="0x05" label="FE 0x05 (相机回传 RX)" />
          <el-option value="0x15" label="FE 0x15 (相机指令 TX)" />
          <el-option value="0x14" label="FE 0x14 (飞控心跳 TX)" />
          <el-option value="0x31" label="FE 0x31 (飞控应答 RX)" />
          <el-option value="0x16" label="FE 0x16 (射频图传 TX)" />
          <el-option value="0x17" label="FE 0x17 (遥控配置 TX)" />
          <el-option value="0x21" label="FE 0x21 (飞行遥测 RX)" />
          <el-option value="0x41" label="FE 0x41 (手柄遥控 RX)" />
          <el-option value="0x06" label="FE 0x06 (视频图传 RX)" />
          <el-option value="0x12" label="FE 0x12 (AOA握手)" />
          <el-option value="raw" label="非 FE 原始包 (HFD)" />
        </el-select>

        <span class="stats-text">
          显示 {{ filteredPackets.length }}/{{ store.packets.length }} 条
          <span v-if="filteredCount > 0" class="filtered-badge">
            (已滤除 {{ filteredCount }} 条)
          </span>
        </span>

        <el-button
          v-if="hasActiveFilter"
          size="small"
          link
          type="primary"
          @click="resetFilters"
        >
          重置过滤
        </el-button>
      </div>
    </div>

    <!-- Packet Table / List -->
    <div class="packet-table-container" ref="tableRef">
      <div
        v-for="p in filteredPackets"
        :key="p.id"
        class="packet-row"
        @click="p.expanded = !p.expanded"
      >
        <div class="packet-header">
          <el-tag :type="p.dir === 'RX' ? 'success' : 'primary'" size="small" effect="dark">
            {{ p.dir }}
          </el-tag>

          <!-- Category Badge -->
          <span class="cat-badge" :class="'cat-' + (p.category || 'other')">
            {{ p.categoryLabel || getCategoryLabel(p.category) }}
          </span>

          <span class="pkt-time">{{ p.time }}</span>
          <span class="pkt-len">{{ p.len }}B</span>
          <span class="pkt-type" :title="p.feTypeName">{{ p.feTypeName }}</span>
          <span class="pkt-summary" :title="p.summary">{{ p.summary }}</span>

          <el-button size="small" link type="primary" @click.stop="$emit('loadHex', p.hex)">
            填入构造器
          </el-button>
        </div>

        <div v-if="p.expanded" class="pkt-details">
          <!-- Structured Parsed Fields Breakdown -->
          <div v-if="p.details && Object.keys(p.details).length > 0" class="parsed-fields-box">
            <div class="fields-header">
              <span class="fields-icon">📊</span>
              <strong>协议字段精细解析:</strong>
            </div>
            <div class="fields-grid">
              <div v-for="(val, key) in p.details" :key="key" class="field-item">
                <span class="field-key">{{ key }}:</span>
                <span class="field-val" :class="getDetailValClass(val)">{{ formatDetailValue(val) }}</span>
              </div>
            </div>
          </div>

          <div class="hex-section">
            <div class="hex-title"><strong>HEX 原始报文 ({{ p.len }} 字节):</strong></div>
            <div class="hex-dump">{{ ByteUtils.formatHex(p.hex) }}</div>
          </div>

          <div v-if="p.telemetry" class="telemetry-info">
            <strong>飞行遥测映射:</strong> {{ JSON.stringify(p.telemetry) }}
          </div>
        </div>
      </div>

      <el-empty
        v-if="filteredPackets.length === 0"
        :description="store.packets.length > 0 ? '当前过滤条件未匹配到数据包' : '等待 USB 报文数据流...'"
        :image-size="80"
        style="padding: 40px 0;"
      >
        <el-button v-if="hasActiveFilter" size="small" type="primary" plain @click="resetFilters">
          恢复显示全部数据
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { ByteUtils } from '../../utils/ByteUtils'
import { PacketCategory } from '../../types/packet'

defineEmits<{
  (e: 'loadHex', hex: string): void
}>()

const store = useDroneStore()

// Filter States
const filterDir = ref<'all' | 'rx' | 'tx'>('all')
const hideTelemetry = ref(false)
const selectedCategory = ref<string>('all')
const selectedFeType = ref<string>('all')
const searchKeyword = ref('')
const autoScroll = ref(true)
const tableRef = ref<HTMLElement | null>(null)

// Category Options for filter bar
const categoryOptions: { value: PacketCategory; label: string; icon: string }[] = [
  { value: 'flight_cmd', label: '飞控指令', icon: '⚡' },
  { value: 'camera', label: '相机与终端', icon: '📷' },
  { value: 'rf_fpv', label: '射频图传', icon: '📡' },
  { value: 'remoter', label: '遥控器状态', icon: '🎮' },
  { value: 'telemetry', label: '飞行遥测', icon: '🛫' },
  { value: 'rc_sticks', label: '摇杆回传', icon: '🕹️' },
  { value: 'video', label: '视频流', icon: '📹' },
  { value: 'other', label: '其它数据', icon: '📦' }
]

function getCategoryLabel(cat?: string): string {
  const found = categoryOptions.find(c => c.value === cat)
  return found ? found.label : '未知类型'
}

function formatDetailValue(val: any): string {
  if (val === true) return '是 (True)'
  if (val === false) return '否 (False)'
  if (val === null || val === undefined) return '--'
  return String(val)
}

function getDetailValClass(val: any): string {
  if (val === true) return 'val-success'
  if (val === false) return 'val-danger'
  if (typeof val === 'string') {
    if (val.includes('已') || val.includes('正常') || val.includes('就绪') || val.includes('开启') || val.includes('PASS')) {
      return 'val-success'
    }
    if (val.includes('未') || val.includes('异常') || val.includes('强干扰') || val.includes('触发') || val.includes('关闭')) {
      return 'val-danger'
    }
    if (val.includes('对频中')) {
      return 'val-warning'
    }
  }
  return 'val-neutral'
}

function selectCategory(cat: string) {
  selectedCategory.value = cat
}

function resetFilters() {
  filterDir.value = 'all'
  hideTelemetry.value = false
  selectedCategory.value = 'all'
  selectedFeType.value = 'all'
  searchKeyword.value = ''
}

const hasActiveFilter = computed(() => {
  return (
    filterDir.value !== 'all' ||
    hideTelemetry.value ||
    selectedCategory.value !== 'all' ||
    (selectedFeType.value && selectedFeType.value !== 'all') ||
    !!searchKeyword.value.trim()
  )
})

const filteredPackets = computed(() => {
  let list = store.packets

  // 1. Direction Filter
  if (filterDir.value === 'rx') list = list.filter(p => p.dir === 'RX')
  if (filterDir.value === 'tx') list = list.filter(p => p.dir === 'TX')

  // 2. Quick Hide High-Frequency Telemetry (telemetry, rc_sticks, video)
  if (hideTelemetry.value) {
    list = list.filter(
      p => p.category !== 'telemetry' && p.category !== 'rc_sticks' && p.category !== 'video'
    )
  }

  // 3. Category Filter
  if (selectedCategory.value !== 'all') {
    list = list.filter(p => p.category === selectedCategory.value)
  }

  // 4. FE Type Filter
  if (selectedFeType.value && selectedFeType.value !== 'all') {
    if (selectedFeType.value === 'raw') {
      list = list.filter(p => p.feType === null)
    } else {
      const targetVal = parseInt(selectedFeType.value, 16)
      list = list.filter(p => p.feType === targetVal)
    }
  }

  // 5. Keyword Search
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(p =>
      (p.summary && p.summary.toLowerCase().includes(kw)) ||
      (p.hex && p.hex.toLowerCase().includes(kw)) ||
      (p.feTypeName && p.feTypeName.toLowerCase().includes(kw)) ||
      (p.categoryLabel && p.categoryLabel.toLowerCase().includes(kw))
    )
  }

  return list
})

const filteredCount = computed(() => {
  return Math.max(0, store.packets.length - filteredPackets.value.length)
})

watch(
  () => store.packets.length,
  () => {
    if (autoScroll.value && tableRef.value) {
      nextTick(() => {
        if (tableRef.value) {
          tableRef.value.scrollTop = 0
        }
      })
    }
  }
)
</script>

<style scoped>
.monitor-panel {
  display: flex;
  flex-direction: column;
  background: #090a12;
  height: 100%;
  overflow: hidden;
}

/* Primary Toolbar */
.monitor-toolbar {
  padding: 8px 14px;
  background: rgba(18, 22, 35, 0.95);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-filter-btn {
  font-weight: 500;
  transition: all 0.2s;
}

.ingestion-checkbox {
  margin-left: 4px;
  font-size: 11px;
}

/* Category Filter Bar */
.category-filter-bar {
  padding: 6px 14px;
  background: #0d111d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cat-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cat-label {
  font-size: 11px;
  color: #64748b;
  margin-right: 2px;
}

.filter-chip {
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  border-radius: 4px;
  transition: all 0.15s;
}

.filter-chip:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.filter-aux {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stats-text {
  font-size: 11px;
  color: #64748b;
  font-family: var(--mono);
}

.filtered-badge {
  color: #ff9800;
}

/* Packet Table */
.packet-table-container {
  flex: 1;
  overflow-y: auto;
  font-family: var(--mono);
  font-size: 11px;
}

.packet-row {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #141828;
  cursor: pointer;
  transition: background 0.15s;
}

.packet-row:hover {
  background: rgba(25, 32, 52, 0.5);
}

.packet-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  gap: 8px;
}

.pkt-time {
  color: #64748b;
  width: 70px;
  flex-shrink: 0;
}

.pkt-len {
  color: #94a3b8;
  width: 42px;
  text-align: right;
  flex-shrink: 0;
}

.pkt-type {
  color: #94a3b8;
  width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.pkt-summary {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #e2e8f0;
}

/* Category Badges */
.cat-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cat-flight_cmd {
  background: rgba(255, 179, 0, 0.15);
  border: 1px solid rgba(255, 179, 0, 0.4);
  color: #ffb300;
}

.cat-camera {
  background: rgba(224, 64, 251, 0.15);
  border: 1px solid rgba(224, 64, 251, 0.4);
  color: #e040fb;
}

.cat-rf_fpv {
  background: rgba(0, 229, 255, 0.15);
  border: 1px solid rgba(0, 229, 255, 0.4);
  color: #00e5ff;
}

.cat-remoter {
  background: rgba(38, 166, 154, 0.15);
  border: 1px solid rgba(38, 166, 154, 0.4);
  color: #26a69a;
}

.cat-telemetry {
  background: rgba(100, 116, 139, 0.12);
  border: 1px solid rgba(100, 116, 139, 0.25);
  color: #94a3b8;
}

.cat-rc_sticks {
  background: rgba(71, 85, 105, 0.12);
  border: 1px solid rgba(71, 85, 105, 0.25);
  color: #64748b;
}

.cat-video {
  background: rgba(41, 182, 246, 0.15);
  border: 1px solid rgba(41, 182, 246, 0.4);
  color: #29b6f6;
}

.cat-other {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

/* Expanded details */
.pkt-details {
  background: #05060c;
  padding: 10px 14px;
  border-top: 1px dashed #1c2438;
  font-size: 11px;
  color: #cbd5e1;
}

.parsed-fields-box {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.fields-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #38bdf8;
  font-size: 11.5px;
  margin-bottom: 6px;
}

.fields-icon {
  font-size: 13px;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 12px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  overflow: hidden;
}

.field-key {
  color: #94a3b8;
  font-size: 11px;
  flex-shrink: 0;
}

.field-val {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.val-success {
  color: #4ade80;
}

.val-danger {
  color: #f87171;
}

.val-neutral {
  color: #38bdf8;
}

.hex-section {
  margin-top: 4px;
}

.hex-title {
  color: #64748b;
  font-size: 10.5px;
  margin-bottom: 2px;
}

.hex-dump {
  background: #020306;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #14192b;
  color: #38bdf8;
  word-break: break-all;
  user-select: text;
}

.telemetry-info {
  margin-top: 6px;
  color: var(--cyan);
}
</style>
