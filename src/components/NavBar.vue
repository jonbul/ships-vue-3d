<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { logout } from '@/api/auth'
import { showError } from '@/alerts'
import { session, setUser } from '@/session'

const router = useRouter()
const menuOpen = ref(false)

async function onLogout() {
  try {
    await logout()
  } catch (error) {
    showError(error)
  }
  setUser(null)
  menuOpen.value = false
  await router.push('/')
}
</script>

<template>
  <nav class="navbar">
    <RouterLink class="brand" to="/">Ships <span>3D</span></RouterLink>
    <button
      class="menu-toggle"
      type="button"
      :aria-expanded="menuOpen"
      aria-label="Toggle navigation"
      @click="menuOpen = !menuOpen"
    >
      &#9776;
    </button>
    <div class="links" :class="{ open: menuOpen }" @click="menuOpen = false">
      <RouterLink to="/game">Play</RouterLink>
      <RouterLink v-if="session.user" to="/projects">My ships</RouterLink>
      <span class="spacer" />
      <template v-if="session.user">
        <RouterLink to="/profile">👤 {{ session.user.username }}</RouterLink>
        <a href="#" @click.prevent="onLogout">Logout</a>
      </template>
      <template v-else-if="session.loaded">
        <RouterLink to="/login">Login</RouterLink>
        <RouterLink to="/register">Register</RouterLink>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.6rem 1rem;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.brand {
  font-weight: 700;
  font-size: 1.2rem;
  color: var(--text);
  text-decoration: none;
}
.brand span {
  color: var(--accent);
}
.links {
  display: flex;
  flex: 1;
  gap: 1rem;
  align-items: center;
}
.links a {
  color: var(--muted);
  text-decoration: none;
}
.links a.router-link-active,
.links a:hover {
  color: var(--text);
}
.spacer {
  flex: 1;
}
.menu-toggle {
  display: none;
  margin-left: auto;
}
@media (max-width: 640px) {
  .menu-toggle {
    display: block;
  }
  .links {
    display: none;
    flex-basis: 100%;
    flex-direction: column;
    align-items: flex-start;
  }
  .links.open {
    display: flex;
  }
}
</style>
