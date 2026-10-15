<template>
  <section class="updates-panel">
    <h3>App-Updates (GitHub · BA_)</h3>
    <p>Installiert: {{ status.version || 'unbekannt' }} (Build {{ status.versionCode || '?' }}) · Kanal: {{ status.channel || 'unbekannt' }}</p>
    <label>Automatische Prüfung und Vorbereitung
      <select v-model="mode" @change="saveMode">
        <option value="off">Aus</option>
        <option value="notify">Neue Version melden</option>
        <option value="download">Automatisch herunterladen</option>
      </select>
    </label>
    <label>Installationsverfahren
      <select v-model="installMethod" @change="saveInstallOptions">
        <option value="android">Android-Installer (ohne Root)</option>
        <option value="magisk">Headless über Magisk</option>
        <option value="auto">Automatisch (Magisk, sonst Android)</option>
      </select>
    </label>
    <label v-if="installMethod !== 'android'">
      <input type="checkbox" v-model="headlessEnabled" @change="saveInstallOptions" />
      Unbeaufsichtigte Root-Installation ausdrücklich erlauben
    </label>
    <label><input type="checkbox" v-model="automaticInstall" @change="saveInstallOptions" /> Installation nach geprüftem Download automatisch anfordern (nur bei ausdrücklicher Freigabe)</label>
    <div class="actions">
      <button type="button" :disabled="working" @click="check">Updates prüfen</button>
      <button type="button" :disabled="working || !candidate" @click="download">Herunterladen</button>
      <button type="button" :disabled="!working && !status.pending" @click="cancel">Abbrechen / Datei entfernen</button>
      <button type="button" :disabled="working || !status.pending || !!status.blocker" @click="install">Installation am Handy anfordern</button>
    </div>
    <p v-if="candidate">Neue Version: {{ candidate.versionName }} (Build {{ candidate.versionCode }})</p>
    <p v-if="candidate?.buildId">Build: {{ candidate.buildId.slice(0, 12) }} · {{ candidate.buildDate || "Datum unbekannt" }}</p>
    <p>Status: {{ status.phase || 'idle' }} · {{ status.progress || 0 }} %</p>
    <progress v-if="working" :value="status.progress || 0" max="100" />
    <p v-if="status.blocker" class="warning">Installation gesperrt: {{ status.blocker }}</p>
    <p v-if="message" class="message">{{ message }}</p>
    <small>Bei Android-Installation ist eine Bestätigung erforderlich. Magisk-Installation nur nach ausdrücklicher Aktivierung und Root-Freigabe. Während bestätigtem Flugbetrieb oder bei unklarem Flugzustand gesperrt. Start und PStart werden während der Installation gesperrt; Landung, PLand, RTH und Not-Aus bleiben unverändert. Mehr als 40 % Handy-Akku erforderlich. Android kann ein installiertes Update nicht jederzeit abbrechen oder garantiert zurücksetzen.</small>
  </section>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
type Candidate = { versionCode:number, versionName:string, apkUrl:string, sha256:string, channel:string, packageName:string, buildId?:string, buildDate?:string }
type State = { version?:string, versionCode?:number, channel?:string, autoMode?:string, installMethod?:string, headlessEnabled?:boolean, automaticInstall?:boolean, phase?:string, progress?:number, pending?:boolean, blocker?:string | null }
const status = ref<State>({})
const candidate = ref<Candidate | null>(null)
const mode = ref('notify')
const installMethod = ref('android')
const headlessEnabled = ref(false)
const automaticInstall = ref(false)
const working = ref(false)
const message = ref('')
let tick: ReturnType<typeof setInterval> | undefined
let autoTick: ReturnType<typeof setInterval> | undefined
async function api(path:string, body?:unknown) {
  const r = await fetch('/api/updates/' + path, { method:body===undefined?'GET':'POST', headers:{ 'Content-Type':'application/json' }, body:body===undefined?undefined:JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}
async function refresh() {
  try { status.value = await api('status'); mode.value = status.value.autoMode || 'notify'; installMethod.value = status.value.installMethod || 'android'; headlessEnabled.value = !!status.value.headlessEnabled; automaticInstall.value = !!status.value.automaticInstall }
  catch(e) { message.value = String(e) }
}
async function check() {
  if (working.value) return
  working.value = true; message.value = 'GitHub-Versionen werden geprüft …'
  try {
    const r = await api('check')
    candidate.value = r.update || null
    message.value = candidate.value ? 'Eine neuere Version ist verfügbar.' : 'Keine neuere Version verfügbar.'
    if (candidate.value && mode.value === 'download') await doDownload()
  } catch(e) { message.value = String(e) }
  finally { working.value = false; await refresh() }
}
async function doDownload() {
  if (!candidate.value) return
  message.value = 'Update wird heruntergeladen und überprüft …'
  await api('download', candidate.value)
  message.value = 'APK geprüft. Installation kann angefordert werden.'
  if (automaticInstall.value) {
    try { await api('install', {}); message.value = 'Automatische Installationsanforderung gestartet.' }
    catch(e) { message.value = 'Automatische Installation nicht gestartet: ' + String(e) }
  }
}
async function download() {
  working.value = true
  try { await doDownload() } catch(e) { message.value = String(e) }
  finally { working.value = false; await refresh() }
}
async function cancel() {
  try { await api('cancel', {}); message.value = 'Update abgebrochen bzw. entfernt.' }
  catch(e) { message.value = String(e) }
  await refresh()
}
async function install() {
  try { await api('install', {}); message.value = installMethod.value === 'android' || !headlessEnabled.value ? 'Android-Installationsbenachrichtigung öffnen und bestätigen.' : 'Installationsweg angefordert. Status am Gerät prüfen.' }
  catch(e) { message.value = String(e) }
  await refresh()
}
async function saveInstallOptions() {
  try { await api('install-settings', { installMethod: installMethod.value, headlessEnabled: headlessEnabled.value, automaticInstall: automaticInstall.value }); message.value = 'Installationsverfahren gespeichert.' }
  catch(e) { message.value = String(e) }
}
async function saveMode() {
  try { await api('settings', { autoMode:mode.value }); message.value = 'Updateeinstellung gespeichert.' }
  catch(e) { message.value = String(e) }
}
onMounted(async () => { await refresh(); if (mode.value !== 'off') await check(); tick = setInterval(async()=>{ if (working.value) await refresh() },1000); autoTick = setInterval(async()=>{ if (!working.value && mode.value !== 'off') await check() }, 6 * 60 * 60 * 1000) })
onUnmounted(()=>{ if(tick) clearInterval(tick); if (autoTick) clearInterval(autoTick) })
</script>
<style scoped>
.updates-panel{margin:12px 0;padding:14px;border:1px solid #64748b66;border-radius:8px}
.updates-panel label{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.updates-panel select,.updates-panel button{padding:7px;border-radius:5px}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.warning{color:#e88b36}.message{font-weight:600}
progress{width:100%}small{display:block;opacity:.75;line-height:1.5}
</style>
