<template>
  <div class="settings-page">
    <h2>Settings</h2>

    <el-card class="card version-card">
      <template #header>Version index</template>
      <el-descriptions v-if="version" :column="2" border size="small">
        <el-descriptions-item label="Project package">{{ version.projectVersion }}</el-descriptions-item>
        <el-descriptions-item label="Android app">{{ version.appVersion }}</el-descriptions-item>
        <el-descriptions-item label="Backend">{{ version.backendVersion }}</el-descriptions-item>
        <el-descriptions-item label="Web UI">{{ version.webUiVersion }}</el-descriptions-item>
        <el-descriptions-item label="Map module">{{ version.mapModuleVersion }}</el-descriptions-item>
        <el-descriptions-item label="Map API">v{{ version.mapApiVersion }}</el-descriptions-item>
        <el-descriptions-item label="Build date" :span="2">{{ version.buildDate }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-else-if="versionError" type="warning" :closable="false" :title="versionError" />
      <el-skeleton v-else :rows="2" animated />
    </el-card>


    <el-card class="card">
      <template #header>Cockpit display</template>
      <el-form label-width="190px">
        <el-form-item label="Main view">
          <el-radio-group v-model="mainView">
            <el-radio-button value="video">Liveview</el-radio-button>
            <el-radio-button value="map">Map</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Small window">
          <el-switch v-model="pipVisible" active-text="Visible" inactive-text="Hidden" />
        </el-form-item>
        <el-form-item label="Small window position">
          <el-radio-group v-model="pipPosition" :disabled="!pipVisible">
            <el-radio-button value="overlay">In main image</el-radio-button>
            <el-radio-button value="controls">Below controls</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          Liveview and map can always be swapped in the cockpit. The small-window position is independent of which view is currently large.
        </el-alert>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>Map source</template>
      <el-form v-if="config" label-width="170px">
        <el-form-item label="Provider">
          <el-select v-model="config.provider" @change="applyPreset">
            <el-option label="OpenStreetMap (online only)" value="osm" />
            <el-option label="Mapbox Satellite" value="mapbox-satellite" />
            <el-option label="Custom XYZ" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="Tile URL"><el-input v-model="config.tileUrlTemplate" /></el-form-item>
        <el-form-item label="API key / token"><el-input v-model="config.accessToken" type="password" show-password placeholder="stored only in backend" /></el-form-item>
        <el-form-item label="Attribution"><el-input v-model="config.attribution" /></el-form-item>
        <el-form-item label="Default zoom"><el-slider v-model="config.defaultZoom" :min="1" :max="19" show-input /></el-form-item>
        <el-form-item label="Map data">
          <el-radio-group v-model="config.dataMode">
            <el-radio-button value="auto">Auto</el-radio-button>
            <el-radio-button value="offline">Offline only</el-radio-button>
            <el-radio-button value="online">Online</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item><el-button type="primary" @click="saveConfig">Save</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>Download offline area</template>
      <el-alert
        v-if="config?.provider === 'osm'"
        class="offline-warning"
        type="warning"
        :closable="false"
        title="The public OpenStreetMap tile service does not permit bulk/offline preloading. Select Mapbox or a custom provider that explicitly permits offline downloads."
      />
      <el-form label-width="170px">
        <el-form-item label="Latitude"><el-input-number v-model="draft.latitude" :precision="6" :step="0.001" /></el-form-item>
        <el-form-item label="Longitude"><el-input-number v-model="draft.longitude" :precision="6" :step="0.001" /></el-form-item>
        <el-form-item><el-button @click="useDronePosition" :disabled="!hasGps">Use current drone position</el-button></el-form-item>
        <el-form-item label="Radius"><el-input-number v-model="draft.radiusKm" :min="0.1" :max="50" :step="0.5" /> km</el-form-item>
        <el-form-item label="Zoom"><el-input-number v-model="draft.minZoom" :min="1" :max="19" /> <span class="sep">to</span> <el-input-number v-model="draft.maxZoom" :min="draft.minZoom" :max="19" /></el-form-item>
        <el-form-item><el-button type="success" @click="download" :disabled="config?.provider === 'osm'">Download area</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card class="card">
      <template #header>Stored areas</template>
      <el-table :data="regions" empty-text="No offline areas">
        <el-table-column prop="id" label="Region" min-width="170" />
        <el-table-column label="Radius" width="90"><template #default="s">{{ (s.row.radiusM / 1000).toFixed(1) }} km</template></el-table-column>
        <el-table-column label="Zoom" width="90"><template #default="s">{{ s.row.minZoom }}-{{ s.row.maxZoom }}</template></el-table-column>
        <el-table-column label="Status" min-width="180">
          <template #default="s">
            <el-progress v-if="s.row.status === 'downloading'" :percentage="pct(s.row)" />
            <el-tag v-else :type="s.row.status === 'ready' ? 'success' : 'warning'">{{ s.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column width="100"><template #default="s"><el-button type="danger" link @click="remove(s.row.id)">Delete</el-button></template></el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MapService } from '../../services/MapService'
import { useDroneStore } from '../../stores/useDroneStore'
import type { MapConfig, OfflineRegion, VersionInfo } from '../../types/map'
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings'

const store = useDroneStore()
const { mainView, pipVisible, pipPosition } = useCockpitViewSettings()
const config = ref<MapConfig | null>(null)
const version = ref<VersionInfo | null>(null)
const versionError = ref('')
const regions = ref<OfflineRegion[]>([])
const draft = reactive({ latitude: 52.52, longitude: 13.405, radiusKm: 5, minZoom: 11, maxZoom: 16 })
let timer: ReturnType<typeof setInterval> | undefined

const hasGps = computed(() => {
  const lat = store.telemetry.latitude
  const lon = store.telemetry.longitude
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)
})

function applyPreset() {
  if (!config.value) return
  if (config.value.provider === 'osm') {
    config.value.tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    config.value.attribution = '© OpenStreetMap contributors'
    config.value.accessToken = ''
  } else if (config.value.provider === 'mapbox-satellite') {
    config.value.tileUrlTemplate = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token={key}'
    config.value.attribution = '© Mapbox © OpenStreetMap'
  }
}

async function saveConfig() {
  try {
    config.value = await MapService.saveConfig(config.value!)
    ElMessage.success('Map settings saved')
  } catch (e: any) {
    ElMessage.error(e?.message || 'Could not save map settings')
  }
}

function useDronePosition() {
  draft.latitude = store.telemetry.latitude
  draft.longitude = store.telemetry.longitude
}

async function refresh() {
  try {
    regions.value = await MapService.regions()
  } catch (e: any) {
    // Avoid a toast every 1.5 s while the backend is temporarily unavailable.
    console.warn('Could not refresh offline regions:', e?.message || e)
  }
}

async function download() {
  if (config.value?.provider === 'osm') {
    ElMessage.warning('Offline preloading is not permitted for the public OpenStreetMap tile service.')
    return
  }
  try {
    await MapService.downloadRegion({
      latitude: draft.latitude,
      longitude: draft.longitude,
      radiusM: draft.radiusKm * 1000,
      minZoom: draft.minZoom,
      maxZoom: draft.maxZoom
    })
    await refresh()
    ElMessage.success('Offline download started')
  } catch (e: any) {
    ElMessage.error(e?.message || 'Could not start offline download')
  }
}

function pct(r: OfflineRegion) {
  return r.total ? Math.min(100, Math.round((r.downloaded / r.total) * 100)) : 0
}

async function remove(id: string) {
  try {
    await MapService.deleteRegion(id)
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || 'Could not delete offline region')
  }
}

onMounted(async () => {
  try {
    version.value = await MapService.getVersion()
  } catch (e: any) {
    versionError.value = `Version index unavailable: ${e?.message || 'backend not reachable'}`
  }
  try {
    config.value = await MapService.getConfig()
  } catch (e: any) {
    ElMessage.error(e?.message || 'Could not load map settings')
  }
  await refresh()
  timer = setInterval(refresh, 1500)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.settings-page{height:100%;overflow:auto;padding:18px;max-width:1000px;margin:auto}.settings-page h2{margin:0 0 14px;color:var(--cyan)}.card{margin-bottom:14px;background:var(--panel-bg);border-color:var(--border)}.sep{padding:0 10px;color:var(--text-muted)}.offline-warning{margin-bottom:14px}.version-card :deep(.el-descriptions__label){width:150px}
</style>
