<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { WS_URL } from '@/api/http'
import { listGameShips, type ShipInfo } from '@/api/projects'
import { showError } from '@/alerts'
import ShipThumbnail from '@/components/ShipThumbnail.vue'
import { Game } from '@/game/Game'
import { requestTiltPermission } from '@/game/tilt'
import { locale, t } from '@/i18n'
import { toggleFullscreen, type TouchMode } from '@/game/touchInput'
import { showAlert } from '@/alerts'
import { session } from '@/session'

const GUEST_NAME_KEY = 'ships3d.guestName'
const SHIP_KEY = 'ships3d.lastShip'
const TOUCH_MODE_KEY = 'ships3d.touchMode'

// A phone or tablet: its main pointer is a finger. They get on-screen
// controls (and the choice of steering by tilting the device).
const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false
const touchMode = ref<TouchMode>(readStorage(TOUCH_MODE_KEY) === 'tilt' ? 'tilt' : 'stick')

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
    showError(error, t.value.play.loadFailed)
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
  if (isTouch) {
    // Full screen and (on iOS) the motion-sensor prompt are only allowed
    // during the tap itself, so both start before anything is awaited.
    const fullscreen = document.fullscreenElement
      ? Promise.resolve()
      : toggleFullscreen(document.documentElement)
    const tiltAllowed = touchMode.value === 'tilt' ? requestTiltPermission() : Promise.resolve(true)
    await fullscreen
    if (!(await tiltAllowed)) {
      showAlert('info', t.value.play.noSensors)
      setTouchMode('stick')
    }
  }
  playing.value = true
  await nextTick()
  game = new Game(gameContainer.value!, {
    // The server's own messages (errors, the guest name) in this language.
    wsUrl: `${WS_URL}?lang=${locale.value}`,
    shipId: selectedId.value,
    name: guestName.value,
    onExit: stop,
    touch: isTouch ? { mode: touchMode.value, onModeChange: setTouchMode } : undefined,
  })
}

function setTouchMode(mode: TouchMode) {
  touchMode.value = mode
  writeStorage(TOUCH_MODE_KEY, mode)
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
    <h1>{{ t.play.title }}</h1>

    <form class="start" @submit.prevent="start">
      <label v-if="!session.user" class="guest">
        {{ t.play.yourName }}
        <input v-model="guestName" maxlength="20" :placeholder="t.play.guest" />
      </label>
      <p v-else class="muted">{{ t.play.playingAs(session.user.username) }}</p>
      <div v-if="isTouch" class="steer" role="radiogroup" :aria-label="t.play.steerWith">
        <span class="muted">{{ t.play.steerWith }}</span>
        <button
          type="button"
          :class="{ active: touchMode === 'stick' }"
          :aria-checked="touchMode === 'stick'"
          role="radio"
          @click="setTouchMode('stick')"
        >
          {{ t.play.stick }}
        </button>
        <button
          type="button"
          :class="{ active: touchMode === 'tilt' }"
          :aria-checked="touchMode === 'tilt'"
          role="radio"
          @click="setTouchMode('tilt')"
        >
          {{ t.play.tilt }}
        </button>
      </div>
      <button class="primary" type="submit" :disabled="!selectedId">{{ t.play.launch }}</button>
    </form>

    <template v-if="own.length">
      <h2>{{ t.play.myShips }}</h2>
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

    <h2>{{ t.play.builtIn }}</h2>
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
      {{ t.play.loginBefore }}<RouterLink to="/login">{{ t.play.loginLink }}</RouterLink
      >{{ t.play.loginAfter }}
    </p>
    <p v-else-if="session.user && !own.length" class="muted">
      {{ t.play.ownBefore }}<RouterLink to="/projects">{{ t.play.ownLink }}</RouterLink
      >{{ t.play.ownAfter }}
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
.steer {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.steer button.active {
  border-color: var(--accent);
  color: var(--accent);
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
