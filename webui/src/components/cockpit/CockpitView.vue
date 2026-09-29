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

        <div class="view-toolbar">
          <button :class="{ active: mainView === 'video' }" @click="mainView = 'video'">LIVE</button>
          <button :class="{ active: mainView === 'map' }" @click="mainView = 'map'">MAP</button>
          <button :class="{ active: pipVisible }" @click="pipVisible = !pipVisible">PIP</button>
        </div>
      </div>
      <TelemetryBar />
    </div>

    <div class="right-panel">
      <div class="panel-title">🕹️ Joystick Control</div>
      <div class="joysticks-container">
        <VirtualJoystick label="Throttle / Yaw" :value-labels="['Throttle', 'Yaw']" v-model="leftStickModel" :rc-echo="{ x: store.rcHardwareJoysticks.yaw, y: store.rcHardwareJoysticks.throttle }" @change="onJoystickChange"/>
        <VirtualJoystick label="Pitch / Roll" :value-labels="['Pitch', 'Roll']" v-model="rightStickModel" :rc-echo="{ x: store.rcHardwareJoysticks.roll, y: store.rcHardwareJoysticks.pitch }" @change="onRightStickChange"/>
      </div>
      <GimbalControl/>
      <FlightActions/>
      <CameraMediaPanel/>

      <div
        v-show="pipVisible && pipPosition === 'controls'"
        class="controls-pip-section"
      >
        <div class="panel-title">{{ secondaryLabel }} preview</div>
        <div
          id="pip-controls-slot"
          class="pip-slot pip-controls-slot"
          title="Swap Liveview and map"
          @click="swapViews"
        ></div>
      </div>
    </div>

    <Teleport v-if="teleportsReady" :to="videoTarget">
      <div :class="['teleported-view', { 'small-view': mainView !== 'video' }]">
        <VideoPlayer/>
        <span v-if="mainView !== 'video'" class="small-view-label">VIDEO</span>
      </div>
    </Teleport>

    <Teleport v-if="teleportsReady" :to="mapTarget">
      <div :class="['teleported-view', { 'small-view': mainView !== 'map' }]">
        <MapView/>
        <span v-if="mainView !== 'map'" class="small-view-label">MAP</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import MapView from './MapView.vue'
import TelemetryBar from './TelemetryBar.vue'
import VirtualJoystick from './VirtualJoystick.vue'
import GimbalControl from './GimbalControl.vue'
import FlightActions from './FlightActions.vue'
import CameraMediaPanel from './CameraMediaPanel.vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings'

const store = useDroneStore()
const { mainView, pipVisible, pipPosition, swapViews } = useCockpitViewSettings()
const teleportsReady = ref(false)

const secondaryTarget = computed(() => pipPosition.value === 'controls' ? '#pip-controls-slot' : '#pip-overlay-slot')
const hiddenTarget = '#hidden-view-slot'
const videoTarget = computed(() => mainView.value === 'video' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget))
const mapTarget = computed(() => mainView.value === 'map' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget))
const secondaryLabel = computed(() => mainView.value === 'video' ? 'Map' : 'Liveview')

onMounted(async () => {
  await nextTick()
  teleportsReady.value = true
})

async function notifyViewResize() {
  await nextTick()
  requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('cockpit-view-resized')))
}
watch([mainView, pipVisible, pipPosition], notifyViewResize, { flush: 'post' })

const leftStickModel = computed({
  get: () => ({ x: store.userJoysticks.yaw, y: store.userJoysticks.throttle }),
  set: v => { store.userJoysticks.yaw = v.x; store.userJoysticks.throttle = v.y },
})
const rightStickModel = computed({
  get: () => ({ x: store.userJoysticks.roll, y: store.userJoysticks.pitch }),
  set: v => { store.userJoysticks.roll = v.x; store.userJoysticks.pitch = v.y },
})

let lastSend = 0
function onJoystickChange() { throttleSend() }
function onRightStickChange(v: { x: number; y: number }) {
  store.userJoysticks.roll = v.x
  store.userJoysticks.pitch = v.y
  throttleSend()
}
function throttleSend() {
  const now = Date.now()
  if (now - lastSend >= 20) {
    lastSend = now
    DroneControlService.sendJoysticks()
  }
}
</script>

<style scoped>
.cockpit-layout{display:grid;grid-template-columns:1fr 340px;height:100%}
.left-section{display:flex;flex-direction:column;height:100%;background:var(--ui-bg-stage);position:relative;overflow:hidden}
.flight-stage{position:relative;flex:1;min-height:0;background:var(--ui-bg-stage)}
.main-stage-slot{position:absolute;inset:0;z-index:1;overflow:hidden}
.hidden-view-slot{position:absolute;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none}
.pip-slot{overflow:hidden;border:2px solid #60708d;border-radius:8px;background:var(--ui-bg-stage);box-shadow:0 4px 18px rgba(0, 0, 0, 0.67);cursor:pointer}
.pip-overlay-slot{position:absolute;right:16px;bottom:16px;width:230px;height:150px;z-index:20}
.teleported-view{position:relative;width:100%;height:100%;overflow:hidden}
.teleported-view>*:first-child{width:100%;height:100%}
.small-view>*:first-child{pointer-events:none}
.small-view-label{position:absolute;left:7px;bottom:6px;z-index:30;background:rgba(13, 16, 26, 0.87);color:var(--ui-text-strong);font-size:10px;font-weight:700;padding:3px 6px;border-radius:3px;pointer-events:none}
.view-toolbar{position:absolute;left:10px;top:10px;z-index:35;display:flex;gap:5px;background:rgba(13, 16, 26, 0.80);border:1px solid var(--ui-border-control);border-radius:6px;padding:4px}
.view-toolbar button{width:46px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--ui-border-strong);background:var(--ui-bg-control);color:#cbd5e1;border-radius:4px;font-size:10px;font-weight:700;padding:0;cursor:pointer}
.view-toolbar button.active{color:var(--ui-text-strong);border-color:var(--cyan);box-shadow:inset 0 0 0 1px var(--cyan)}
.right-panel{background:var(--panel-bg);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;padding:14px;gap:12px}
.joysticks-container{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;padding:10px;background:var(--card-bg);border-radius:8px;border:1px solid var(--border)}
.controls-pip-section{display:flex;flex-direction:column;gap:7px;margin-top:2px}
.pip-controls-slot{position:relative;width:100%;height:190px;flex:0 0 190px}
</style>
