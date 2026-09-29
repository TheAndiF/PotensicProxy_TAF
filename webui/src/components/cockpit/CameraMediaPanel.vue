<template>
  <div class="camera-media-panel ui-card">
    <div class="panel-title">📷 Camera</div>

    <div class="camera-grid">
      <label class="camera-field">
        <span>Video resolution</span>
        <select v-model.number="videoIndex" class="taf-input" @change="applyVideoResolution">
          <option v-for="item in videoOptions" :key="item.index" :value="item.index">{{ item.label }}</option>
        </select>
      </label>

      <label class="camera-field">
        <span>Photo resolution</span>
        <select v-model.number="photoIndex" class="taf-input" @change="applyPhotoResolution">
          <option v-for="item in photoOptions" :key="item.index" :value="item.index">{{ item.label }}</option>
        </select>
      </label>

      <label class="camera-field">
        <span>Video EV</span>
        <select v-model.number="videoEv" class="taf-input" @change="CameraMediaService.setVideoEv(videoEv)">
          <option v-for="ev in evOptions" :key="ev" :value="ev">{{ signed(ev) }}</option>
        </select>
      </label>

      <label class="camera-field">
        <span>Photo EV</span>
        <select v-model.number="photoEv" class="taf-input" @change="CameraMediaService.setPhotoEv(photoEv)">
          <option v-for="ev in evOptions" :key="ev" :value="ev">{{ signed(ev) }}</option>
        </select>
      </label>
    </div>

    <div class="manual-section">
      <div class="ui-subtitle">Manual camera controls</div>
      <div class="camera-grid">
        <label class="camera-field"><span>Exposure mode</span><select v-model="camera.manualMode.manual" class="taf-input"><option :value="false">Auto</option><option :value="true">Manual</option></select></label>
        <label class="camera-field"><span>Shutter</span><select v-model.number="camera.manualMode.shutterDen" class="taf-input"><option v-for="d in shutterOptions" :key="d" :value="d">1/{{ d }}</option></select></label>
        <label class="camera-field"><span>ISO</span><select v-model.number="camera.manualMode.iso" class="taf-input"><option v-for="v in isoOptions" :key="v" :value="v">{{ v }}</option></select></label>
        <label class="camera-field"><span>White balance (K)</span><input v-model.number="camera.manualMode.wb" type="number" min="2000" max="10000" step="100" class="taf-input"></label>
      </div>
      <div class="toggle-row">
        <label><input v-model="camera.manualMode.manualWb" type="checkbox"> Manual WB</label>
        <label><input v-model="camera.manualMode.raw" type="checkbox" @change="CameraMediaService.setRaw(camera.manualMode.raw)"> RAW</label>
        <label><input v-model="camera.manualMode.photoOsd" type="checkbox" @change="CameraMediaService.setPhotoOsd(camera.manualMode.photoOsd)"> Photo OSD</label>
        <label><input v-model="camera.manualMode.photoGps" type="checkbox" @change="CameraMediaService.setPhotoGps(camera.manualMode.photoGps)"> Photo GPS</label>
      </div>
      <button class="taf-btn taf-btn--compact" @click="applyManual">Apply manual exposure / WB</button>
    </div>

    <div class="button-row">
      <button class="taf-btn taf-btn--compact" @click="CameraMediaService.refreshSettings()">↻ Read camera</button>
      <button class="taf-btn taf-btn--compact" @click="CameraMediaService.getSdStatus()">💾 SD status</button>
      <button class="taf-btn taf-btn--compact taf-btn--danger" @click="formatSd">Format SD</button>
    </div>

    <div class="sd-row">
      <span class="taf-status-field">SD: {{ sdStateLabel }}</span>
      <span class="taf-status-field">Free: {{ sizeLabel(camera.sd.freeMb) }}</span>
      <span class="taf-status-field">Total: {{ sizeLabel(camera.sd.totalMb) }}</span>
    </div>

    <div class="protocol-note">PotensicPro USB camera path: FE 0x15 → FF FD → message 0x0020.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CameraMediaService } from '../../services/CameraMediaService'
import { useCameraStore } from '../../stores/useCameraStore'

const camera = useCameraStore()

const videoOptions = [
  { index: 0, label: '4K 30 fps' },
  { index: 1, label: '2.7K 30 fps' },
  { index: 2, label: '2K 30 fps' },
  { index: 3, label: '1080p 60 fps' },
  { index: 4, label: '720p 120 fps' }
]
const photoOptions = [
  { index: 0, label: '16 MP' },
  { index: 1, label: '12 MP' },
  { index: 2, label: '8 MP' }
]
const evOptions = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]
const isoOptions = [100, 200, 400, 800, 1600, 3200, 6400]
const shutterOptions = [25, 30, 50, 60, 100, 120, 200, 250, 500, 1000, 2000, 4000, 8000]

const videoIndex = ref(camera.videoResolutionIndex ?? 0)
const photoIndex = ref(camera.photoResolutionIndex ?? 0)
const videoEv = ref(camera.videoEv ?? 0)
const photoEv = ref(camera.photoEv ?? 0)

watch(() => camera.videoResolutionIndex, v => { if (v != null) videoIndex.value = v })
watch(() => camera.photoResolutionIndex, v => { if (v != null) photoIndex.value = v })
watch(() => camera.videoEv, v => { if (v != null) videoEv.value = v })
watch(() => camera.photoEv, v => { if (v != null) photoEv.value = v })

const sdStateLabel = computed(() => {
  const s = camera.sd.state
  if (s == null) return 'unknown'
  const labels: Record<number, string> = {
    0: 'no card', 1: 'ready', 2: 'unrecognized', 4: 'format required', 5: 'full', 6: 'low speed', 7: 'unrecognized', 8: 'speed unstable'
  }
  return labels[s] ?? `code ${s}`
})

function signed(value: number) { return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1) }
function sizeLabel(value: number | null) { return value == null ? '—' : `${value} MB` }
function applyVideoResolution() { CameraMediaService.setVideoResolution(videoIndex.value) }
function applyPhotoResolution() { CameraMediaService.setPhotoResolution(photoIndex.value) }
function applyManual() {
  const m = camera.manualMode
  CameraMediaService.setManualMode(m.manual, m.shutterDen, m.iso, m.manualWb, m.wb)
}

function formatSd() {
  if (window.confirm('Format the drone camera SD card? All files on the card will be erased.')) {
    CameraMediaService.formatSd()
  }
}

</script>

<style scoped>
.camera-media-panel{padding:10px;display:flex;flex-direction:column;gap:9px}
.camera-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.camera-field{display:flex;flex-direction:column;gap:4px;color:var(--ui-text-muted);font-size:var(--ui-font-xs)}
.taf-input{height:var(--ui-control-h-compact);border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control);color:var(--ui-text);padding:0 7px;font:inherit}
.button-row{display:flex;gap:6px;flex-wrap:wrap}.manual-section{border-top:1px solid var(--ui-border);padding-top:8px;display:flex;flex-direction:column;gap:7px}.toggle-row{display:flex;gap:10px;flex-wrap:wrap;font-size:var(--ui-font-xs);color:var(--ui-text-muted)}
.sd-row{display:flex;gap:6px;flex-wrap:wrap}.sd-row .taf-status-field{flex:1;min-width:88px}
.protocol-note{font-size:var(--ui-font-xs);color:var(--ui-text-muted)}
.protocol-note{opacity:.8}
</style>
