<template>
  <div class="map-view" ref="root" @wheel.prevent="onWheel">
    <div class="tiles">
      <img v-for="t in tiles" :key="t.key" class="tile" :src="t.url" :style="{ left: t.left+'px', top: t.top+'px' }" draggable="false" />
    </div>
    <svg v-if="homePoint" class="home-line" :width="size.w" :height="size.h" aria-hidden="true">
      <line :x1="size.w/2" :y1="size.h/2" :x2="homePoint.x" :y2="homePoint.y" />
    </svg>
    <div v-if="homePoint" class="home-marker" :style="{ left: homePoint.x+'px', top: homePoint.y+'px' }" title="Home point">H</div>
    <div class="drone-marker" :style="{ transform: `translate(-50%,-50%) rotate(${store.telemetry.heading || 0}deg)` }">▲</div>

    <div class="map-osd">
      <span>{{ validGps ? `${store.telemetry.latitude.toFixed(6)}, ${store.telemetry.longitude.toFixed(6)}` : 'Waiting for GPS' }}</span>
      <span>Z{{ zoom }}</span>
      <span>{{ dataModeLabel }}</span>
    </div>

    <div v-if="config" class="map-quick-controls" @wheel.stop>
      <label>
        <span>Map</span>
        <select :value="sourcePreset" :disabled="savingQuick" @change="changeSource">
          <option value="osm">OpenStreetMap</option>
          <option value="mapbox-satellite">Mapbox Satellite</option>
          <option value="mapbox-streets">Mapbox Streets</option>
          <option value="mapbox-outdoors">Mapbox Outdoors</option>
          <option value="mapbox-style">Mapbox custom style</option>
          <option value="custom">Custom XYZ</option>
        </select>
      </label>
      <label>
        <span>Data</span>
        <select :value="config.dataMode" :disabled="savingQuick" @change="changeDataMode">
          <option value="auto">Auto · offline first</option>
          <option value="offline">Offline only</option>
          <option value="online">Online first</option>
        </select>
      </label>
      <div class="quick-status">
        <span v-if="isMapbox">Token {{ config.hasAccessToken ? 'saved' : 'missing' }}</span>
        <span v-if="quickError" class="quick-error">{{ quickError }}</span>
      </div>
    </div>

    <div class="map-controls">
      <button @click.stop="setZoom(zoom + 1)">+</button>
      <input class="map-zoom-input" type="number" min="1" max="19" step="1" :value="zoom" aria-label="Map zoom" @click.stop @change="onZoomInput" />
      <button @click.stop="setZoom(zoom - 1)">−</button>
    </div>
    <div class="attribution">{{ config?.attribution || '' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService'
import type { MapConfig, MapDataMode } from '../../types/map'

const store = useDroneStore()
const root = ref<HTMLElement|null>(null)
const config = ref<MapConfig|null>(null)
const zoom = ref(15)
const size = ref({w:800,h:500})
const tileRevision = ref(0)
const savingQuick = ref(false)
const quickError = ref('')
let observer: ResizeObserver | null = null

const validGps = computed(() => {
  const lat = store.telemetry.latitude
  const lon = store.telemetry.longitude
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)
})
const centerLat = computed(() => validGps.value ? store.telemetry.latitude : 52.52)
const centerLon = computed(() => validGps.value ? store.telemetry.longitude : 13.405)
const isMapbox = computed(() => config.value?.provider === 'mapbox-satellite' || config.value?.provider === 'mapbox-style')
const dataModeLabel = computed(() => ({ auto: 'AUTO · offline first', offline: 'OFFLINE ONLY', online: 'ONLINE FIRST' }[config.value?.dataMode || 'auto']))
const sourcePreset = computed(() => {
  const c = config.value
  if (!c) return 'osm'
  if (c.provider !== 'mapbox-style') return c.provider
  const style = c.mapboxStyle.replace(/^mapbox:\/\/styles\//, '')
  if (style === 'mapbox/streets-v12') return 'mapbox-streets'
  if (style === 'mapbox/outdoors-v12') return 'mapbox-outdoors'
  return 'mapbox-style'
})

const homePoint = computed(() => {
  const lat = store.telemetry.homeLatitude
  const lon = store.telemetry.homeLongitude
  if (!store.telemetry.homeSynced || !Number.isFinite(lat) || !Number.isFinite(lon) || lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null
  const c = world(centerLon.value, centerLat.value, zoom.value)
  const h = world(lon, lat, zoom.value)
  return { x: h.x - c.x + size.value.w / 2, y: h.y - c.y + size.value.h / 2 }
})

function world(lon:number,lat:number,z:number){
  const n=256*Math.pow(2,z)
  const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat))
  const x=(lon+180)/360*n
  const s=Math.sin(safeLat*Math.PI/180)
  const y=(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n
  return {x,y}
}

const tiles = computed(() => {
  const c=world(centerLon.value,centerLat.value,zoom.value), z=zoom.value, n=1<<z
  const x0=Math.floor((c.x-size.value.w/2)/256)-1, x1=Math.floor((c.x+size.value.w/2)/256)+1
  const y0=Math.floor((c.y-size.value.h/2)/256)-1, y1=Math.floor((c.y+size.value.h/2)/256)+1, out:any[]=[]
  for(let tx=x0;tx<=x1;tx++) for(let ty=y0;ty<=y1;ty++){
    if(ty<0||ty>=n) continue
    const x=((tx%n)+n)%n
    out.push({
      key:`${z}/${x}/${ty}/${tileRevision.value}`,
      url:MapService.tileUrl(z,x,ty,tileRevision.value),
      left:tx*256-c.x+size.value.w/2,
      top:ty*256-c.y+size.value.h/2
    })
  }
  return out
})

function setZoom(value:number){ zoom.value=Math.max(1,Math.min(19,Math.round(value))) }
function onZoomInput(e:Event){ setZoom(Number((e.target as HTMLInputElement).value)) }
function onWheel(e:WheelEvent){ setZoom(zoom.value+(e.deltaY<0?1:-1)) }

async function changeSource(e: Event) {
  if (!config.value) return
  const value = (e.target as HTMLSelectElement).value
  quickError.value = ''
  savingQuick.value = true
  try {
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
    config.value = await MapService.saveConfig(patch)
  } catch (e: any) {
    quickError.value = e?.message || 'Could not switch map source'
  } finally {
    savingQuick.value = false
  }
}

async function changeDataMode(e: Event) {
  if (!config.value) return
  quickError.value = ''
  savingQuick.value = true
  try {
    const dataMode = (e.target as HTMLSelectElement).value as MapDataMode
    config.value = await MapService.saveConfig({ dataMode })
  } catch (e: any) {
    quickError.value = e?.message || 'Could not change map data mode'
  } finally {
    savingQuick.value = false
  }
}

function onMapConfigChanged(event: Event) {
  const detail = (event as CustomEvent<MapConfig>).detail
  if (!detail) return
  config.value = detail
  tileRevision.value++
}

async function refreshSize(){
  await nextTick()
  const measure=()=>{
    if(!root.value)return
    const r=root.value.getBoundingClientRect()
    if(r.width>0&&r.height>0) size.value={w:r.width,h:r.height}
  }
  requestAnimationFrame(()=>{ measure(); requestAnimationFrame(measure) })
  window.setTimeout(measure,80)
  window.setTimeout(measure,180)
}

onMounted(async()=>{
  try{
    config.value=await MapService.getConfig()
    zoom.value=config.value.defaultZoom||15
  }catch{}
  if(root.value){
    observer=new ResizeObserver(([e])=>{if(e.contentRect.width>0&&e.contentRect.height>0)size.value={w:e.contentRect.width,h:e.contentRect.height}})
    observer.observe(root.value)
  }
  window.addEventListener('cockpit-view-resized',refreshSize)
  window.addEventListener(MAP_CONFIG_CHANGED_EVENT,onMapConfigChanged)
  await refreshSize()
})

onUnmounted(()=>{
  observer?.disconnect()
  window.removeEventListener('cockpit-view-resized',refreshSize)
  window.removeEventListener(MAP_CONFIG_CHANGED_EVENT,onMapConfigChanged)
})
watch(()=>config.value?.defaultZoom,z=>{if(z)zoom.value=z})
</script>

<style scoped>
.map-view{position:relative;width:100%;height:100%;overflow:hidden;background:#18202b;user-select:none}.tiles{position:absolute;inset:0}.tile{position:absolute;width:256px;height:256px}.home-line{position:absolute;inset:0;z-index:4;pointer-events:none}.home-line line{stroke:var(--ui-warning);stroke-width:1.5;stroke-dasharray:5 4;opacity:.8}.home-marker{position:absolute;z-index:5;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ui-warning);color:#111;font-size:11px;font-weight:800;border:2px solid var(--ui-text-strong);box-shadow:0 1px 5px var(--ui-bg-stage)}.drone-marker{position:absolute;left:50%;top:50%;z-index:5;color:var(--ui-success);font-size:30px;line-height:1;text-shadow:0 1px 5px var(--ui-bg-stage)}.map-osd{position:absolute;top:10px;left:10px;z-index:6;display:flex;gap:8px;flex-wrap:wrap}.map-osd span,.attribution{background:rgba(13,16,26,.80);color:#e6edf7;border:1px solid var(--ui-border-control);border-radius:4px;padding:4px 7px;font-size:10px}.map-controls{position:absolute;right:10px;top:10px;z-index:7;display:flex;flex-direction:column}.map-controls button{width:38px;height:30px;background:var(--ui-bg-control);color:var(--ui-text-strong);border:1px solid var(--ui-border-strong);font-size:18px}.map-zoom-input{width:38px;height:30px;border:1px solid var(--ui-border-strong);border-top:0;border-bottom:0;background:var(--ui-bg-control);color:var(--ui-text-strong);font:10px var(--mono);text-align:center;padding:0 2px}.map-zoom-input::-webkit-inner-spin-button{display:none}.map-quick-controls{position:absolute;z-index:7;right:56px;top:10px;display:flex;align-items:flex-end;gap:6px;padding:6px;background:rgba(13,16,26,.88);border:1px solid var(--ui-border-control);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.22)}.map-quick-controls label{display:flex;flex-direction:column;gap:2px;color:var(--ui-text-muted);font-size:9px;text-transform:uppercase;letter-spacing:.04em}.map-quick-controls select{height:27px;max-width:170px;background:var(--ui-bg-control);color:var(--ui-text-strong);border:1px solid var(--ui-border-strong);border-radius:4px;padding:0 6px;font-size:11px}.quick-status{display:flex;flex-direction:column;align-self:center;max-width:190px;color:var(--ui-text-muted);font-size:9px;line-height:1.25}.quick-error{color:var(--ui-danger,#ff6b6b)}.attribution{position:absolute;right:8px;bottom:7px;z-index:6;padding:2px 5px;font-size:9px}@media(max-width:760px){.map-quick-controls{left:10px;right:auto;top:42px;flex-wrap:wrap;max-width:calc(100% - 70px)}.map-quick-controls select{max-width:145px}}
</style>
