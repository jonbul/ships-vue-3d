<script setup lang="ts">
import { useRoute } from 'vue-router'

import AlertHost from './components/AlertHost.vue'
import NavBar from './components/NavBar.vue'

const route = useRoute()
</script>

<template>
  <NavBar v-if="!route.meta.fullscreen" />
  <main :class="{ fullscreen: route.meta.fullscreen }">
    <RouterView />
  </main>
  <AlertHost />
</template>

<style scoped>
main {
  flex: 1;
  min-height: 0;
}
main.fullscreen {
  height: 100dvh;
}
</style>
