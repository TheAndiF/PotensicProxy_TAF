<template>
  <section class="profile-panel">
    <div class="profile-copy">
      <div class="profile-title">Drone Protocol</div>
      <div class="profile-subtitle">
        Central model selection. All confirmed ATOM / ATOM 2 protocol differences are switched together.
      </div>
    </div>
    <el-radio-group v-model="selected" size="small" :disabled="busy" @change="onChange">
      <el-radio-button value="ATOM">ATOM</el-radio-button>
      <el-radio-button value="ATOM_2">ATOM 2</el-radio-button>
    </el-radio-group>
    <div class="profile-state">
      <el-tag size="small" effect="dark" type="info">{{ transport }}</el-tag>
      <el-tag size="small" effect="dark" :type="codec === 'h264' ? 'success' : 'warning'">{{ codec.toUpperCase() }}</el-tag>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { DroneControlService } from '../../services/DroneControlService'
import { VideoExtractor } from '../../protocol/VideoExtractor'

const selected = ref<'ATOM' | 'ATOM_2'>('ATOM')
const transport = ref('loading')
const codec = ref('auto')
const busy = ref(false)

async function load() {
  try {
    const p = await DroneControlService.getDroneProfile()
    selected.value = p.id === 'ATOM_2' ? 'ATOM_2' : 'ATOM'
    transport.value = p.videoTransport || 'unknown'
    codec.value = p.codec || 'auto'
    VideoExtractor.getInstance().setDroneModel(selected.value)
  } catch (_) {
    transport.value = 'unavailable'
  }
}

async function onChange(value: string | number | boolean | undefined) {
  const model: 'ATOM' | 'ATOM_2' = value === 'ATOM_2' ? 'ATOM_2' : 'ATOM'
  busy.value = true
  try {
    const p = await DroneControlService.setDroneProfile(model)
    selected.value = model
    transport.value = p.videoTransport || 'unknown'
    codec.value = p.codec || 'auto'
    VideoExtractor.getInstance().setDroneModel(model)
    window.dispatchEvent(new CustomEvent('drone-profile-changed', { detail: p }))
    ElMessage.success(`Drone protocol switched to ${model.replace('_', ' ')}`)
  } catch (e: any) {
    ElMessage.error(`Protocol switch failed: ${e?.message || e}`)
    await load()
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.profile-panel{display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--card-bg)}
.profile-copy{min-width:260px;flex:1}.profile-title{font-weight:700;color:var(--cyan);font-size:12px;text-transform:uppercase;letter-spacing:.5px}.profile-subtitle{font-size:10px;color:var(--text-muted);margin-top:3px}.profile-state{display:flex;gap:6px;min-width:180px;justify-content:flex-end}
</style>
