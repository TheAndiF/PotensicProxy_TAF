<template>
  <div class="map-view" ref="root" @wheel.prevent="onWheel">
    <MapTileLayer
      :center-latitude="centerLat"
      :center-longitude="centerLon"
      :zoom="zoom"
      :width="size.w"
      :height="size.h"
      :revision="tileRevision"
      @tile-error="onTileError"
      @tile-load="onTileLoad"
    />

    <svg v-if="homePoint" class="home-line" :width="size.w" :height="size.h" aria-hidden="true">
      <line :x1="size.w/2" :y1="size.h/2" :x2="homePoint.x" :y2="homePoint.y" />
    </svg>
    <div v-if="homePoint" class="home-marker" :style="{ left: homePoint.x+'px', top: homePoint.y+'px' }" :title="t('map.homePoint')">H</div>
    <div v-if="positionSource === 'drone'" class="drone-marker" :style="{ transform: `translate(-50%,-50%) rotate(${store.telemetry.heading || 0}deg)` }">▲</div>

    <div class="map-osd">
      <span>{{ positionLabel }}</span>
      <span>Z{{ zoom }}</span>
      <span v-if="showDataMode">{{ dataModeLabel }}</span>
    </div>

    <MapSourceControls
      v-if="config"
      class="map-standard-controls"
      :config="config"
      v-model="zoom"
      :show-data-mode="showDataMode"
      :compact="compact"
      @config-saved="config = $event"
      @error="quickError = $event"
    />

    <div v-if="tileError || quickError" class="map-error" role="status">
      {{ quickError || t('map.sourceUnavailable') }}
    </div>
    <div class="attribution">{{ config?.attribution || '' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { useI18n } from '../../i18n'
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService'
import { useMapPosition } from '../../composables/useMapPosition'
import { screenPoint } from '../../utils/mapProjection'
import MapTileLayer from '../map/MapTileLayer.vue'
import MapSourceControls from '../map/MapSourceControls.vue'
import type { MapConfig } from '../../types/map'

const props = withDefaults(defineProps<{ showDataMode?: boolean; compact?: boolean }>(), {
  showDataMode: false,
  compact: false
})

const store = useDroneStore()
const { t } = useI18n()
const { currentPosition, source: positionSource } = useMapPosition()
const root = ref<HTMLElement|null>(null)
const config = ref<MapConfig|null>(null)
const zoom = ref(15)
const size = ref({ w: 800, h: 500 })
const tileRevision = ref(0)
const tileError = ref(false)
const quickError = ref('')
let observer: ResizeObserver | null = null
let loadedAfterError = 0

const centerLat = computed(() => currentPosition.value?.latitude ?? 52.52)
const centerLon = computed(() => currentPosition.value?.longitude ?? 13.405)
const dataModeLabel = computed(() => ({ auto: 'AUTO', offline: t('map.offlineOnly').toUpperCase(), online: t('map.onlineFirst').toUpperCase() }[config.value?.dataMode || 'auto']))
const positionLabel = computed(() => {
  if (!currentPosition.value) return t('map.waitingGps')
  const coordinates = `${currentPosition.value.latitude.toFixed(6)}, ${currentPosition.value.longitude.toFixed(6)}`
  return positionSource.value === 'manual' ? `${coordinates} · ${t('map.currentManual').replace('Current position: ', '').replace('Aktuelle Position: ', '')}` : coordinates
})

const homePoint = computed(() => {
  const lat = store.telemetry.homeLatitude
  const lon = store.telemetry.homeLongitude
  if (!store.telemetry.homeSynced || !Number.isFinite(lat) || !Number.isFinite(lon) || lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null
  return screenPoint(lat, lon, centerLat.value, centerLon.value, zoom.value, size.value.w, size.value.h)
})

function setZoom(value:number){ zoom.value = Math.max(1, Math.min(19, Math.round(value))) }
function onWheel(event:WheelEvent){ setZoom(zoom.value + (event.deltaY < 0 ? 1 : -1)) }
function onTileError(){ tileError.value = true; loadedAfterError = 0 }
function onTileLoad(){
  if (!tileError.value) return
  loadedAfterError++
  if (loadedAfterError >= 3) tileError.value = false
}

function onMapConfigChanged(event: Event) {
  const detail = (event as CustomEvent<MapConfig>).detail
  if (!detail) return
  config.value = detail
  quickError.value = ''
  tileError.value = false
  tileRevision.value++
}

async function refreshSize(){
  await nextTick()
  const measure = () => {
    if (!root.value) return
    const rect = root.value.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) size.value = { w: rect.width, h: rect.height }
  }
  requestAnimationFrame(() => { measure(); requestAnimationFrame(measure) })
  window.setTimeout(measure, 80)
  window.setTimeout(measure, 180)
}

onMounted(async () => {
  try {
    config.value = await MapService.getConfig()
    zoom.value = config.value.defaultZoom || 15
  } catch {}
  if (root.value) {
    observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    })
    observer.observe(root.value)
  }
  window.addEventListener('cockpit-view-resized', refreshSize)
  window.addEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged)
  await refreshSize()
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('cockpit-view-resized', refreshSize)
  window.removeEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged)
})

watch(() => config.value?.defaultZoom, value => { if (value) zoom.value = value })
</script>

<style scoped>
.map-view{position:relative;width:100%;height:100%;overflow:hidden;background:#18202b;user-select:none}.home-line{position:absolute;inset:0;z-index:4;pointer-events:none}.home-line line{stroke:var(--ui-warning);stroke-width:1.5;stroke-dasharray:5 4;opacity:.8}.home-marker{position:absolute;z-index:5;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ui-warning);color:#111;font-size:11px;font-weight:800;border:2px solid var(--ui-text-strong);box-shadow:0 1px 5px var(--ui-bg-stage)}.drone-marker{position:absolute;left:50%;top:50%;z-index:5;color:var(--ui-success);font-size:30px;line-height:1;text-shadow:0 1px 5px var(--ui-bg-stage)}.map-osd{position:absolute;top:10px;left:10px;z-index:6;display:flex;gap:8px;flex-wrap:wrap}.map-osd span,.attribution,.map-error{background:rgba(13,16,26,.80);color:#e6edf7;border:1px solid var(--ui-border-control);border-radius:4px;padding:4px 7px;font-size:10px}.map-standard-controls{position:absolute;z-index:7;right:10px;top:10px}.map-error{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);border-color:var(--ui-danger);color:var(--ui-danger);font-size:12px;font-weight:700}.attribution{position:absolute;right:8px;bottom:7px;z-index:6;padding:2px 5px;font-size:9px}@media(max-width:760px){.map-standard-controls{left:10px;right:auto;top:42px}}
</style>
