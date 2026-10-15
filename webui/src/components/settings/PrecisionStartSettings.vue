<template>
  <section class="pstart-settings">
    <div class="settings-card">
      <div class="settings-title">🎯 {{ t('pstart.settingsTitle') }}</div>
      <p class="settings-help">{{ t('pstart.settingsHelp') }}</p>

      <div class="settings-grid">
        <label>
          <span>{{ t('pstart.endHeight') }}</span>
          <span class="input-unit"><input v-model.number="endHeight" type="number" min="1" max="120" step="0.5" @change="normalize" /> m</span>
        </label>
        <label>
          <span>{{ t('pstart.heightStep') }}</span>
          <span class="input-unit"><input v-model.number="heightStep" type="number" min="0.5" max="50" step="0.5" @change="normalize" /> m</span>
        </label>
        <label>
          <span>PStart – Zeitlimit je Aufstieg</span>
          <span class="input-unit"><input v-model.number="ascentTimeoutSeconds" type="number" min="10" max="300" step="1" @change="normalize" title="Maximale Zeit pro Zielhöhe in Sekunden (10–300; Standard 45)" /> s</span>
        </label>
        <label>
          <span>{{ t('pstart.stabilization') }}</span>
          <span class="input-unit"><input v-model.number="stabilizationSeconds" type="number" min="0" max="15" step="0.5" @change="normalize" /> s</span>
        </label>
        <label>
          <span>{{ t('pstart.positionWarning') }}</span>
          <span class="input-unit"><input v-model.number="positionWarningMeters" type="number" min="0.5" max="50" step="0.5" @change="normalize" /> m</span>
        </label>
        <label>
          <span>{{ t('pstart.positionAbort') }}</span>
          <span class="input-unit"><input v-model.number="positionAbortMeters" type="number" min="1" max="100" step="0.5" @change="normalize" /> m</span>
        </label>
      </div>

      <div class="rules-box" style="margin-bottom:14px">
        <strong>PStart – Referenzauswertung (experimentell)</strong>
        <p>Automatisch nach abgeschlossenem PStart oder manuell für einen bereits auf diesem Android-Gerät vorhandenen PStart-Sitzungsordner. Beide Startwege verwenden dieselbe Auswertung; keine Flugfreigabe.</p>
        <div class="analysis-action-row">
          <button type="button" :disabled="busy" title="Wertet die neueste auf Android vorhandene PStart-Sitzung erneut aus; keine Übertragung vom Browsergerät." @click="analyzeLast">Letzte PStart-Sitzung auswerten ⓘ</button>
          <button type="button" :disabled="busy || storageState !== 'READY'" title="Wählt einen bereits vorhandenen PStart-Sitzungsordner auf dem Android-Gerät aus. Bilder werden extern kopiert; es erfolgt kein Import." @click="loadSessions">Android-Sitzungsordner auswählen ⓘ</button>
        </div>
        <div v-if="showSessions" class="analysis-session-picker">
          <label for="pstart-session-select">Android: Documents/PotensicProxy/Auto/PStart/</label>
          <select id="pstart-session-select" v-model="selectedSession">
            <option v-for="session in sessionOptions" :key="session" :value="session">{{ session }}</option>
          </select>
          <button type="button" :disabled="busy || !selectedSession" title="Startet für diesen Android-Ordner denselben Auswertungsdienst wie nach dem automatischen PStart." @click="analyzeSelected">Ausgewählten Ordner auswerten</button>
        </div>
        <details class="analysis-tools">
          <summary>Speicher &amp; Diagnose</summary>
          <p aria-live="polite"><b>Android-Speicher PotensicProxy:</b> {{ storageState === 'READY' ? 'Freigegeben ✓' : storageState }}</p>
          <div class="analysis-action-row">
            <button type="button" title="Öffnet die native Ordnerfreigabe auf dem Android-Host. Dies ist keine Browser-Dateiauswahl." @click="requestSaf">SAF-Freigabe anfordern ⓘ</button>
            <button type="button" title="Prüft die dauerhaft gespeicherte Android-Berechtigung." @click="refreshStorage">Freigabe prüfen ⓘ</button>
            <button type="button" title="Exportiert das Diagnoseprotokoll als normalen Browserdownload." @click="PStartPostProcessingService.exportLog()">Diagnoselog exportieren ⓘ</button>
            <button type="button" :disabled="!analysis.profile" title="Exportiert die zuletzt berechnete Referenz als Browserdownload." @click="exportResult">Referenzprofil exportieren ⓘ</button>
          </div>
        </details>
        <p aria-live="polite">{{ analysis.state }} – {{ analysis.completed }}/{{ analysis.total }} – {{ analysis.message }}</p>
        <p v-if="errorText">{{ errorText }}</p>
        <template v-if="analysis.profile">
          <p><b>PLanding:</b> {{ analysis.profile.landingReadiness.status }} – keine automatische Steuerungsfreigabe</p>
          <div v-for="ref in analysis.profile.references" :key="ref.imageId" style="border-top:1px solid #888;padding:5px 0">
            {{ ref.imagePath }} | {{ ref.targetHeightM ?? '?' }} m | {{ ref.zoomRole }} | {{ ref.status }}
            | Zentrum: {{ ref.centerPx ? ref.centerPx.join(', ') + ' px' : 'unbekannt' }}
            <small v-if="ref.warnings.length"> – {{ ref.warnings.join('; ') }}</small>
          </div>
        </template>
      </div>
      <div class="rules-box">
        <strong>{{ t('pstart.v1Rules') }}</strong>
        <ul>
          <li>{{ t('pstart.ruleNoLateral') }}</li>
          <li>{{ t('pstart.ruleFirstPoint') }}</li>
          <li>{{ t('pstart.rulePositionTolerance') }}</li>
          <li>{{ t('pstart.ruleGrid') }}</li>
          <li>{{ t('pstart.ruleImages') }}</li>
          <li>{{ t('pstart.ruleProtocol') }}</li>
          <li>{{ t('pstart.ruleStep0') }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '../../i18n'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PStartPostProcessingService, type PStartProgress } from '../../services/PStartPostProcessingService'
import { usePrecisionStartSettings } from '../../composables/usePrecisionStartSettings'

const { t } = useI18n()
const { ascentTimeoutSeconds, endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters } = usePrecisionStartSettings()

const analysis = ref<PStartProgress>(PStartPostProcessingService.progress)
const errorText = ref('')
const storageState = ref('LOADING')
const busy = computed(() => !['WAITING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED'].includes(analysis.value.state))
let unsubscribe: (() => void) | null = null
onMounted(() => {
  void refreshStorage()
  try { const saved = localStorage.getItem('taf.pstart.analysis.latest'); if (saved && !analysis.value.profile) analysis.value = { state: 'COMPLETED_WITH_WARNINGS', completed: 0, total: 0, message: 'Letztes lokal gespeichertes Ergebnis', profile: JSON.parse(saved) } } catch { /* optional storage */ }
  unsubscribe = PStartPostProcessingService.subscribe(v => { if (v.profile || v.state !== 'WAITING') analysis.value = v })
})
onUnmounted(() => { unsubscribe?.() })
const showSessions = ref(false)
const sessionOptions = ref<string[]>([])
const selectedSession = ref('')
async function loadSessions() {
  errorText.value = ''
  try {
    sessionOptions.value = await PStartPostProcessingService.listAndroidSessions()
    selectedSession.value = sessionOptions.value[0] || ''
    showSessions.value = true
    if (!selectedSession.value) errorText.value = 'Keine PStart-Sitzungsordner auf Android gefunden.'
  } catch (e) { errorText.value = String(e) }
}
async function analyzeSelected() {
  errorText.value = ''
  try { await PStartPostProcessingService.analyzeAndroidSession(selectedSession.value) }
  catch (e) { errorText.value = String(e) }
}
async function analyzeLast() {
  errorText.value = ''
  try {
    const sessions = await PStartPostProcessingService.listAndroidSessions()
    if (!sessions.length) throw new Error('Keine PStart-Sitzung auf Android vorhanden')
    await PStartPostProcessingService.analyzeAndroidSession(sessions[0])
  } catch (e) { errorText.value = String(e) }
}
async function refreshStorage() {
  try {
    const response = await fetch('/api/pstart/saf/status', { cache: 'no-store' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const status = await response.json() as { state: string }
    storageState.value = status.state
  } catch (e) { storageState.value = 'ERROR'; errorText.value = String(e) }
}
async function requestSaf() {
  errorText.value = ''
  try {
    await PStartPostProcessingService.requestAndroidFolder()
    storageState.value = 'PICKER_REQUESTED'
    // The native Android picker is asynchronous. The user can also press "Freigabe prüfen".
    window.setTimeout(() => { void refreshStorage() }, 3500)
  } catch (e) { errorText.value = String(e) }
}
function exportResult() { if (analysis.value.profile) PStartPostProcessingService.exportProfile(analysis.value.profile) }

function normalize() {
  ascentTimeoutSeconds.value = Math.max(10, Math.min(300, Math.round(Number(ascentTimeoutSeconds.value) || 45)))
  endHeight.value = Math.max(1, Math.min(120, Number(endHeight.value) || 20))
  heightStep.value = Math.max(0.5, Math.min(50, Number(heightStep.value) || 5))
  stabilizationSeconds.value = Math.max(0, Math.min(15, Number(stabilizationSeconds.value) || 2))
  positionWarningMeters.value = Math.max(0.5, Math.min(50, Number(positionWarningMeters.value) || 3))
  positionAbortMeters.value = Math.max(positionWarningMeters.value + 0.5, Math.min(100, Number(positionAbortMeters.value) || 6))
}
</script>

<style scoped>
.pstart-settings{padding:14px;overflow:auto;height:100%;box-sizing:border-box}.settings-card{max-width:760px;border:1px solid var(--ui-border);background:var(--ui-bg-card);border-radius:var(--ui-radius-lg);padding:16px}.settings-title{font-size:15px;font-weight:800;color:var(--ui-text);margin-bottom:5px}.settings-help{margin:0 0 16px;color:var(--ui-text-muted);font-size:12px;line-height:1.45}.settings-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:12px}.settings-grid label{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);font-size:12px;font-weight:700}.input-unit{display:flex;align-items:center;gap:5px;color:var(--ui-text-muted)}.input-unit input{width:90px;height:30px;box-sizing:border-box;border:1px solid var(--ui-border-control);border-radius:var(--ui-radius-md);background:var(--ui-bg-control);color:var(--ui-text);padding:0 7px}.rules-box{margin-top:14px;padding:12px;border:1px solid var(--ui-border);border-radius:var(--ui-radius-md);font-size:12px;line-height:1.45;color:var(--ui-text-muted)}.rules-box strong{color:var(--ui-text)}.rules-box ul{margin:7px 0 0;padding-left:18px}.rules-box li+li{margin-top:4px}@media(max-width:720px){.settings-grid{grid-template-columns:1fr}}
</style>

<style scoped>
.analysis-action-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.analysis-session-picker{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px;border:1px solid var(--ui-border);border-radius:6px}.analysis-session-picker select{max-width:100%;min-width:215px;background:var(--ui-bg-control);color:var(--ui-text);padding:5px}.analysis-tools{margin-top:12px}.analysis-tools summary{cursor:pointer;font-weight:600}
</style>
