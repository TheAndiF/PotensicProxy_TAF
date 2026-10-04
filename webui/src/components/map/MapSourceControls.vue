<template>
  <div class="standard-map-controls" :class="{ compact }" @wheel.stop @click.stop>
    <label class="source-field">
      <span>{{ t('map.view') }}</span>
      <select :value="sourcePreset" :disabled="busy" :aria-label="t('map.source')" @change="changeSource">
        <option value="osm">OpenStreetMap</option>
        <option value="mapbox-satellite">{{ t('map.satellite') }}</option>
        <option value="mapbox-streets">Mapbox Streets</option>
        <option value="mapbox-outdoors">Mapbox Outdoors</option>
        <option value="mapbox-style">Mapbox Studio Style</option>
        <option value="custom">Custom XYZ</option>
      </select>
    </label>

    <label v-if="showDataMode" class="source-field">
      <span>{{ t('map.data') }}</span>
      <select :value="config?.dataMode || 'auto'" :disabled="busy" :aria-label="t('map.data')" @change="changeDataMode">
        <option value="auto">Auto</option>
        <option value="offline">{{ t('map.offlineOnly') }}</option>
        <option value="online">{{ t('map.onlineFirst') }}</option>
      </select>
    </label>

    <div class="zoom-control" :aria-label="t('map.zoom')">
      <span>{{ t('map.zoom') }}</span>
      <div class="zoom-row">
        <button type="button" :title="t('map.zoomOut')" @click="setZoom(modelValue - 1)">-</button>
        <input type="number" min="1" max="19" step="1" :value="modelValue" :aria-label="t('map.zoom')" @change="onZoomInput" />
        <button type="button" :title="t('map.zoomIn')" @click="setZoom(modelValue + 1)">+</button>
      </div>
    </div>

    <div v-if="isMapbox || localError" class="quick-status">
      <span v-if="isMapbox">{{ config?.hasAccessToken ? t('map.tokenStored') : t('map.tokenMissing') }}</span>
      <span v-if="localError" class="quick-error">{{ localError }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import { MapService } from '../../services/MapService'
import type { MapConfig, MapDataMode } from '../../types/map'

const props = withDefaults(defineProps<{
  config: MapConfig | null
  modelValue: number
  showDataMode?: boolean
  compact?: boolean
}>(), { showDataMode: false, compact: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'config-saved', value: MapConfig): void
  (e: 'error', message: string): void
}>()

const { t } = useI18n()
const busy = ref(false)
const localError = ref('')
const isMapbox = computed(() => props.config?.provider === 'mapbox-satellite' || props.config?.provider === 'mapbox-style')
const sourcePreset = computed(() => {
  const config = props.config
  if (!config) return 'osm'
  if (config.provider !== 'mapbox-style') return config.provider
  const style = config.mapboxStyle.replace(/^mapbox:\/\/styles\//, '')
  if (style === 'mapbox/streets-v12') return 'mapbox-streets'
  if (style === 'mapbox/outdoors-v12') return 'mapbox-outdoors'
  return 'mapbox-style'
})

function setZoom(value: number) { emit('update:modelValue', Math.max(1, Math.min(19, Math.round(value)))) }
function onZoomInput(event: Event) { setZoom(Number((event.target as HTMLInputElement).value)) }

async function savePatch(patch: Partial<MapConfig>, fallback: string) {
  if (!props.config) return
  busy.value = true
  localError.value = ''
  try {
    const saved = await MapService.saveConfig(patch)
    emit('config-saved', saved)
  } catch (error: any) {
    localError.value = error?.message || fallback
    emit('error', localError.value)
  } finally {
    busy.value = false
  }
}

function changeSource(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const patch: Partial<MapConfig> = value === 'mapbox-streets'
    ? { provider: 'mapbox-style', style: 'street', mapboxStyle: 'mapbox://styles/mapbox/streets-v12', attribution: '© Mapbox © OpenStreetMap' }
    : value === 'mapbox-outdoors'
      ? { provider: 'mapbox-style', style: 'outdoors', mapboxStyle: 'mapbox://styles/mapbox/outdoors-v12', attribution: '© Mapbox © OpenStreetMap' }
      : value === 'mapbox-satellite'
        ? { provider: 'mapbox-satellite', style: 'satellite', attribution: '© Mapbox © OpenStreetMap' }
        : value === 'mapbox-style'
          ? { provider: 'mapbox-style', style: 'mapbox-style', attribution: '© Mapbox © OpenStreetMap' }
          : value === 'custom'
            ? { provider: 'custom', style: 'custom' }
            : { provider: 'osm', style: 'street', attribution: '© OpenStreetMap contributors' }
  void savePatch(patch, t('map.sourceUnavailable'))
}

function changeDataMode(event: Event) {
  const dataMode = (event.target as HTMLSelectElement).value as MapDataMode
  void savePatch({ dataMode }, t('map.sourceUnavailable'))
}
</script>

<style scoped>
.standard-map-controls{display:flex;align-items:flex-end;gap:6px;padding:6px;background:rgba(13,16,26,.88);border:1px solid var(--ui-border-control);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.22);color:var(--ui-text-muted)}.source-field,.zoom-control{display:flex;flex-direction:column;gap:2px;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.source-field select{height:28px;max-width:180px;background:var(--ui-bg-control);color:var(--ui-text-strong);border:1px solid var(--ui-border-strong);border-radius:4px;padding:0 6px;font-size:11px}.zoom-row{display:flex}.zoom-row button,.zoom-row input{height:28px;background:var(--ui-bg-control);color:var(--ui-text-strong);border:1px solid var(--ui-border-strong)}.zoom-row button{width:30px;font-size:16px}.zoom-row input{width:42px;text-align:center;border-left:0;border-right:0;padding:0 2px;font:10px var(--mono)}.zoom-row input::-webkit-inner-spin-button{display:none}.quick-status{display:flex;flex-direction:column;align-self:center;max-width:190px;font-size:9px;line-height:1.25}.quick-error{color:var(--ui-danger,#ff6b6b)}.compact{padding:4px;gap:4px}.compact .source-field>span,.compact .zoom-control>span,.compact .quick-status{display:none}.compact .source-field select{max-width:132px;height:26px}.compact .zoom-row button,.compact .zoom-row input{height:26px}
@media(max-width:760px){.standard-map-controls{flex-wrap:wrap;max-width:calc(100vw - 90px)}.source-field select{max-width:145px}}
</style>
