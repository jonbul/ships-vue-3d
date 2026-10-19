<script setup lang="ts">
import { t } from '@/i18n'
import { session } from '@/session'
</script>

<template>
  <div class="page home">
    <h1>Ships <span>3D</span></h1>
    <p class="lead">{{ t.home.lead }}</p>
    <div class="actions">
      <RouterLink class="button primary" to="/game">{{ t.home.play }}</RouterLink>
      <RouterLink v-if="session.user" class="button" to="/projects">{{
        t.home.myShips
      }}</RouterLink>
      <RouterLink v-else class="button" to="/register">{{ t.home.createAccount }}</RouterLink>
    </div>
    <p v-if="!session.user && session.loaded" class="hint">{{ t.home.guestHint }}</p>

    <section class="controls">
      <h2>{{ t.home.controls }}</h2>
      <dl>
        <dt>{{ t.home.mouse }}</dt>
        <dd>{{ t.home.mouseText }}</dd>
        <dt>↑ ↓ ← →</dt>
        <dd>{{ t.home.pitchTurn }}</dd>
        <dt>A / D</dt>
        <dd>{{ t.home.roll }}</dd>
        <dt>W / S</dt>
        <dd>{{ t.home.throttle }}</dd>
        <dt>{{ t.home.space }}</dt>
        <dd>{{ t.home.fire }}</dd>
        <dt>Tab</dt>
        <dd>{{ t.home.scoreboard }}</dd>
        <dt>+ / -</dt>
        <dd>{{ t.home.radarRange }}</dd>
        <dt>{{ t.home.phone }}</dt>
        <dd>{{ t.home.phoneText }}</dd>
      </dl>
    </section>
  </div>
</template>

<style scoped>
h1 {
  font-size: 2.6rem;
  margin-bottom: 0.3rem;
}
h1 span {
  color: var(--accent);
}
.lead {
  font-size: 1.15rem;
  color: var(--muted);
}
.actions {
  display: flex;
  gap: 0.8rem;
  margin: 1.5rem 0 0.8rem;
}
.hint {
  color: var(--muted);
}
.controls {
  margin-top: 2.5rem;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.2rem;
}
dt {
  font-weight: 600;
}
dd {
  margin: 0;
  color: var(--muted);
}
</style>
