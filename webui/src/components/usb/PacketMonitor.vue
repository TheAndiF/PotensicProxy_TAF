<template>
  <div class="monitor-panel">
    <!-- Main Toolbar -->
    <div class="monitor-toolbar">
      <!-- Direction & Quick Toggles -->
      <div class="toolbar-left">
        <el-radio-group v-model="filterDir" size="small">
          <el-radio-button value="all">All</el-radio-button>
          <el-radio-button value="rx">RX Receive</el-radio-button>
          <el-radio-button value="tx">TX Send</el-radio-button>
        </el-radio-group>

        <!-- One-Click Quick Telemetry Filter -->
        <el-button
          :type="hideTelemetry ? 'warning' : 'default'"
          :plain="!hideTelemetry"
          size="small"
          class="quick-filter-btn"
          @click="hideTelemetry = !hideTelemetry"
          :title="hideTelemetry ? 'Click to show telemetry data again' : 'Click to hide high-rate flight telemetry, joystick feedback, and video frames'"
        >
          {{ hideTelemetry ? '🚫 Normal Telemetry Hidden' : '👁️ Hide Normal Telemetry' }}
        </el-button>

        <!-- Drop Telemetry at Ingestion to protect queue -->
        <el-tooltip content="When enabled, high-rate telemetry is not added to history, preventing important commands from being pushed out." placement="top">
          <el-checkbox
            v-model="store.ignoreTelemetryAtIngestion"
            label="Queue Flood Protection"
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
          placeholder="Search category/summary/HEX..."
          style="width: 175px;"
          clearable
        />
        <el-checkbox v-model="autoScroll" label="Auto Scroll" size="small" />
        <el-button size="small" type="primary" plain @click="savePacketsAsXml">Save</el-button>
        <el-button size="small" type="danger" plain @click="store.clearPackets()">Clear</el-button>
      </div>
    </div>

    <!-- Category Filter Bar (Row 2) -->
    <div class="category-filter-bar">
      <div class="cat-chips">
        <span class="cat-label">Type Filter:</span>
        <el-tag
          :effect="selectedCategory === 'all' ? 'dark' : 'plain'"
          class="filter-chip"
          size="small"
          @click="selectCategory('all')"
        >
          All
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
          placeholder="FE Type"
          clearable
          size="small"
          style="width: 135px;"
        >
          <el-option value="all" label="All FE Type" />
          <el-option value="0x05" label="FE 0x05 (Camera Response RX)" />
          <el-option value="0x15" label="FE 0x15 (Camera Command TX)" />
          <el-option value="0x14" label="FE 0x14 (Flight Control Heartbeat TX)" />
          <el-option value="0x31" label="FE 0x31 (Flight Controller Response RX)" />
          <el-option value="0x16" label="FE 0x16 (RF Video TX)" />
          <el-option value="0x17" label="FE 0x17 (Controller Config TX)" />
          <el-option value="0x21" label="FE 0x21 (Flight Telemetry RX)" />
          <el-option value="0x41" label="FE 0x41 (Controller RC RX)" />
          <el-option value="0x06" label="FE 0x06 (Video Stream RX)" />
          <el-option value="0x12" label="FE 0x12 (AOA Handshake)" />
          <el-option value="raw" label="Non-FE Raw Packet (HFD)" />
        </el-select>

        <span class="stats-text">
          Showing {{ filteredPackets.length }}/{{ store.packets.length }} entries
          <span v-if="filteredCount > 0" class="filtered-badge">
            (Filtered {{ filteredCount }} entries)
          </span>
        </span>

        <el-button
          v-if="hasActiveFilter"
          size="small"
          link
          type="primary"
          @click="resetFilters"
        >
          Reset Filters
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
            Load into Builder
          </el-button>
        </div>

        <div v-if="p.expanded" class="pkt-details">
          <!-- Structured Parsed Fields Breakdown -->
          <div v-if="p.details && Object.keys(p.details).length > 0" class="parsed-fields-box">
            <div class="fields-header">
              <span class="fields-icon">📊</span>
              <strong>Protocol Field Details:</strong>
            </div>
            <div class="fields-grid">
              <div v-for="(val, key) in p.details" :key="key" class="field-item">
                <span class="field-key">{{ key }}:</span>
                <span class="field-val" :class="getDetailValClass(val)">{{ formatDetailValue(val) }}</span>
              </div>
            </div>
          </div>

          <div class="hex-section">
            <div class="hex-title"><strong>Raw HEX Packet ({{ p.len }} bytes):</strong></div>
            <div class="hex-dump">{{ ByteUtils.formatHex(p.hex) }}</div>
          </div>

          <div v-if="p.telemetry" class="telemetry-info">
            <strong>Flight Telemetry Mapping:</strong> {{ JSON.stringify(p.telemetry) }}
          </div>
        </div>
      </div>

      <el-empty
        v-if="filteredPackets.length === 0"
        :description="store.packets.length > 0 ? 'No packets match the current filter' : 'Waiting for USB packet stream...'"
        :image-size="80"
        style="padding: 40px 0;"
      >
        <el-button v-if="hasActiveFilter" size="small" type="primary" plain @click="resetFilters">
          Show All Data
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
  { value: 'flight_cmd', label: 'Flight Control', icon: '⚡' },
  { value: 'camera', label: 'Camera & Terminal', icon: '📷' },
  { value: 'rf_fpv', label: 'RF Video', icon: '📡' },
  { value: 'remoter', label: 'Controller Status', icon: '🎮' },
  { value: 'telemetry', label: 'Flight Telemetry', icon: '🛫' },
  { value: 'rc_sticks', label: 'Joystick Feedback', icon: '🕹️' },
  { value: 'video', label: 'Video Stream', icon: '📹' },
  { value: 'other', label: 'Other Data', icon: '📦' }
]

function getCategoryLabel(cat?: string): string {
  const found = categoryOptions.find(c => c.value === cat)
  return found ? found.label : 'Unknown Type'
}

function formatDetailValue(val: any): string {
  if (val === true) return 'Yes (True)'
  if (val === false) return 'No (False)'
  if (val === null || val === undefined) return '--'
  return String(val)
}

function getDetailValClass(val: any): string {
  if (val === true) return 'val-success'
  if (val === false) return 'val-danger'
  if (typeof val === 'string') {
    if (val.includes('Ready') || val.includes('Normal') || val.includes('Ready') || val.includes('Enabled') || val.includes('PASS')) {
      return 'val-success'
    }
    if (val.includes('Not') || val.includes('Abnormal') || val.includes('High Interference') || val.includes('Triggered') || val.includes('Disabled')) {
      return 'val-danger'
    }
    if (val.includes('Pairing')) {
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

function xmlEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function objectFieldsToXml(tagName: string, value?: Record<string, any> | null): string {
  if (!value || Object.keys(value).length === 0) return `    <${tagName} />`

  const fields = Object.entries(value)
    .map(([key, fieldValue]) =>
      `      <field name="${xmlEscape(key)}">${xmlEscape(
        typeof fieldValue === 'object' && fieldValue !== null
          ? JSON.stringify(fieldValue)
          : fieldValue
      )}</field>`
    )
    .join('\n')

  return `    <${tagName}>\n${fields}\n    </${tagName}>`
}

function buildPacketLogXml(packetSnapshot: ReturnType<typeof store.getPacketSnapshot>): string {
  const generatedAt = new Date().toISOString()
  const packetsXml = packetSnapshot.map((p, index) => {
    const feTypeHex = p.feType === null ? '' : `0x${p.feType.toString(16).padStart(2, '0').toUpperCase()}`
    return [
      `  <packet index="${index + 1}" id="${xmlEscape(p.id)}">`,
      `    <direction>${xmlEscape(p.dir)}</direction>`,
      `    <time>${xmlEscape(p.time)}</time>`,
      `    <lengthBytes>${p.len}</lengthBytes>`,
      `    <feType decimal="${p.feType ?? ''}" hex="${feTypeHex}" />`,
      `    <feTypeName>${xmlEscape(p.feTypeName)}</feTypeName>`,
      `    <category>${xmlEscape(p.category)}</category>`,
      `    <categoryLabel>${xmlEscape(p.categoryLabel)}</categoryLabel>`,
      `    <summary>${xmlEscape(p.summary)}</summary>`,
      `    <hex>${xmlEscape(p.hex)}</hex>`,
      objectFieldsToXml('details', p.details),
      objectFieldsToXml('telemetry', p.telemetry as Record<string, any> | null | undefined),
      '  </packet>'
    ].join('\n')
  }).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<potensicPacketLog>',
    '  <metadata>',
    `    <generatedAt>${xmlEscape(generatedAt)}</generatedAt>`,
    `    <packetCount>${packetSnapshot.length}</packetCount>`,
    '    <bufferLimit>1000</bufferLimit>',
    '    <order>newest-first</order>',
    '  </metadata>',
    packetsXml,
    '</potensicPacketLog>',
    ''
  ].join('\n')
}

function savePacketsAsXml() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const filename = `${date}_${time}_log.xml`

  // Snapshot first so incoming RX/TX traffic can continue without mutating the
  // collection being serialized. The snapshot also includes packets waiting in
  // the 100 ms UI batch queue.
  const packetSnapshot = store.getPacketSnapshot()
  const xml = buildPacketLogXml(packetSnapshot)
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Do not revoke synchronously. Android WebView/Chromium may still be handing
  // the object URL to the download subsystem, especially while RX traffic is busy.
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  store.addLog('INFO', `Saved ${packetSnapshot.length} packet entries to ${filename}`)
}

function scrollToNewestPacket() {
  if (!autoScroll.value || !tableRef.value) return
  nextTick(() => {
    if (tableRef.value) tableRef.value.scrollTop = 0
  })
}

// Watch the newest packet ID instead of packet count. Once the ring buffer reaches
// 1000 entries its length no longer changes, but the newest packet ID still does.
watch(
  () => store.packets[0]?.id,
  () => scrollToNewestPacket()
)

watch(autoScroll, enabled => {
  if (enabled) scrollToNewestPacket()
})
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


