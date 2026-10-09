<script setup lang="ts">
import { computed } from 'vue'

import type { Layer } from '@/shared/shipModel'
import { shipThumbnail } from '@/shared/thumbnails'

const props = defineProps<{ layers: Layer[]; alt: string }>()

const src = computed(() => shipThumbnail(props.layers))
</script>

<template>
  <img class="thumbnail" :src="src" :alt="alt" width="256" height="256" />
</template>

<style scoped>
.thumbnail {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  background: radial-gradient(circle, #1a2336 0%, #0a0e17 70%);
  border-radius: 6px;
}
</style>
