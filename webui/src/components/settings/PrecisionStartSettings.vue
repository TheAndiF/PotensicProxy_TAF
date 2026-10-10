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
import { usePrecisionStartSettings } from '../../composables/usePrecisionStartSettings'

const { t } = useI18n()
const { endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters } = usePrecisionStartSettings()

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
