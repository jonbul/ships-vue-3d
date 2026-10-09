<script setup lang="ts">
import { session } from '@/session'
</script>

<template>
  <div class="page home">
    <h1>Ships <span>3D</span></h1>
    <p class="lead">
      Design your own spaceship from 3D parts, then fly it against other players in open space.
    </p>
    <div class="actions">
      <RouterLink class="button primary" to="/game">Play</RouterLink>
      <RouterLink v-if="session.user" class="button" to="/projects">My ships</RouterLink>
      <RouterLink v-else class="button" to="/register">Create an account</RouterLink>
    </div>
    <p v-if="!session.user && session.loaded" class="hint">
      Guests can play with the built-in ships. Log in to design and fly your own.
    </p>

    <section class="controls">
      <h2>Controls</h2>
      <dl>
        <dt>Mouse</dt>
        <dd>Click the game to capture the mouse, then move it to steer. Left button fires.</dd>
        <dt>↑ ↓ ← →</dt>
        <dd>Pitch and turn</dd>
        <dt>A / D</dt>
        <dd>Roll</dd>
        <dt>W / S</dt>
        <dd>Throttle up / down</dd>
        <dt>Space</dt>
        <dd>Fire</dd>
        <dt>Tab</dt>
        <dd>Scoreboard</dd>
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
