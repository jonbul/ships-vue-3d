<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { WS_URL } from '@/api/http'
import { listGameShips, type ShipInfo } from '@/api/projects'
import { showError } from '@/alerts'
import ShipThumbnail from '@/components/ShipThumbnail.vue'
import { Game } from '@/game/Game'
import { session } from '@/session'

const GUEST_NAME_KEY = 'ships3d.guestName'
const SHIP_KEY = 'ships3d.lastShip'

const defaults = ref<ShipInfo[]>([])
const own = ref<ShipInfo[]>([])
const selectedId = ref('')
const guestName = ref(readStorage(GUEST_NAME_KEY) ?? '')
const playing = ref(false)
const gameContainer = ref<HTMLElement | null>(null)
let game: Game | null = null

const allShips = computed(() => [...own.value, ...defaults.value])

onMounted(async () => {
  try {
    const ships = await listGameShips()
    defaults.value = ships.defaults
    own.value = ships.own
  } catch (error) {
    showError(error, 'Could not load the ships.')
    return
  }
  const last = readStorage(SHIP_KEY)
  selectedId.value = allShips.value.some((s) => s.id === last)
    ? last!
    : (allShips.value[0]?.id ?? '')
})

onBeforeUnmount(() => stop())

async function start() {
  if (!selectedId.value) return
  writeStorage(SHIP_KEY, selectedId.value)
  if (!session.user) writeStorage(GUEST_NAME_KEY, guestName.value)
  playing.value = true
  await nextTick()
  game = new Game(gameContainer.value!, {
    wsUrl: WS_URL,
    shipId: selectedId.value,
    name: guestName.value,
    onExit: stop,
  })
}

// The Game owns a render loop, a socket and window listeners that outlive
// any DOM node: it must be destroyed explicitly, or every visit leaks one.
function stop() {
  game?.destroy()
  game = null
  playing.value = false
}

// Per-browser conveniences only; private windows may refuse storage.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not important enough to report.
  }
}
</script>

<template>
  <div v-if="playing" ref="gameContainer" class="game-container" />

  <div v-else class="page">
    <h1>Choose your ship</h1>

    <form class="start" @submit.prevent="start">
      <label v-if="!session.user" class="guest">
        Your name
        <input v-model="guestName" maxlength="20" placeholder="Guest" />
      </label>
      <p v-else class="muted">Playing as {{ session.user.username }}</p>
      <button class="primary" type="submit" :disabled="!selectedId">Launch</button>
    </form>

    <template v-if="own.length">
      <h2>My ships</h2>
      <div class="ships">
        <button
          v-for="ship in own"
          :key="ship.id"
          type="button"
          class="ship"
          :class="{ selected: ship.id === selectedId }"
          @click="selectedId = ship.id"
          @dblclick="start"
        >
          <ShipThumbnail :layers="ship.layers" :alt="ship.name" />
          <span>{{ ship.name }}</span>
        </button>
      </div>
    </template>

    <h2>Built-in ships</h2>
    <div class="ships">
      <button
        v-for="ship in defaults"
        :key="ship.id"
        type="button"
        class="ship"
        :class="{ selected: ship.id === selectedId }"
        @click="selectedId = ship.id"
        @dblclick="start"
      >
        <ShipThumbnail :layers="ship.layers" :alt="ship.name" />
        <span>{{ ship.name }}</span>
      </button>
    </div>

    <p v-if="!session.user && session.loaded" class="muted">
      <RouterLink to="/login">Log in</RouterLink> to fly ships you designed yourself.
    </p>
    <p v-else-if="session.user && !own.length" class="muted">
      Design your own in <RouterLink to="/projects">My ships</RouterLink>.
    </p>
  </div>
</template>

<style scoped>
.game-container {
  position: fixed;
  inset: 0;
  z-index: 100;
}
.start {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1rem;
}
.guest {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: var(--muted);
}
.muted {
  color: var(--muted);
}
.ships {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.8rem;
}
.ship {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  text-align: center;
  overflow-wrap: anywhere;
}
.ship.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
</style>
