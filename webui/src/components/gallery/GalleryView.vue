<template>
  <div class="gallery-page">
    <div class="gallery-header">
      <div>
        <h2>🖼️ Gallery</h2>
        <p>Photos and videos stored on the drone camera.</p>
      </div>
      <div class="gallery-actions">
        <button v-if="!camera.galleryEntered" class="taf-btn" @click="CameraMediaService.enterGallery()">Open gallery</button>
        <button v-else class="taf-btn" @click="CameraMediaService.refreshGallery()">↻ Refresh</button>
        <button v-if="camera.galleryEntered" class="taf-btn" @click="CameraMediaService.quitGallery()">Close</button>
      </div>
    </div>

    <div class="gallery-toolbar ui-card">
      <div class="filter-group">
        <button :class="['filter-btn', { active: filter === 'all' }]" @click="filter = 'all'">All <span>{{ camera.media.length }}</span></button>
        <button :class="['filter-btn', { active: filter === 'photo' }]" @click="filter = 'photo'">Photos <span>{{ camera.photos.length }}</span></button>
        <button :class="['filter-btn', { active: filter === 'video' }]" @click="filter = 'video'">Videos <span>{{ camera.videos.length }}</span></button>
      </div>
      <div class="gallery-status">
        <span class="taf-status-field">{{ camera.galleryEntered ? 'Camera gallery open' : 'Camera gallery closed' }}</span>
        <span v-if="camera.download.active" class="taf-status-field">Downloading {{ camera.download.fileName }} · {{ camera.download.progress }}%</span>
      </div>
    </div>

    <div class="gallery-content ui-card">
      <div v-if="camera.galleryLoading" class="gallery-empty">Reading media list…</div>
      <div v-else-if="filteredMedia.length === 0" class="gallery-empty">
        {{ camera.galleryEntered ? 'No camera media loaded.' : 'Open the camera gallery to load photos and videos.' }}
      </div>
      <div v-else class="media-grid">
        <article v-for="file in filteredMedia" :key="file.type + ':' + file.name" class="media-card">
          <div class="media-preview" :class="file.type">
            <span>{{ file.type === 'photo' ? '🖼️' : '🎞️' }}</span>
            <small>{{ file.type === 'photo' ? 'PHOTO' : 'VIDEO' }}</small>
          </div>
          <div class="media-meta">
            <div class="media-name" :title="file.name">{{ file.name }}</div>
            <div class="media-type">{{ file.type === 'photo' ? 'Photo' : 'Video' }}</div>
          </div>
          <div class="media-actions">
            <button class="taf-btn taf-btn--compact" :disabled="camera.download.active" @click="download(file.name)">↓ Download</button>
            <button class="taf-btn taf-btn--compact taf-btn--danger" :disabled="camera.download.active" @click="deleteFile(file.name)">Delete</button>
          </div>
        </article>
      </div>
    </div>

    <div v-if="camera.download.error" class="download-error ui-card">
      <strong>Download failed:</strong> {{ camera.download.error }}
    </div>

    <div class="protocol-note">PotensicPro USB camera path: FE 0x15 → FF FD → message 0x0020.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CameraMediaService } from '../../services/CameraMediaService'
import { useCameraStore, type CameraMediaFile } from '../../stores/useCameraStore'
import { useDroneStore } from '../../stores/useDroneStore'

const camera = useCameraStore()
const drone = useDroneStore()
const filter = ref<'all' | 'photo' | 'video'>('all')

const filteredMedia = computed<CameraMediaFile[]>(() => {
  if (filter.value === 'photo') return camera.photos
  if (filter.value === 'video') return camera.videos
  return camera.media
})

async function download(fileName: string) {
  try {
    await CameraMediaService.downloadFile(fileName)
  } catch (e: any) {
    drone.addLog('ERROR', `Camera download failed: ${e?.message || e}`)
  }
}

function deleteFile(fileName: string) {
  if (window.confirm(`Delete camera file "${fileName}"?`)) CameraMediaService.deleteFile(fileName)
}
</script>

<style scoped>
.gallery-page{height:100%;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:14px;background:var(--ui-bg-stage)}
.gallery-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.gallery-header h2{margin:0;color:var(--cyan)}.gallery-header p{margin:4px 0 0;color:var(--ui-text-muted);font-size:12px}.gallery-actions{display:flex;gap:7px;flex-wrap:wrap}
.gallery-toolbar{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.filter-group{display:flex;gap:6px}.filter-btn{height:30px;border:1px solid var(--ui-border-control);border-radius:5px;background:var(--ui-bg-control);color:var(--ui-text);padding:0 10px;cursor:pointer}.filter-btn.active{border-color:var(--cyan);color:var(--cyan)}.filter-btn span{opacity:.7;margin-left:4px}.gallery-status{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.gallery-content{padding:12px;min-height:260px}.gallery-empty{height:240px;display:grid;place-items:center;color:var(--ui-text-muted);font-size:13px}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.media-card{border:1px solid var(--ui-border-control);border-radius:8px;background:var(--ui-bg-control-strong);overflow:hidden}.media-preview{height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:var(--ui-bg-stage);font-size:36px}.media-preview small{font-size:10px;letter-spacing:1px;color:var(--ui-text-muted)}.media-meta{padding:10px}.media-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px var(--ui-font-mono);color:var(--ui-text)}.media-type{margin-top:4px;font-size:10px;color:var(--ui-text-muted)}.media-actions{display:flex;gap:6px;padding:0 10px 10px}.media-actions .taf-btn{flex:1}.download-error{padding:10px;color:var(--ui-danger)}.protocol-note{font-size:10px;color:var(--ui-text-muted);opacity:.8}
@media (max-width:760px){.gallery-header,.gallery-toolbar{align-items:flex-start;flex-direction:column}.gallery-status{justify-content:flex-start}}
</style>
