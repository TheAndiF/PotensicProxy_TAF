<template>
  <el-popover placement="top" :width="width" trigger="click" :content="content">
    <template #reference>
      <button type="button" class="info-button" :aria-label="ariaLabel || 'Info'">i</button>
    </template>
  </el-popover>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ content: string; ariaLabel?: string; width?: number }>(), { width: 320 })
</script>

<style scoped>
.info-button{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;border:1px solid var(--ui-border-strong);background:var(--ui-bg-control);color:var(--cyan);font-size:12px;font-weight:800;cursor:pointer;padding:0}.info-button:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
</style>
