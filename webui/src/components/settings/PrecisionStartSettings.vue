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
        <p>Automatisch nach PStart oder offline über einen JPEG-Ordner. Schreibzugriff speichert JSON, JSONL-Logs und JPEG-Kopien mit Analyse-XMP direkt im Rohdatenordner. Die einfache Ordnerauswahl ist nur lesend. Die native Android-SAF-Ordnerfreigabe erfolgt auf dem Handy; danach kann der Ordner direkt ausgewertet und beschrieben werden. Keine Flugfreigabe.</p>
        <input type="file" accept="image/jpeg" multiple webkitdirectory directory @change="folderChosen" aria-label="Offline-Ordner auswählen" />
        <button type="button" :disabled="busy" @click="requestSaf">Android-Ordner freigeben (SAF)</button>
        <button type="button" :disabled="busy" @click="analyzeSaf">Android-Ordner auswerten und speichern</button>
        <button type="button" :disabled="busy" @click="analyzeWritable">Ordner mit Schreibzugriff auswerten</button>
        <button type="button" :disabled="busy" @click="analyzeLast">Letzte gespeicherte Sitzung auswerten</button>
        <button type="button" @click="PStartPostProcessingService.exportLog()">Diagnoselog exportieren</button>
        <button type="button" :disabled="!analysis.profile" @click="exportResult">Referenzprofil als JSON exportieren</button>
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
import { AndroidMediaService } from '../../services/AndroidMediaService'
import { usePrecisionStartSettings } from '../../composables/usePrecisionStartSettings'

const { t } = useI18n()
const { endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters } = usePrecisionStartSettings()

const analysis = ref<PStartProgress>(PStartPostProcessingService.progress)
const errorText = ref('')
const busy = computed(() => !['WAITING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED'].includes(analysis.value.state))
let unsubscribe: (() => void) | null = null
onMounted(() => {
  try { const saved = localStorage.getItem('taf.pstart.analysis.latest'); if (saved && !analysis.value.profile) analysis.value = { state: 'COMPLETED_WITH_WARNINGS', completed: 0, total: 0, message: 'Letztes lokal gespeichertes Ergebnis', profile: JSON.parse(saved) } } catch { /* optional storage */ }
  unsubscribe = PStartPostProcessingService.subscribe(v => { if (v.profile || v.state !== 'WAITING') analysis.value = v })
})
onUnmounted(() => { unsubscribe?.() })
async function folderChosen(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  errorText.value = ''
  try { await PStartPostProcessingService.analyzeFolder(files) } catch (e) { errorText.value = String(e) }
}
async function analyzeLast() {
  errorText.value = ''
  try {
    const images = await AndroidMediaService.listImages('recognition')
    const latest = images.filter(i => /^PStart_.+?_(STEP0|REF_\d+)_.*\.jpe?g$/i.test(i.name)).sort((a,b) => b.createdAt - a.createdAt)[0]
    const match = latest?.name.match(/^PStart_(.+?)_(?:STEP0|REF_\d+)_/i)
    if (!match) throw new Error('Keine PStart-Aufnahmen gefunden')
    await PStartPostProcessingService.analyzeSavedSession(match[1])
  } catch (e) { errorText.value = String(e) }
}
async function requestSaf() { errorText.value = ""; try { await PStartPostProcessingService.requestAndroidFolder() } catch (e) { errorText.value = String(e) } }
async function analyzeSaf() { errorText.value = ""; try { await PStartPostProcessingService.analyzeAndroidFolder() } catch (e) { errorText.value = String(e) } }
async function analyzeWritable() { errorText.value = ''; try { await PStartPostProcessingService.analyzeWritableFolder() } catch (e) { errorText.value = String(e) } }
function exportResult() { if (analysis.value.profile) PStartPostProcessingService.exportProfile(analysis.value.profile) }

function normalize() {
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
