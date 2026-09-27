<template>
  <div class="map-view" ref="root" @wheel.prevent="onWheel">
    <div class="tiles">
      <img v-for="t in tiles" :key="t.key" class="tile" :src="t.url" :style="{ left: t.left+'px', top: t.top+'px' }" draggable="false" />
    </div>
    <div class="drone-marker" :style="{ transform: `translate(-50%,-50%) rotate(${store.telemetry.heading || 0}deg)` }">▲</div>
    <div class="map-osd">
      <span>{{ validGps ? `${store.telemetry.latitude.toFixed(6)}, ${store.telemetry.longitude.toFixed(6)}` : 'Waiting for GPS' }}</span>
      <span>Z{{ zoom }}</span>
    </div>
    <div class="map-controls">
      <button @click.stop="zoom = Math.min(19, zoom + 1)">+</button>
      <button @click.stop="zoom = Math.max(1, zoom - 1)">−</button>
    </div>
    <div class="attribution">{{ config?.attribution || '' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { MapService } from '../../services/MapService'
import type { MapConfig } from '../../types/map'

const store = useDroneStore(); const root = ref<HTMLElement|null>(null); const config = ref<MapConfig|null>(null)
const zoom = ref(15); const size = ref({w:800,h:500}); let observer: ResizeObserver | null = null
const validGps = computed(() => {
  const lat = store.telemetry.latitude
  const lon = store.telemetry.longitude
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)
})
const centerLat = computed(() => validGps.value ? store.telemetry.latitude : 52.52)
const centerLon = computed(() => validGps.value ? store.telemetry.longitude : 13.405)
function world(lon:number,lat:number,z:number){ const n=256*Math.pow(2,z); const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat)); const x=(lon+180)/360*n; const s=Math.sin(safeLat*Math.PI/180); const y=(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n; return {x,y} }
const tiles = computed(() => {
  const c=world(centerLon.value,centerLat.value,zoom.value), z=zoom.value, n=1<<z, x0=Math.floor((c.x-size.value.w/2)/256)-1, x1=Math.floor((c.x+size.value.w/2)/256)+1, y0=Math.floor((c.y-size.value.h/2)/256)-1, y1=Math.floor((c.y+size.value.h/2)/256)+1, out:any[]=[]
  for(let tx=x0;tx<=x1;tx++) for(let ty=y0;ty<=y1;ty++){ if(ty<0||ty>=n) continue; const x=((tx%n)+n)%n; out.push({key:`${z}/${x}/${ty}`,url:MapService.tileUrl(z,x,ty),left:tx*256-c.x+size.value.w/2,top:ty*256-c.y+size.value.h/2}) }
  return out
})
function onWheel(e:WheelEvent){ zoom.value=Math.max(1,Math.min(19,zoom.value+(e.deltaY<0?1:-1))) }
onMounted(async()=>{ try{config.value=await MapService.getConfig();zoom.value=config.value.defaultZoom||15}catch{}; if(root.value){observer=new ResizeObserver(([e])=>size.value={w:e.contentRect.width,h:e.contentRect.height});observer.observe(root.value)} })
onUnmounted(()=>observer?.disconnect())
watch(()=>config.value?.defaultZoom,z=>{if(z)zoom.value=z})
</script>

<style scoped>
.map-view{position:relative;width:100%;height:100%;overflow:hidden;background:#18202b;user-select:none}.tiles{position:absolute;inset:0}.tile{position:absolute;width:256px;height:256px}.drone-marker{position:absolute;left:50%;top:50%;z-index:5;color:#00ff88;font-size:30px;line-height:1;text-shadow:0 1px 5px #000}.map-osd{position:absolute;top:10px;left:10px;z-index:6;display:flex;gap:8px}.map-osd span,.attribution{background:#0d101acc;color:#e6edf7;border:1px solid #30384f;border-radius:4px;padding:4px 7px;font-size:10px}.map-controls{position:absolute;right:10px;top:10px;z-index:6;display:flex;flex-direction:column}.map-controls button{width:32px;height:30px;background:#151b2a;color:#fff;border:1px solid #3b455f;font-size:18px}.attribution{position:absolute;right:8px;bottom:7px;z-index:6;padding:2px 5px;font-size:9px}
</style>
