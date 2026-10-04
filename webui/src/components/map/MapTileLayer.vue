<template>
  <div class="tiles" aria-hidden="true">
    <img
      v-for="tile in tiles"
      :key="tile.key"
      class="tile"
      :src="tile.url"
      :style="{ left: tile.left + 'px', top: tile.top + 'px' }"
      draggable="false"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MapService } from '../../services/MapService'
import { worldPoint } from '../../utils/mapProjection'

const props = defineProps<{
  centerLatitude: number
  centerLongitude: number
  zoom: number
  width: number
  height: number
  revision?: number
}>()

const emit = defineEmits<{ (e: 'tile-error'): void; (e: 'tile-load'): void }>()

const tiles = computed(() => {
  const center = worldPoint(props.centerLongitude, props.centerLatitude, props.zoom)
  const n = 1 << props.zoom
  const x0 = Math.floor((center.x - props.width / 2) / 256) - 1
  const x1 = Math.floor((center.x + props.width / 2) / 256) + 1
  const y0 = Math.floor((center.y - props.height / 2) / 256) - 1
  const y1 = Math.floor((center.y + props.height / 2) / 256) + 1
  const out: Array<{ key: string; url: string; left: number; top: number }> = []
  for (let tileX = x0; tileX <= x1; tileX++) {
    for (let tileY = y0; tileY <= y1; tileY++) {
      if (tileY < 0 || tileY >= n) continue
      const x = ((tileX % n) + n) % n
      out.push({
        key: `${props.zoom}/${x}/${tileY}/${props.revision || 0}`,
        url: MapService.tileUrl(props.zoom, x, tileY, props.revision),
        left: tileX * 256 - center.x + props.width / 2,
        top: tileY * 256 - center.y + props.height / 2
      })
    }
  }
  return out
})

function onError() { emit('tile-error') }
function onLoad() { emit('tile-load') }
</script>

<style scoped>
.tiles{position:absolute;inset:0}.tile{position:absolute;width:256px;height:256px}
</style>
