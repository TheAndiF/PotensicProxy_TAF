<template>
  <div class="settings-page">
    <h2>{{ t('map.settings') }}</h2>

    <el-card class="card version-card">
      <template #header>{{ t('map.versionIndex') }}</template>
      <el-descriptions v-if="version" :column="2" border size="small">
        <el-descriptions-item :label="t('map.projectPackage')">{{ version.projectVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.androidApp')">{{ version.appVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.backend')">{{ version.backendVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.webUi')">{{ version.webUiVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.module')">{{ version.mapModuleVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.api')">v{{ version.mapApiVersion }}</el-descriptions-item>
        <el-descriptions-item :label="t('map.buildDate')" :span="2">{{ version.buildDate }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-else-if="versionError" type="warning" :closable="false" :title="versionError" />
      <el-skeleton v-else :rows="2" animated />
    </el-card>

    <el-card class="card">
      <template #header>{{ t('map.cockpitDisplay') }}</template>
      <el-form label-width="190px">
        <el-form-item :label="t('map.mainView')">
          <el-radio-group v-model="mainView">
            <el-radio-button value="video">{{ t('map.liveview') }}</el-radio-button>
            <el-radio-button value="map">{{ t('map.map') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('map.smallWindow')">
          <el-switch v-model="pipVisible" :active-text="t('map.visible')" :inactive-text="t('map.hidden')" />
        </el-form-item>
        <el-form-item :label="t('map.smallWindowPosition')">
          <el-radio-group v-model="pipPosition" :disabled="!pipVisible">
            <el-radio-button value="overlay">{{ t('map.inMainImage') }}</el-radio-button>
            <el-radio-button value="controls">{{ t('map.belowControls') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>{{ t('map.swapInfo') }}</el-alert>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>{{ t('map.source') }}</template>
      <el-form v-if="config" class="compact-map-form" label-width="190px">
        <el-form-item :label="t('map.provider')">
          <el-select v-model="config.provider" @change="applyPreset">
            <el-option label="OpenStreetMap" value="osm" />
            <el-option label="Mapbox Satellite (Raster Tiles)" value="mapbox-satellite" />
            <el-option label="Mapbox Studio Style (Static Tiles)" value="mapbox-style" />
            <el-option label="Custom XYZ" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="isMapbox" :label="t('map.style')">
          <div class="field-with-info">
            <el-input
              v-model="config.mapboxStyle"
              placeholder="mapbox://styles/mapbox/streets-v12"
              :disabled="config.provider === 'mapbox-satellite'"
            />
            <InfoPopover
              :content="config.provider === 'mapbox-satellite' ? t('map.styleUnused') : t('map.styleStaticInfo')"
              :aria-label="t('map.style')"
            />
          </div>
        </el-form-item>

        <el-form-item v-if="config.provider === 'osm'" :label="t('map.tileSource')">
          <span class="muted">https://tile.openstreetmap.org/{z}/{x}/{y}.png</span>
        </el-form-item>
        <el-form-item v-if="config.provider === 'custom'" :label="t('map.customTileUrl')">
          <el-input v-model="config.customTileUrlTemplate" placeholder="https://example/{z}/{x}/{y}.png?key={token}" />
        </el-form-item>

        <el-form-item v-if="config.provider !== 'osm'" :label="t('map.apiToken')">
          <div class="token-field">
            <el-input v-model="config.accessToken" type="password" show-password :placeholder="t('map.tokenPlaceholder')" />
            <div class="token-chips">
              <span class="chip-with-info">
                <el-tag :type="config.hasAccessToken ? 'success' : 'info'">{{ config.hasAccessToken ? t('map.stored') : t('map.notStored') }}</el-tag>
                <InfoPopover :content="t('map.tokenStorageInfo')" :aria-label="t('map.stored')" />
              </span>
              <span v-if="isMapbox" class="chip-with-info">
                <el-tag v-if="effectiveTokenType !== 'none'" :type="tokenTagType">{{ tokenTypeLabel }}</el-tag>
                <InfoPopover :content="t('map.tokenHandlingInfo')" :aria-label="tokenTypeLabel" />
              </span>
            </div>
          </div>
        </el-form-item>

        <el-form-item :label="t('map.attribution')"><el-input v-model="config.attribution" /></el-form-item>
        <el-form-item :label="t('map.defaultZoom')"><el-slider v-model="config.defaultZoom" :min="1" :max="19" show-input /></el-form-item>
        <el-form-item :label="t('map.data')">
          <div class="field-with-info wrap">
            <el-radio-group v-model="config.dataMode">
              <el-radio-button value="auto">Auto</el-radio-button>
              <el-radio-button value="offline">{{ t('map.offlineOnly') }}</el-radio-button>
              <el-radio-button value="online">{{ t('map.onlineFirst') }}</el-radio-button>
            </el-radio-group>
            <InfoPopover :content="t('map.modeInfo')" :aria-label="t('map.data')" :width="380" />
          </div>
        </el-form-item>

        <el-form-item class="action-row">
          <el-button :loading="testing" @click="testConnection">{{ t('map.testConnection') }}</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">{{ t('map.saveTest') }}</el-button>
        </el-form-item>

        <div v-if="connectionTest" class="connection-status" :class="connectionTest.ok ? 'ok' : 'error'">
          <strong>{{ connectionTest.ok ? t('map.connectionSuccessful') : connectionTest.message }}</strong>
          <span>{{ connectionTest.resource }} · {{ t('map.tokenLabel') }}: {{ connectionTest.tokenType }} · HTTP {{ connectionTest.httpStatus || '-' }}</span>
        </div>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>{{ t('map.downloadOfflineArea') }}</template>
      <el-alert v-if="config?.provider === 'osm'" class="offline-warning" type="warning" :closable="false" :title="t('map.osmWarning')" />
      <el-alert v-else-if="isMapbox" class="offline-warning" type="info" :closable="false" :title="t('map.mapboxWarning')" />
      <el-form label-width="190px">
        <el-form-item :label="t('map.latitude')"><el-input-number v-model="draft.latitude" :precision="6" :step="0.001" /></el-form-item>
        <el-form-item :label="t('map.longitude')"><el-input-number v-model="draft.longitude" :precision="6" :step="0.001" /></el-form-item>
        <el-form-item>
          <div class="position-actions">
            <el-button @click="useDronePosition" :disabled="!hasGps">{{ t('map.useDronePosition') }}</el-button>
            <el-button type="primary" plain @click="setCurrentPosition" :disabled="!draftCoordsValid">{{ t('map.setCurrentPosition') }}</el-button>
            <el-tag :type="positionSource === 'drone' ? 'success' : positionSource === 'manual' ? 'warning' : 'info'">{{ positionSourceLabel }}</el-tag>
          </div>
        </el-form-item>
        <el-form-item :label="t('map.radius')"><el-input-number v-model="draft.radiusKm" :min="0.1" :max="50" :step="0.5" /> km</el-form-item>
        <el-form-item :label="t('map.zoom')"><el-input-number v-model="draft.minZoom" :min="1" :max="19" /> <span class="sep">{{ t('map.to') }}</span> <el-input-number v-model="draft.maxZoom" :min="draft.minZoom" :max="19" /></el-form-item>
        <el-form-item><el-button type="success" @click="download" :disabled="config?.provider === 'osm'">{{ t('map.downloadArea') }}</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>{{ t('map.offlineMaps') }}</template>
      <section class="cache-section">
        <div class="section-title-row">
          <div>
            <strong>{{ t('map.temporaryCache') }}</strong>
            <div class="muted">{{ t('map.temporaryCacheHelp') }}</div>
          </div>
          <el-button type="danger" plain :disabled="!temporaryCache?.tileCount" @click="clearTemporaryCache">{{ t('map.clearCache') }}</el-button>
        </div>
        <div v-if="temporaryCache?.tileCount" class="cache-grid">
          <div><span>{{ t('map.cache') }}</span><strong>{{ formatBytes(temporaryCache.sizeBytes) }}</strong></div>
          <div><span>{{ t('map.tileCount') }}</span><strong>{{ temporaryCache.tileCount }}</strong></div>
          <div><span>{{ t('map.lastUpdated') }}</span><strong>{{ formatTimestamp(temporaryCache.lastUpdated) }}</strong></div>
          <div><span>{{ t('map.coverage') }}</span><strong>{{ cacheCoverage }}</strong></div>
        </div>
        <div v-else class="empty-note">{{ t('map.cacheEmpty') }}</div>
      </section>

      <el-divider />
      <section>
        <div class="downloaded-heading">{{ t('map.downloadedAreas') }}</div>
        <el-alert class="source-info" type="info" :closable="false" show-icon>{{ t('map.offlineHelp') }}</el-alert>
        <el-table :data="regions" :empty-text="t('map.noOfflineAreas')">
          <el-table-column prop="id" :label="t('map.region')" min-width="150" />
          <el-table-column :label="t('map.sourceLabel')" min-width="140">
            <template #default="s"><div>{{ providerLabel(s.row) }}</div><small class="muted">Z{{ s.row.minZoom }}-{{ s.row.maxZoom }} · {{ (s.row.radiusM / 1000).toFixed(1) }} km</small></template>
          </el-table-column>
          <el-table-column :label="t('map.status')" min-width="160">
            <template #default="s">
              <el-progress v-if="isProgressStatus(s.row.status)" :percentage="pct(s.row)" :status="s.row.errors ? 'warning' : undefined" />
              <el-tag v-else :type="statusTagType(s.row.status)">{{ statusLabel(s.row.status) }}</el-tag>
              <div v-if="s.row.errors" class="muted">{{ s.row.errors }} {{ t('map.errors') }}</div>
            </template>
          </el-table-column>
          <el-table-column :label="t('map.cache')" min-width="110">
            <template #default="s"><div>{{ formatBytes(s.row.sizeBytes || 0) }}</div><small class="muted">{{ s.row.cachedTiles ?? '—' }} / {{ s.row.total }} {{ t('map.tileCount').toLowerCase() }}</small></template>
          </el-table-column>
          <el-table-column :label="t('map.actions')" min-width="290" fixed="right">
            <template #default="s">
              <el-button link type="primary" :disabled="isBusy(s.row)" @click="updateTiles(s.row)">{{ t('map.update') }}</el-button>
              <el-button link type="warning" :disabled="isBusy(s.row)" @click="reloadTiles(s.row)">{{ t('map.reload') }}</el-button>
              <el-button link type="danger" :disabled="isBusy(s.row)" @click="clearTiles(s.row)">{{ t('map.deleteTiles') }}</el-button>
              <el-button link :disabled="isBusy(s.row)" @click="removeRegion(s.row)">{{ t('map.remove') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from '../../i18n'
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService'
import { useDroneStore } from '../../stores/useDroneStore'
import type { MapConfig, MapConnectionTest, MapboxTokenType, OfflineRegion, TemporaryTileCacheInfo, VersionInfo } from '../../types/map'
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings'
import { useMapPosition } from '../../composables/useMapPosition'
import InfoPopover from '../map/InfoPopover.vue'

const store = useDroneStore()
const { t } = useI18n()
const { mainView, pipVisible, pipPosition } = useCockpitViewSettings()
const { source: positionSource, setManualPosition, validCoordinates } = useMapPosition()
const config = ref<MapConfig | null>(null)
const version = ref<VersionInfo | null>(null)
const versionError = ref('')
const regions = ref<OfflineRegion[]>([])
const temporaryCache = ref<TemporaryTileCacheInfo | null>(null)
const connectionTest = ref<MapConnectionTest | null>(null)
const testing = ref(false)
const saving = ref(false)
const draft = reactive({ latitude: 52.52, longitude: 13.405, radiusKm: 5, minZoom: 11, maxZoom: 16 })
let regionTimer: ReturnType<typeof setInterval> | undefined
let cacheTimer: ReturnType<typeof setInterval> | undefined

const isMapbox = computed(() => config.value?.provider === 'mapbox-satellite' || config.value?.provider === 'mapbox-style')
const hasGps = computed(() => {
  const lat = store.telemetry.latitude
  const lon = store.telemetry.longitude
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)
})
const draftCoordsValid = computed(() => validCoordinates(draft.latitude, draft.longitude))
const positionSourceLabel = computed(() => positionSource.value === 'drone' ? t('map.currentDrone') : positionSource.value === 'manual' ? t('map.currentManual') : t('map.currentNone'))
const cacheCoverage = computed(() => {
  const bounds = temporaryCache.value?.bounds
  if (!bounds) return '—'
  return `${bounds.south.toFixed(3)}…${bounds.north.toFixed(3)} / ${bounds.west.toFixed(3)}…${bounds.east.toFixed(3)}`
})

function localTokenType(token: string): MapboxTokenType {
  if (token === '********') return config.value?.tokenType || 'none'
  if (token.startsWith('pk.')) return 'public'
  if (token.startsWith('sk.')) return 'secret'
  if (token.startsWith('tk.')) return 'temporary'
  return token ? 'unknown' : 'none'
}

const effectiveTokenType = computed<MapboxTokenType>(() => connectionTest.value?.tokenType || localTokenType(config.value?.accessToken || ''))
const tokenTypeLabel = computed(() => ({ public: t('map.publicToken'), secret: t('map.secretToken'), temporary: t('map.temporaryToken'), unknown: t('map.unknownToken'), none: t('map.noToken') }[effectiveTokenType.value]))
const tokenTagType = computed(() => effectiveTokenType.value === 'secret' ? 'warning' : effectiveTokenType.value === 'unknown' ? 'danger' : 'info')

function applyPreset() {
  if (!config.value) return
  connectionTest.value = null
  if (config.value.provider === 'osm') {
    config.value.style = 'street'
    config.value.tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    config.value.attribution = '© OpenStreetMap contributors'
  } else if (config.value.provider === 'mapbox-satellite') {
    config.value.style = 'satellite'
    config.value.attribution = '© Mapbox © OpenStreetMap'
  } else if (config.value.provider === 'mapbox-style') {
    config.value.style = 'mapbox-style'
    if (!config.value.mapboxStyle) config.value.mapboxStyle = 'mapbox://styles/mapbox/streets-v12'
    config.value.attribution = '© Mapbox © OpenStreetMap'
  } else if (config.value.provider === 'custom') config.value.style = 'custom'
}

async function testConnection(showToast = true) {
  if (!config.value) return false
  testing.value = true
  connectionTest.value = null
  try {
    connectionTest.value = await MapService.testConfig(config.value)
    if (showToast) connectionTest.value.ok ? ElMessage.success(t('map.testSuccessToast')) : ElMessage.warning(connectionTest.value.message)
    return connectionTest.value.ok
  } catch (e: any) {
    const message = e?.message || t('map.testFailed')
    connectionTest.value = { ok: false, provider: config.value.provider, tokenType: localTokenType(config.value.accessToken), httpStatus: 0, resource: '', contentType: '', message }
    if (showToast) ElMessage.error(message)
    return false
  } finally { testing.value = false }
}

async function saveConfig() {
  if (!config.value) return
  saving.value = true
  try {
    config.value = await MapService.saveConfig(config.value)
    const ok = await testConnection(false)
    if (ok) ElMessage.success(t('map.savedOk'))
    else ElMessage.warning(t('map.savedFailed', { error: connectionTest.value?.message || t('map.error') }))
  } catch (e: any) { ElMessage.error(e?.message || t('map.saveError')) }
  finally { saving.value = false }
}

function useDronePosition() {
  if (!hasGps.value) return
  draft.latitude = store.telemetry.latitude
  draft.longitude = store.telemetry.longitude
}
function setCurrentPosition() {
  if (!draftCoordsValid.value) return
  setManualPosition(draft.latitude, draft.longitude)
}

async function refreshRegions() {
  try { regions.value = await MapService.regions() }
  catch (e: any) { console.warn('Could not refresh offline regions:', e?.message || e) }
}
async function refreshTemporaryCache() {
  try { temporaryCache.value = await MapService.temporaryCache() }
  catch (e: any) { console.warn('Could not refresh temporary map cache:', e?.message || e) }
}

async function clearTemporaryCache() {
  try {
    await ElMessageBox.confirm(t('map.clearCacheConfirm'), t('map.clearCacheTitle'), { confirmButtonText: t('map.clearCache'), cancelButtonText: t('actions.cancel'), type: 'warning' })
    const result = await MapService.clearTemporaryCache()
    temporaryCache.value = result.cache
    ElMessage.success(t('map.cacheCleared'))
  } catch (e: any) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || t('map.clearCacheError')) }
}

async function download() {
  if (config.value?.provider === 'osm') { ElMessage.warning(t('map.offlineOsmBlocked')); return }
  try {
    await MapService.downloadRegion({ latitude: draft.latitude, longitude: draft.longitude, radiusM: draft.radiusKm * 1000, minZoom: draft.minZoom, maxZoom: draft.maxZoom })
    await refreshRegions(); ElMessage.success(t('map.offlineStarted'))
  } catch (e: any) { ElMessage.error(e?.message || t('map.offlineStartError')) }
}

function pct(r: OfflineRegion) { return r.total ? Math.min(100, Math.round((r.downloaded / r.total) * 100)) : 0 }
function isProgressStatus(status: string) { return ['downloading', 'updating', 'reloading'].includes(status) }
function isBusy(r: OfflineRegion) { return isProgressStatus(r.status) || r.status === 'clearing' }
function statusLabel(status: string) { return ({ ready: t('map.ready'), ready_with_errors: t('map.readyErrors'), tiles_cleared: t('map.tilesDeleted'), clearing: t('map.deletingTiles'), error: t('map.error') } as Record<string,string>)[status] || status }
function statusTagType(status: string) { return status === 'ready' ? 'success' : status === 'error' ? 'danger' : status === 'tiles_cleared' ? 'info' : 'warning' }
function providerLabel(r: OfflineRegion) {
  if (r.provider === 'mapbox-satellite') return 'Mapbox Satellite'
  if (r.provider === 'mapbox-style') return r.style === 'outdoors' ? 'Mapbox Outdoors' : 'Mapbox Style'
  if (r.provider === 'osm') return 'OpenStreetMap'
  return 'Custom XYZ'
}
function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']; let value = bytes; let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
function formatTimestamp(value?: number | null) { return value ? new Date(value).toLocaleString() : '—' }

async function updateTiles(region: OfflineRegion) {
  try { await MapService.updateRegion(region.id); await refreshRegions(); ElMessage.success(t('map.updateStarted')) }
  catch (e: any) { ElMessage.error(e?.message || t('map.updateError')) }
}
async function reloadTiles(region: OfflineRegion) {
  try {
    await ElMessageBox.confirm(t('map.reloadConfirm', { count: region.total, id: region.id }), t('map.reloadTitle'), { confirmButtonText: t('map.reload'), cancelButtonText: t('actions.cancel'), type: 'warning' })
    await MapService.reloadRegion(region.id); await refreshRegions(); ElMessage.success(t('map.reloadStarted'))
  } catch (e: any) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || t('map.reloadError')) }
}
async function clearTiles(region: OfflineRegion) {
  try {
    await ElMessageBox.confirm(t('map.deleteTilesConfirm', { id: region.id }), t('map.deleteTilesTitle'), { confirmButtonText: t('map.deleteTiles'), cancelButtonText: t('actions.cancel'), type: 'warning' })
    await MapService.clearRegionTiles(region.id); await refreshRegions(); ElMessage.success(t('map.deleteTilesStarted'))
  } catch (e: any) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || t('map.deleteTilesError')) }
}
async function removeRegion(region: OfflineRegion) {
  try {
    await ElMessageBox.confirm(t('map.removeConfirm', { id: region.id }), t('map.removeTitle'), { confirmButtonText: t('map.remove'), cancelButtonText: t('actions.cancel'), type: 'warning' })
    await MapService.deleteRegion(region.id); await refreshRegions(); ElMessage.success(t('map.removeDone'))
  } catch (e: any) { if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || t('map.removeError')) }
}

function onMapConfigChanged(event: Event) {
  const detail = (event as CustomEvent<MapConfig>).detail
  if (!detail) return
  config.value = detail
  connectionTest.value = null
}

onMounted(async () => {
  try { version.value = await MapService.getVersion() }
  catch (e: any) { versionError.value = t('map.versionUnavailable', { error: e?.message || t('map.sourceUnavailable') }) }
  try { config.value = await MapService.getConfig() }
  catch (e: any) { ElMessage.error(e?.message || t('map.loadError')) }
  window.addEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged)
  await Promise.all([refreshRegions(), refreshTemporaryCache()]); regionTimer = setInterval(refreshRegions, 1500); cacheTimer = setInterval(refreshTemporaryCache, 5000)
})

onUnmounted(() => {
  if (regionTimer) clearInterval(regionTimer)
  if (cacheTimer) clearInterval(cacheTimer)
  window.removeEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged)
})
</script>

<style scoped>
.settings-page{height:100%;overflow:auto;padding:18px;max-width:1050px;margin:auto}.settings-page h2{margin:0 0 14px;color:var(--cyan)}.card{margin-bottom:14px;background:var(--panel-bg);border-color:var(--border)}.sep{padding:0 10px;color:var(--text-muted)}.offline-warning,.source-info{margin-bottom:14px}.version-card :deep(.el-descriptions__label){width:150px}.muted{color:var(--text-muted);line-height:1.4}.compact-map-form :deep(.el-form-item){margin-bottom:12px}.field-with-info{display:flex;align-items:center;gap:8px;width:100%}.field-with-info.wrap{flex-wrap:wrap}.token-field{width:100%;display:flex;flex-direction:column;gap:7px}.token-chips,.chip-with-info,.position-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.action-row{margin-top:2px}.connection-status{display:flex;flex-direction:column;gap:2px;margin:-2px 0 2px 190px;padding:7px 9px;border-radius:5px;border:1px solid var(--ui-border-control);font-size:11px}.connection-status.ok{border-color:var(--ui-success)}.connection-status.error{border-color:var(--ui-danger)}.connection-status span{color:var(--text-muted);font-size:10px}.cache-section{display:flex;flex-direction:column;gap:10px}.section-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.cache-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px}.cache-grid>div{display:flex;flex-direction:column;gap:3px;padding:8px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control)}.cache-grid span{font-size:10px;color:var(--text-muted)}.cache-grid strong{font-size:12px}.empty-note{font-size:11px;color:var(--text-muted);padding:8px;border:1px dashed var(--ui-border-control);border-radius:5px}.downloaded-heading{font-weight:700;margin-bottom:9px}.el-table small{display:block;margin-top:2px}@media(max-width:720px){.cache-grid{grid-template-columns:1fr 1fr}.connection-status{margin-left:0}.section-title-row{flex-direction:column}.compact-map-form{--el-form-label-font-size:12px}}
</style>
