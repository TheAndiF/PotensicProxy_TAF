<template>
  <div class="advanced-panel ui-card">
    <div class="panel-title">⚙️ Flight / Calibration / Smart Modes</div>

    <div class="status-grid">
      <span class="taf-status-field">Flight: {{ flightState }}</span>
      <span class="taf-status-field">GPS: {{ t.receiveGps ? 'OK' : '—' }}</span>
      <span class="taf-status-field">RC: {{ t.remoterConnected ? 'linked' : '—' }}</span>
      <span class="taf-status-field" :class="{ warning: t.flightInNoFlyZone || t.locatedNoFlyZone }">No-fly: {{ t.flightInNoFlyZone || t.locatedNoFlyZone ? 'INSIDE' : t.nearNoFlyZone ? 'near' : 'clear' }}</span>
    </div>

    <div class="section">
      <div class="ui-subtitle">Flight limits & RTH</div>
      <div class="form-grid">
        <label><span>Max height (m)</span><input v-model.number="limits.height" type="number" min="0" class="taf-input"></label>
        <label><span>Max distance (m)</span><input v-model.number="limits.distance" type="number" min="0" class="taf-input"></label>
        <label><span>RTH height (m)</span><input v-model.number="limits.rth" type="number" min="0" class="taf-input"></label>
        <label><span>Speed mode</span><select v-model.number="limits.speedMode" class="taf-input"><option :value="0">Video</option><option :value="1">Normal</option><option :value="2">Sport</option></select></label>
      </div>
      <div class="toggle-row">
        <label><input v-model="limits.beginner" type="checkbox"> Beginner mode</label>
        <label><input v-model="limits.american" type="checkbox"> American stick mode</label>
      </div>
      <button class="taf-btn taf-btn--compact" :disabled="!t.settingsValid" @click="applyLimits">Apply confirmed 0x0003 settings</button>
      <div v-if="!t.settingsValid" class="note">Waiting for flight-setting telemetry (0x0003) before editing.</div>
    </div>

    <div class="section">
      <div class="ui-subtitle">Intelligent flight modes</div>
      <div class="button-row">
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setFollowMode()">Follow</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setCircleMode()">Circle</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setPointFlyMode()">Point Fly</button>
        <button class="taf-btn taf-btn--compact taf-btn--danger" @click="DroneControlService.cancelAutoFly()">Cancel auto</button>
      </div>
      <textarea v-model="waypoints" class="taf-textarea" rows="3" placeholder="Waypoint per line: latitude,longitude"></textarea>
      <div class="button-row">
        <button class="taf-btn taf-btn--compact" @click="uploadWaypoints">Upload route</button>
        <span class="note">{{ waypointStatus }}</span>
      </div>
    </div>

    <div class="section">
      <div class="ui-subtitle">Calibration</div>
      <div class="button-row">
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setImuCalibrationOfficial(true)">IMU start</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setImuCalibrationOfficial(false)">IMU stop</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setRemoteCalibration(true)">RC start</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setRemoteCalibration(false)">RC stop</button>
      </div>
      <div class="button-row">
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setCompassCalibrationSession(true)">Compass enter</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setCompassCalibrationSession(false)">Compass exit</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.requestGimbalSettings()">Read gimbal</button>
        <button class="taf-btn taf-btn--compact" :disabled="!t.gimbalSettingsValid" @click="DroneControlService.calibrateGimbal()">Gimbal calibrate</button>
      </div>
      <div class="note">Compass session entry/exit is protocol-confirmed. PotensicPro computes the magnetometer calibration result in native JNI code; TAF does not invent that native solver.</div>
    </div>

    <div class="section">
      <div class="ui-subtitle">Find My Drone / geofence status</div>
      <div class="position-row">Drone: {{ coord(t.latitude, t.longitude) }}</div>
      <div class="position-row">Home: {{ t.homeSynced ? coord(t.homeLatitude || 0, t.homeLongitude || 0) : 'not synced' }}</div>
      <div class="position-row">Zone: height limit {{ t.noFlyHeightLimit || 0 }}, distance {{ t.noFlyDistance || 0 }}</div>
      <div class="button-row">
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setFindDroneBeep(true)">🔊 Beep on</button>
        <button class="taf-btn taf-btn--compact" @click="DroneControlService.setFindDroneBeep(false)">🔇 Beep off</button>
      </div>
      <div class="note">Aircraft no-fly-state is decoded from Potensic 0x0002. PotensicPro's map-zone geometry comes from separate app/server data; no unverified zone-download protocol is added.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDroneStore } from '../../stores/useDroneStore'
import { DroneControlService } from '../../services/DroneControlService'

const store = useDroneStore()
const t = store.telemetry
const limits = reactive({ height:0, distance:0, rth:0, beginner:false, american:true, speedMode:1 })
const waypoints = ref('')
const waypointStatus = ref('')

watch(() => [t.settingsValid,t.limitHeight,t.limitDistance,t.returnHeight,t.beginnerMode,t.americaRockerMode,t.settingSpeedMode] as const, () => {
  if (!t.settingsValid) return
  limits.height = t.limitHeight || 0
  limits.distance = t.limitDistance || 0
  limits.rth = t.returnHeight || 0
  limits.beginner = !!t.beginnerMode
  limits.american = t.americaRockerMode !== false
  limits.speedMode = t.settingSpeedMode == null || t.settingSpeedMode < 0 ? 1 : t.settingSpeedMode
}, { immediate:true })

const flightState = computed(() => t.returning ? 'RTH' : t.landing ? 'landing' : t.takingOff ? 'takeoff' : t.flying ? 'flying' : t.unlocked ? 'armed' : 'ground')
function coord(lat:number, lng:number) { return lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '—' }
function applyLimits() {
  DroneControlService.applyFlightSettings({
    limitHeight: limits.height, limitDistance: limits.distance, returnHeight: limits.rth,
    beginnerMode: limits.beginner, americaRockerMode: limits.american,
    surroundRadius: t.surroundRadius || 0, clockwise: t.surroundClockwise !== false,
    surroundSpeed: t.surroundSpeed || 0, speedMode: limits.speedMode
  })
}
function uploadWaypoints() {
  try {
    const points = waypoints.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean).map(line => {
      const [a,b] = line.split(',').map(Number)
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) throw new Error(`Invalid waypoint: ${line}`)
      return { lat:a, lng:b }
    })
    if (!points.length) throw new Error('No waypoints entered')
    DroneControlService.uploadMultiPoint(points)
    waypointStatus.value = `${points.length} waypoint(s) sent`
  } catch (e:any) { waypointStatus.value = e?.message || String(e) }
}
</script>

<style scoped>
.advanced-panel{padding:10px;display:flex;flex-direction:column;gap:10px}.section{border-top:1px solid var(--ui-border);padding-top:8px;display:flex;flex-direction:column;gap:7px}.status-grid,.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.form-grid label{display:flex;flex-direction:column;gap:3px;font-size:var(--ui-font-xs);color:var(--ui-text-muted)}.taf-input{height:var(--ui-control-h-compact);border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control);color:var(--ui-text);padding:0 7px}.taf-textarea{width:100%;box-sizing:border-box;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control);color:var(--ui-text);padding:6px;font:var(--ui-font-xs) var(--ui-font-mono);resize:vertical}.button-row,.toggle-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.toggle-row{font-size:var(--ui-font-xs);color:var(--ui-text-muted)}.note,.position-row{font-size:var(--ui-font-xs);color:var(--ui-text-muted)}.warning{color:var(--ui-danger);font-weight:700}
</style>
