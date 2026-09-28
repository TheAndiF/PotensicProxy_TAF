<template>
  <div class="capture-panel">
    <div class="capture-title">Video Transport Capture</div>
    <div class="capture-info">
      Records USB RAW, parsed FE frames and the complete FE 0x06 payload stream for offline ATOM protocol analysis.
    </div>
    <div class="capture-actions">
      <button v-if="!status.active" class="btn start" @click="startCapture" :disabled="busy">● Start Capture</button>
      <button v-else class="btn stop" @click="stopCapture" :disabled="busy">■ Stop Capture</button>
      <button class="btn" @click="downloadCapture" :disabled="status.active || !status.directory">Download Capture ZIP</button>
      <span :class="['state', status.active ? 'active' : '']">{{ status.active ? 'RECORDING' : 'Idle' }}</span>
    </div>
    <div class="stats" v-if="status.directory">
      {{ status.directory }} · USB {{ fmt(status.rawBytes) }} · FE {{ status.feFrames }} frames · FE06 {{ fmt(status.fe06Bytes) }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
const busy = ref(false)
const status = reactive({active:false,startedAt:0,directory:'',rawBytes:0,feFrames:0,fe06Bytes:0})
let timer:number|undefined
const base=()=>`${location.protocol}//${location.hostname}:9090`
async function refresh(){try{Object.assign(status,await (await fetch(`${base()}/api/capture/status`)).json())}catch{}}
async function startCapture(){busy.value=true;try{await fetch(`${base()}/api/capture/start`,{method:'POST'});await refresh()}finally{busy.value=false}}
async function stopCapture(){busy.value=true;try{await fetch(`${base()}/api/capture/stop`,{method:'POST'});await refresh()}finally{busy.value=false}}
function downloadCapture(){window.open(`${base()}/api/capture/download`,'_blank')}
function fmt(v:number){if(v<1024)return `${v} B`;if(v<1048576)return `${(v/1024).toFixed(1)} KB`;return `${(v/1048576).toFixed(1)} MB`}
onMounted(()=>{refresh();timer=window.setInterval(refresh,1000)})
onUnmounted(()=>{if(timer)clearInterval(timer)})
</script>
<style scoped>
.capture-panel{grid-column:1/-1;padding:14px 16px;border-bottom:1px solid #243047;background:#0e1420;color:#d7e3f4;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.capture-title{font-weight:700;color:#55d8ff;margin-bottom:5px}.capture-info{font-size:12px;color:#91a2ba;margin-bottom:10px}.capture-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{background:#1a2435;color:#d7e3f4;border:1px solid #40506a;border-radius:5px;padding:7px 12px;cursor:pointer}.btn.start{border-color:#00d9ff;color:#00e5ff}.btn.stop{border-color:#ff5964;color:#ff7a83}.btn:disabled{opacity:.5;cursor:not-allowed}.state{font-size:12px;color:#8899b0}.state.active{color:#ff5964;font-weight:700}.stats{font-size:11px;color:#8fa5bf;margin-top:8px}
</style>
