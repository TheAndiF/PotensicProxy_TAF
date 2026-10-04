<template>
  <div class="mission-page">
    <aside class="mission-sidebar">
      <section class="panel">
        <div class="panel-title">Mission</div>
        <el-input v-model="mission.name" size="small" />
        <div class="button-row">
          <el-button size="small" @click="createMission">Neu</el-button>
          <el-button size="small" type="primary" @click="saveMission">Speichern</el-button>
        </div>
        <el-select v-model="selectedMissionId" size="small" placeholder="Gespeicherte Mission" @change="loadSelected">
          <el-option v-for="m in library" :key="m.id" :label="`${m.name} (${m.waypointCount})`" :value="m.id" />
        </el-select>
        <div class="button-row">
          <el-button size="small" :disabled="!selectedMissionId" @click="deleteSelected">Löschen</el-button>
          <el-button size="small" :disabled="mission.waypoints.length === 0" @click="exportPotensic">map.db</el-button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">Planungswerkzeuge</div>
        <div class="tool-grid">
          <el-button size="small" @click="mode='manual'" :type="mode==='manual' ? 'primary' : 'default'">Wegpunkt</el-button>
          <el-button size="small" @click="generateCircle">Kreis</el-button>
          <el-button size="small" @click="generatePolygon">Polygon</el-button>
          <el-button size="small" @click="generateGrid">Survey</el-button>
          <el-button size="small" @click="generateSpiral">Spirale</el-button>
          <el-button size="small" @click="reverseRoute">Umkehren</el-button>
        </div>
        <div class="form-grid">
          <label>Radius m <el-input-number v-model="params.radius" :min="1" :max="5000" size="small" /></label>
          <label>Punkte <el-input-number v-model="params.points" :min="3" :max="200" size="small" /></label>
          <label>Breite m <el-input-number v-model="params.width" :min="2" :max="5000" size="small" /></label>
          <label>Höhe m <el-input-number v-model="params.height" :min="2" :max="5000" size="small" /></label>
          <label>Raster m <el-input-number v-model="params.spacing" :min="1" :max="500" size="small" /></label>
          <label>Kurs ° <el-input-number v-model="params.heading" :min="0" :max="359" size="small" /></label>
        </div>
      </section>

      <section class="panel stats">
        <div><strong>{{ mission.waypoints.length }}</strong><span>Wegpunkte</span></div>
        <div><strong>{{ (distance / 1000).toFixed(2) }}</strong><span>km Strecke</span></div>
        <div><strong>{{ chunks }}</strong><span>ATOM-1-Blöcke</span></div>
      </section>
    </aside>

    <section class="mission-map-wrap">
      <div ref="mapRoot" class="mission-map" @click="onMapClick" @wheel.prevent="onWheel" @mousedown="beginPan">
        <MapTileLayer
          :center-latitude="center.latitude"
          :center-longitude="center.longitude"
          :zoom="zoom"
          :width="size.w"
          :height="size.h"
          :revision="tileRevision"
          @tile-error="tileError = true"
          @tile-load="tileError = false"
        />
        <svg class="route-layer" :width="size.w" :height="size.h">
          <polyline v-if="waypointScreen.length > 1" :points="waypointScreen.map(p => `${p.x},${p.y}`).join(' ')" />
        </svg>
        <button v-for="p in waypointScreen" :key="p.wp.id" class="wp-marker" :class="{selected:selectedWaypoint?.id===p.wp.id}" :style="{left:p.x+'px',top:p.y+'px'}" @click.stop="selectWaypoint(p.wp)">{{ p.wp.sequence }}</button>
        <div v-if="droneScreen" class="drone-marker" :style="{left:droneScreen.x+'px',top:droneScreen.y+'px',transform:`translate(-50%,-50%) rotate(${store.telemetry.heading||0}deg)`}">▲</div>
        <div v-if="homeScreen" class="home-marker" :style="{left:homeScreen.x+'px',top:homeScreen.y+'px'}">H</div>
        <div class="map-osd"><span>{{ center.latitude.toFixed(6) }}, {{ center.longitude.toFixed(6) }}</span><span>Z{{ zoom }}</span></div>
        <MapSourceControls v-if="mapConfig" class="standard-controls" :config="mapConfig" v-model="zoom" :show-data-mode="false" @config-saved="mapConfig = $event" />
        <button class="center-control" title="Auf Drohne zentrieren" @click.stop="centerOnDrone">⌖</button>
        <div v-if="tileError" class="map-error">{{ t('map.sourceUnavailable') }}</div>
        <div class="attribution">{{ mapConfig?.attribution || '' }}</div>
      </div>
    </section>

    <aside class="inspector">
      <section class="panel" v-if="selectedWaypoint">
        <div class="panel-title">Wegpunkt {{ selectedWaypoint.sequence }}</div>
        <div class="waypoint-form">
          <label>Breitengrad <el-input-number v-model="selectedWaypoint.latitude" :precision="7" :step="0.00001" size="small" /></label>
          <label>Längengrad <el-input-number v-model="selectedWaypoint.longitude" :precision="7" :step="0.00001" size="small" /></label>
          <label>Höhe m <el-input-number v-model="selectedWaypoint.altitude" :min="-500" :max="10000" size="small" /></label>
          <label>Geschwindigkeit m/s <el-input-number v-model="selectedWaypoint.speed" :min="0" :max="100" :step="0.5" size="small" /></label>
          <label>Yaw ° <el-input-number v-model="selectedWaypoint.yaw" :min="0" :max="359" size="small" /></label>
          <label>Gimbal ° <el-input-number v-model="selectedWaypoint.gimbalPitch" :min="-90" :max="30" size="small" /></label>
          <label>Zoom × <el-input-number v-model="selectedWaypoint.zoom" :min="1" :max="20" :step="0.1" size="small" /></label>
          <label>Verweildauer s <el-input-number v-model="selectedWaypoint.dwellTime" :min="0" :max="600" size="small" /></label>
          <label>Aktion
            <el-select v-model="selectedWaypoint.action" size="small"><el-option label="Keine" value="none"/><el-option label="Hover" value="hover"/><el-option label="RTH" value="rth"/><el-option label="Landung" value="land"/></el-select>
          </label>
          <label>Kamera
            <el-select v-model="selectedWaypoint.cameraAction" size="small"><el-option label="Keine" value="none"/><el-option label="Foto" value="photo"/><el-option label="Aufnahme Start" value="start-record"/><el-option label="Aufnahme Stop" value="stop-record"/></el-select>
          </label>
          <el-button size="small" type="danger" @click="removeSelected">Wegpunkt löschen</el-button>
        </div>
      </section>
      <section class="panel" v-else><div class="panel-title">Wegpunkt</div><p class="muted">Wegpunkt auf der Karte auswählen oder im Modus „Wegpunkt“ auf die Karte klicken.</p></section>

      <section class="panel validation">
        <div class="panel-title">ATOM-1-Prüfung</div>
        <div v-for="issue in issues" :key="issue.code" class="issue" :class="issue.level"><strong>{{ issue.level.toUpperCase() }}</strong><span>{{ issue.message }}</span></div>
        <div v-if="issues.length===0" class="issue ok"><strong>OK</strong><span>Keine Hinweise.</span></div>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDroneStore } from '../../stores/useDroneStore'
import { useI18n } from '../../i18n'
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService'
import { MissionService } from '../../services/MissionService'
import type { MapConfig } from '../../types/map'
import type { MissionGeometry, MissionSummary, MissionWaypoint, TAFMission } from '../../types/mission'
import { ATOM1_CAPABILITIES, newMission, newWaypoint } from '../../types/mission'
import MapTileLayer from '../map/MapTileLayer.vue'
import MapSourceControls from '../map/MapSourceControls.vue'
import { MAP_POSITION_CHANGED_EVENT } from '../../composables/useMapPosition'
import { geoPoint, screenPoint as projectScreen, worldPoint } from '../../utils/mapProjection'
import { circle, grid, pathLengthMeters, polygon, renumber, spiral, validateMission } from '../../mission/geometry'

const store = useDroneStore()
const { t } = useI18n()
const mission = ref<TAFMission>(newMission())
const library = ref<MissionSummary[]>([])
const selectedMissionId = ref('')
const selectedWaypoint = ref<MissionWaypoint | null>(null)
const mode = ref<'manual'>('manual')
const params = reactive({ radius: 40, points: 16, width: 60, height: 80, spacing: 12, heading: 0 })
const mapRoot = ref<HTMLElement|null>(null), size = ref({w:900,h:600}), zoom = ref(15), mapConfig=ref<MapConfig|null>(null)
const tileRevision = ref(0), tileError = ref(false)
const center = reactive({ latitude: 52.52, longitude: 13.405 })
let observer: ResizeObserver | null = null
let panning=false, panMoved=false, panStart={x:0,y:0}, panWorld={x:0,y:0}
const distance = computed(() => pathLengthMeters(mission.value.waypoints))
const chunks = computed(() => Math.max(1, Math.ceil(mission.value.waypoints.length / ATOM1_CAPABILITIES.maxWaypointsPerRecord)))
const issues = computed(() => validateMission(mission.value))

function validGps(){ const {latitude,longitude}=store.telemetry; return Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180&&!(latitude===0&&longitude===0) }
function world(lon:number,lat:number,z:number){return worldPoint(lon,lat,z)}
function unworld(x:number,y:number,z:number){return geoPoint(x,y,z)}
function screenPoint(lat:number,lon:number){return projectScreen(lat,lon,center.latitude,center.longitude,zoom.value,size.value.w,size.value.h)}
const waypointScreen=computed(()=>mission.value.waypoints.map(wp=>({...screenPoint(wp.latitude,wp.longitude),wp})))
const droneScreen=computed(()=>validGps()?screenPoint(store.telemetry.latitude,store.telemetry.longitude):null)
const homeScreen=computed(()=>{const lat=store.telemetry.homeLatitude,lon=store.telemetry.homeLongitude;return store.telemetry.homeSynced&&typeof lat==='number'&&typeof lon==='number'?screenPoint(lat,lon):null})
function onWheel(e:WheelEvent){zoom.value=Math.max(1,Math.min(19,zoom.value+(e.deltaY<0?1:-1)))}
function beginPan(e:MouseEvent){if(e.button!==0)return;panning=true;panMoved=false;panStart={x:e.clientX,y:e.clientY};panWorld=world(center.longitude,center.latitude,zoom.value)}
function movePan(e:MouseEvent){if(!panning)return;const dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;if(Math.abs(dx)+Math.abs(dy)>4)panMoved=true;const c=unworld(panWorld.x-dx,panWorld.y-dy,zoom.value);center.latitude=c.latitude;center.longitude=c.longitude}
function endPan(){panning=false}
function onMapClick(e:MouseEvent){if(panMoved){panMoved=false;return}if(mode.value!=='manual'||!mapRoot.value)return;const r=mapRoot.value.getBoundingClientRect(),c=world(center.longitude,center.latitude,zoom.value),p=unworld(c.x+(e.clientX-r.left)-size.value.w/2,c.y+(e.clientY-r.top)-size.value.h/2,zoom.value);const wp=newWaypoint(p.latitude,p.longitude,mission.value.waypoints.length+1);mission.value.waypoints.push(wp);mission.value.geometry={kind:'manual'};selectedWaypoint.value=wp}
function selectWaypoint(wp:MissionWaypoint){selectedWaypoint.value=wp}
function removeSelected(){if(!selectedWaypoint.value)return;mission.value.waypoints=renumber(mission.value.waypoints.filter(w=>w.id!==selectedWaypoint.value!.id));selectedWaypoint.value=null}
function currentCenter(){return mission.value.waypoints[0] ? {latitude:mission.value.waypoints[0].latitude,longitude:mission.value.waypoints[0].longitude} : {...center}}
function applyGenerated(points:MissionWaypoint[],kind:MissionGeometry['kind']){mission.value.waypoints=renumber(points);mission.value.geometry={kind,center:currentCenter(),parameters:{...params}};selectedWaypoint.value=mission.value.waypoints[0]||null}
function template(){return selectedWaypoint.value||mission.value.waypoints[0]}
function generateCircle(){applyGenerated(circle(currentCenter(),params.radius,params.points,template()),'circle')}
function generatePolygon(){applyGenerated(polygon(currentCenter(),params.radius,Math.max(3,Math.min(12,params.points)),params.heading,template()),'polygon')}
function generateGrid(){applyGenerated(grid(currentCenter(),params.width,params.height,params.spacing,params.heading,template()),'grid')}
function generateSpiral(){applyGenerated(spiral(currentCenter(),Math.max(1,params.radius/8),params.radius,3,params.points,template()),'spiral')}
function reverseRoute(){mission.value.waypoints=renumber([...mission.value.waypoints].reverse())}
function centerOnDrone(){if(validGps()){center.latitude=store.telemetry.latitude;center.longitude=store.telemetry.longitude}else if(mission.value.waypoints[0]){center.latitude=mission.value.waypoints[0].latitude;center.longitude=mission.value.waypoints[0].longitude}}
function createMission(){mission.value=newMission();selectedMissionId.value='';selectedWaypoint.value=null;centerOnDrone()}
async function refreshLibrary(){try{library.value=await MissionService.list()}catch(e){ElMessage.warning(`Missionsspeicher nicht erreichbar: ${e instanceof Error?e.message:e}`)}}
async function saveMission(){try{mission.value=await MissionService.save(mission.value);selectedMissionId.value=mission.value.id;await refreshLibrary();ElMessage.success('Mission gespeichert');return true}catch(e){ElMessage.error(`Speichern fehlgeschlagen: ${e instanceof Error?e.message:e}`);return false}}
async function loadSelected(){if(!selectedMissionId.value)return;try{mission.value=await MissionService.load(selectedMissionId.value);selectedWaypoint.value=mission.value.waypoints[0]||null;if(mission.value.waypoints[0]){center.latitude=mission.value.waypoints[0].latitude;center.longitude=mission.value.waypoints[0].longitude}}catch(e){ElMessage.error(`Laden fehlgeschlagen: ${e instanceof Error?e.message:e}`)}}
async function deleteSelected(){if(!selectedMissionId.value)return;try{await ElMessageBox.confirm('Gespeicherte Mission wirklich löschen?','Mission löschen');await MissionService.remove(selectedMissionId.value);createMission();await refreshLibrary()}catch{}}
async function exportPotensic(){if(await saveMission())window.location.href=MissionService.exportPotensicUrl(mission.value.id)}

function onMapConfigChanged(event: Event){const detail=(event as CustomEvent<MapConfig>).detail;if(!detail)return;mapConfig.value=detail;tileRevision.value++;tileError.value=false}
function onMapPositionChanged(event: Event){const detail=(event as CustomEvent<{latitude:number;longitude:number}>).detail;if(!detail)return;center.latitude=detail.latitude;center.longitude=detail.longitude}

onMounted(async()=>{window.addEventListener('mousemove',movePan);window.addEventListener('mouseup',endPan);window.addEventListener(MAP_CONFIG_CHANGED_EVENT,onMapConfigChanged);window.addEventListener(MAP_POSITION_CHANGED_EVENT,onMapPositionChanged);try{mapConfig.value=await MapService.getConfig();zoom.value=mapConfig.value.defaultZoom||15}catch{};if(validGps()){center.latitude=store.telemetry.latitude;center.longitude=store.telemetry.longitude}if(mapRoot.value){observer=new ResizeObserver(([e])=>{if(e.contentRect.width>0&&e.contentRect.height>0)size.value={w:e.contentRect.width,h:e.contentRect.height}});observer.observe(mapRoot.value)}await nextTick();await refreshLibrary()})
onUnmounted(()=>{observer?.disconnect();window.removeEventListener('mousemove',movePan);window.removeEventListener('mouseup',endPan);window.removeEventListener(MAP_CONFIG_CHANGED_EVENT,onMapConfigChanged);window.removeEventListener(MAP_POSITION_CHANGED_EVENT,onMapPositionChanged)})
</script>

<style scoped>
.mission-page{height:100%;display:grid;grid-template-columns:260px minmax(420px,1fr) 300px;gap:8px;padding:8px;background:var(--ui-bg-stage);color:var(--text);box-sizing:border-box}.mission-sidebar,.inspector{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}.panel{background:var(--ui-bg-panel);border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px}.panel-title{font-size:12px;font-weight:800;color:var(--ui-text-strong);text-transform:uppercase;letter-spacing:.5px}.button-row,.tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.form-grid,.waypoint-form{display:flex;flex-direction:column;gap:7px}.form-grid label,.waypoint-form label{font-size:10px;color:var(--muted);display:grid;grid-template-columns:1fr 116px;gap:8px;align-items:center}.mission-map-wrap{min-width:0;min-height:0}.mission-map{position:relative;width:100%;height:100%;overflow:hidden;background:#18202b;border:1px solid var(--border);border-radius:6px;user-select:none}.tiles{position:absolute;inset:0}.tile{position:absolute;width:256px;height:256px}.route-layer{position:absolute;inset:0;z-index:4;pointer-events:none}.route-layer polyline{fill:none;stroke:var(--cyan);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}.wp-marker{position:absolute;z-index:6;transform:translate(-50%,-50%);width:25px;height:25px;border-radius:50%;border:2px solid var(--ui-text-strong);background:var(--ui-primary);color:#fff;font-size:9px;font-weight:800;padding:0;cursor:pointer}.wp-marker.selected{box-shadow:0 0 0 3px var(--ui-warning)}.drone-marker{position:absolute;z-index:7;color:var(--ui-success);font-size:28px;text-shadow:0 1px 4px #000}.home-marker{position:absolute;z-index:7;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ui-warning);color:#111;font-weight:800;border:2px solid #fff}.map-osd{position:absolute;left:10px;top:10px;z-index:8;display:flex;gap:6px}.map-osd span,.attribution{background:rgba(13,16,26,.82);border:1px solid var(--ui-border-control);border-radius:4px;padding:4px 7px;font-size:10px}.standard-controls{position:absolute;right:10px;top:10px;z-index:8}.center-control{position:absolute;right:10px;top:76px;z-index:9;width:34px;height:31px;background:var(--ui-bg-control);color:var(--ui-text-strong);border:1px solid var(--ui-border-strong);font-size:16px}.map-error{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;background:rgba(13,16,26,.88);border:1px solid var(--ui-danger);color:var(--ui-danger);padding:6px 9px;border-radius:4px;font-size:11px}.attribution{position:absolute;right:8px;bottom:7px;z-index:8;padding:2px 5px;font-size:9px}.stats{display:grid;grid-template-columns:repeat(3,1fr);text-align:center}.stats div{display:flex;flex-direction:column}.stats strong{font-size:16px;color:var(--cyan)}.stats span{font-size:9px;color:var(--muted)}.issue{display:grid;grid-template-columns:52px 1fr;gap:6px;padding:6px;border-radius:4px;font-size:10px;background:var(--ui-bg-control)}.issue.error strong{color:var(--ui-danger)}.issue.warning strong{color:var(--ui-warning)}.issue.info strong{color:var(--cyan)}.issue.ok strong{color:var(--ui-success)}.muted{font-size:11px;color:var(--muted);line-height:1.45}.validation{margin-bottom:8px}@media(max-width:1050px){.mission-page{grid-template-columns:220px 1fr}.inspector{display:none}}@media(max-width:760px){.mission-page{grid-template-columns:1fr;grid-template-rows:auto minmax(420px,1fr)}.mission-sidebar{max-height:280px}.mission-map-wrap{min-height:420px}}
</style>
