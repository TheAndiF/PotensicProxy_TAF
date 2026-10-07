<template>
  <div class="cockpit-layout">
    <div class="left-section">
      <div class="flight-stage">
        <div id="main-stage-slot" class="main-stage-slot"></div>
        <div id="hidden-view-slot" class="hidden-view-slot" aria-hidden="true"></div>
        <div
          v-show="pipVisible && pipPosition === 'overlay'"
          id="pip-overlay-slot"
          class="pip-slot pip-overlay-slot"
          title="Swap Liveview and map"
          @click="swapViews"
        ></div>

        <div class="view-drawer" :class="{ open: viewMenuOpen }">
          <button class="view-drawer-toggle" type="button" :title="viewMenuOpen ? 'Hide view controls' : 'Show view controls'" @click="viewMenuOpen = !viewMenuOpen">{{ viewMenuOpen ? '›' : '‹' }}</button>
          <div v-if="viewMenuOpen" class="view-toolbar">
            <button :class="{ active: mainView === 'video' }" @click="mainView = 'video'">LIVE</button>
            <button :class="{ active: mainView === 'map' }" @click="mainView = 'map'">MAP</button>
            <button :class="{ active: pipVisible }" @click="pipVisible = !pipVisible">PIP</button>
          </div>
        </div>

        <TelemetryBar class="stage-status-overlay" />
      </div>
    </div>

    <div class="right-panel">
      <div class="panel-title">🕹️ Joystick Control</div>
      <div class="joysticks-container">
        <VirtualJoystick label="Throttle / Yaw" :value-labels="['Throttle', 'Yaw']" v-model="leftStickModel" :rc-echo="{ x: store.rcHardwareJoysticks.yaw, y: store.rcHardwareJoysticks.throttle }" @change="onJoystickChange" @control-start="startLeftControl" @control-end="stopLeftControl"/>
        <VirtualJoystick label="Pitch / Roll" :value-labels="['Pitch', 'Roll']" v-model="rightStickModel" :rc-echo="{ x: store.rcHardwareJoysticks.roll, y: store.rcHardwareJoysticks.pitch }" @change="onRightStickChange" @control-start="startRightControl" @control-end="stopRightControl"/>
      </div>
      <GimbalControl/>

      <LandingAssistPanel @control-start="startLandingControl" @control-end="stopLandingControl" @change="onLandingControlChange"/>

      <FlightActions/>

      <section class="camera-section ui-card">
        <button class="camera-section-header" type="button" @click="cameraOpen = !cameraOpen" :aria-expanded="cameraOpen">
          <span>📷 Camera</span><span>{{ cameraOpen ? '▾' : '▸' }}</span>
        </button>
        <div v-if="cameraOpen" class="camera-section-body">
          <CameraMediaPanel :show-title="false"/>
        </div>
      </section>

      <section class="telemetry-section ui-card">
        <button class="telemetry-section-header" type="button" @click="telemetryOpen = !telemetryOpen" :aria-expanded="telemetryOpen">
          <span>📡 Telemetrie</span><span>{{ telemetryOpen ? '▾' : '▸' }}</span>
        </button>
        <div v-if="telemetryOpen" class="telemetry-section-body">
          <TelemetryDetails />
        </div>
      </section>

      <div v-show="pipVisible && pipPosition === 'controls'" class="controls-pip-section">
        <div class="panel-title">{{ secondaryLabel }} preview</div>
        <div id="pip-controls-slot" class="pip-slot pip-controls-slot" title="Swap Liveview and map" @click="swapViews"></div>
      </div>
    </div>

    <Teleport v-if="teleportsReady" :to="videoTarget">
      <div :class="['teleported-view', { 'small-view': mainView !== 'video' }]">
        <VideoPlayer :compact="mainView !== 'video'" />
        <span v-if="mainView !== 'video'" class="small-view-label">VIDEO</span>
      </div>
    </Teleport>

    <Teleport v-if="teleportsReady" :to="mapTarget">
      <div :class="['teleported-view', { 'small-view': mainView !== 'map', 'small-map-view': mainView !== 'map' }]">
        <MapView :show-data-mode="mainView === 'map'" :compact="mainView !== 'map'"/>
        <span v-if="mainView !== 'map'" class="small-view-label">MAP</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import MapView from './MapView.vue'
import TelemetryBar from './TelemetryBar.vue'
import VirtualJoystick from './VirtualJoystick.vue'
import GimbalControl from './GimbalControl.vue'
import LandingAssistPanel from './LandingAssistPanel.vue'
import FlightActions from './FlightActions.vue'
import CameraMediaPanel from './CameraMediaPanel.vue'
import TelemetryDetails from './TelemetryDetails.vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings'

const store = useDroneStore()
const { mainView, pipVisible, pipPosition, swapViews } = useCockpitViewSettings()
const teleportsReady = ref(false)
const viewMenuOpen = ref(false)
const cameraOpen = ref(localStorage.getItem('potensic-camera-panel-open') !== 'false')
watch(cameraOpen, value => localStorage.setItem('potensic-camera-panel-open', String(value)))
const telemetryOpen = ref(localStorage.getItem('potensic-telemetry-panel-open') === 'true')
watch(telemetryOpen, value => localStorage.setItem('potensic-telemetry-panel-open', String(value)))

const secondaryTarget = computed(() => pipPosition.value === 'controls' ? '#pip-controls-slot' : '#pip-overlay-slot')
const hiddenTarget = '#hidden-view-slot'
const videoTarget = computed(() => mainView.value === 'video' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget))
const mapTarget = computed(() => mainView.value === 'map' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget))
const secondaryLabel = computed(() => mainView.value === 'video' ? 'Map' : 'Liveview')

onMounted(async () => { await nextTick(); teleportsReady.value = true })
async function notifyViewResize() { await nextTick(); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('cockpit-view-resized'))) }
watch([mainView, pipVisible, pipPosition], notifyViewResize, { flush: 'post' })

const leftStickModel = computed({
  get: () => ({ x: store.userJoysticks.yaw, y: store.userJoysticks.throttle }),
  set: v => { store.userJoysticks.yaw = v.x; store.userJoysticks.throttle = v.y },
})
const rightStickModel = computed({
  get: () => ({ x: store.userJoysticks.roll, y: store.userJoysticks.pitch }),
  set: v => { store.userJoysticks.roll = v.x; store.userJoysticks.pitch = v.y },
})
let leftControlActive = false
let rightControlActive = false
let landingControlActive = false
let axisTimer: ReturnType<typeof setInterval> | null = null
let lastSend = 0

function sendAxesNow() {
  lastSend = Date.now()
  DroneControlService.sendJoysticks()
}
function ensureAxisLoop() {
  if (axisTimer) return
  sendAxesNow()
  // PotensicPro DataManager.startSend4Axis() transmits every 80 ms.
  axisTimer = setInterval(sendAxesNow, 80)
}
function maybeStopAxisLoop() {
  if (leftControlActive || rightControlActive || landingControlActive || store.gimbalControl.active) return
  if (axisTimer) { clearInterval(axisTimer); axisTimer = null }
  // Send a neutral frame immediately after both sticks have been released.
  sendAxesNow()
}
function startLeftControl() { leftControlActive = true; ensureAxisLoop() }
function stopLeftControl() { leftControlActive = false; maybeStopAxisLoop() }
function startRightControl() { rightControlActive = true; ensureAxisLoop() }
function stopRightControl() { rightControlActive = false; maybeStopAxisLoop() }
function startLandingControl() { landingControlActive = true; ensureAxisLoop() }
function stopLandingControl() { landingControlActive = false; maybeStopAxisLoop() }
function onLandingControlChange() { if (Date.now() - lastSend >= 80) sendAxesNow() }
function onJoystickChange() { if (Date.now() - lastSend >= 80) sendAxesNow() }
function onRightStickChange(v: { x: number; y: number }) {
  store.userJoysticks.roll = v.x
  store.userJoysticks.pitch = v.y
  if (Date.now() - lastSend >= 80) sendAxesNow()
}
watch(() => store.gimbalControl.active, active => {
  if (active) ensureAxisLoop()
  else maybeStopAxisLoop()
})
onBeforeUnmount(() => {
  DroneControlService.stopDirectGimbal('cockpit left')
  if (axisTimer) {
    sendAxesNow()
    clearInterval(axisTimer)
    axisTimer = null
  }
})
</script>

<style scoped>
.cockpit-layout{display:grid;grid-template-columns:1fr 340px;height:100%}
.left-section{display:flex;flex-direction:column;height:100%;background:var(--ui-bg-stage);position:relative;overflow:hidden}
.flight-stage{position:relative;flex:1;min-height:0;background:var(--ui-bg-stage);overflow:hidden}
.main-stage-slot{position:absolute;inset:0;z-index:1;overflow:hidden}
.hidden-view-slot{position:absolute;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none}
.pip-slot{overflow:hidden;border:2px solid #60708d;border-radius:8px;background:var(--ui-bg-stage);box-shadow:var(--ui-shadow-pip);cursor:pointer}
.pip-overlay-slot{position:absolute;right:16px;bottom:54px;width:230px;height:150px;z-index:20}
.teleported-view{position:relative;width:100%;height:100%;overflow:hidden}.teleported-view>*:first-child{width:100%;height:100%}.small-view>*:first-child{pointer-events:none}.small-map-view>*:first-child{pointer-events:auto}
.small-view-label{position:absolute;left:7px;bottom:6px;z-index:30;background:rgba(13,16,26,.52);color:#fff;font-size:10px;font-weight:700;padding:3px 6px;border-radius:3px;pointer-events:none}
.view-drawer{position:absolute;right:0;top:86px;z-index:42;display:flex;align-items:center}.view-drawer.open{gap:4px}
.view-drawer-toggle{width:24px;height:48px;border:1px solid rgba(255,255,255,.18);border-right:0;border-radius:7px 0 0 7px;background:rgba(7,10,16,.44);color:#fff;cursor:pointer;backdrop-filter:blur(4px)}
.view-toolbar{display:flex;flex-direction:column;gap:5px;padding:6px;background:rgba(7,10,16,.44);border:1px solid rgba(255,255,255,.16);border-right:0;border-radius:7px 0 0 7px;backdrop-filter:blur(4px)}
.view-toolbar button{width:52px;height:30px;border:1px solid rgba(255,255,255,.20);background:rgba(16,20,30,.62);color:#dbe4ee;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer}.view-toolbar button.active{color:#fff;border-color:var(--cyan);box-shadow:inset 0 0 0 1px var(--cyan)}
.stage-status-overlay{position:absolute;left:10px;right:10px;bottom:9px;z-index:38}
.right-panel{background:var(--panel-bg);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;padding:14px;gap:12px}
.joysticks-container{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;padding:10px;background:var(--card-bg);border-radius:8px;border:1px solid var(--border)}
.camera-section,.telemetry-section{padding:0;overflow:visible;flex:0 0 auto}.camera-section-header,.telemetry-section-header{width:100%;height:36px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;border:0;background:var(--ui-bg-card);color:var(--ui-text);font-weight:700;cursor:pointer}.camera-section-body,.telemetry-section-body{display:flex;flex-direction:column;gap:9px;padding:9px;overflow:visible;max-height:none}
.controls-pip-section{display:flex;flex-direction:column;gap:7px;margin-top:2px}.pip-controls-slot{position:relative;width:100%;height:190px;flex:0 0 190px}
@media(max-width:900px){.cockpit-layout{grid-template-columns:1fr 300px}.stage-status-overlay{right:8px;left:8px}}
</style>
