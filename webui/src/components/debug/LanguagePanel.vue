<template>
  <section class="language-panel">
    <div class="language-copy">
      <div class="language-title">{{ t('language.title') }}</div>
      <div class="language-subtitle">{{ t('language.subtitle') }}</div>
    </div>
    <el-select v-model="locale" size="small" class="language-select" @change="onChange">
      <el-option value="system" :label="t('language.system')" />
      <el-option value="de" :label="t('language.german')" />
      <el-option value="en" :label="t('language.english')" />
      <el-option value="zh" :label="t('language.chinese')" />
    </el-select>
  </section>
</template>
<script setup lang="ts">
import type { UiLocale } from '../../i18n'
import { useI18n } from '../../i18n'
const { t, locale, setLocale } = useI18n()
function onChange(value: UiLocale) { setLocale(value) }
</script>
<style scoped>
.language-panel{display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--card-bg)}
.language-copy{min-width:260px;flex:1}.language-title{font-weight:700;color:var(--cyan);font-size:12px;text-transform:uppercase;letter-spacing:.5px}.language-subtitle{font-size:10px;color:var(--text-muted);margin-top:3px}.language-select{width:180px}
</style>
