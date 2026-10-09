<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { getProject, saveProject } from '@/api/projects'
import { showAlert, showError } from '@/alerts'
import { Editor, type GizmoMode, type PartRef } from '@/editor/Editor'
import { History } from '@/editor/history'
import {
  LIMITS,
  PART_LABELS,
  PART_TYPES,
  boundingRadius,
  cloneLayers,
  clonePart,
  countParts,
  newLayer,
  newPart,
  newProject,
  validateProject,
  type Layer,
  type Part,
  type PartType,
  type Project,
} from '@/shared/shipModel'

const route = useRoute()
const router = useRouter()

const viewport = ref<HTMLElement | null>(null)
let editor: Editor | null = null

const project = reactive<Project>(newProject())
const selected = ref<PartRef | null>(null)
const activeLayer = ref(0)
const mode = ref<GizmoMode>('translate')
const snap = ref(true)
const currentColor = ref('#9aa7b8')
const loading = ref(true)
const saving = ref(false)

const history = new History()
// History isn't reactive; bumping this re-evaluates canUndo/canRedo.
const historyVersion = ref(0)
const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo)
const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo)

const savedSnapshot = ref('')
const snapshot = () => JSON.stringify({ name: project.name, layers: project.layers })
const dirty = computed(() => !loading.value && snapshot() !== savedSnapshot.value)

const partCount = computed(() => countParts(project.layers))
const radius = computed(() => boundingRadius(project.layers))
const selectedPart = computed<Part | null>(() => {
  const ref = selected.value
  return (ref && project.layers[ref.layer]?.parts[ref.part]) || null
})
const currentLayer = computed<Layer | undefined>(() => project.layers[activeLayer.value])

// --- Lifecycle ---------------------------------------------------------------

onMounted(async () => {
  editor = new Editor(viewport.value!, {
    onSelect(ref) {
      selected.value = ref
      if (ref) activeLayer.value = ref.layer
    },
    onCommit: commit,
  })
  editor.setSnap(snap.value)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', onBeforeUnload)
  await load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  editor?.destroy()
  editor = null
})

onBeforeRouteLeave(() => {
  if (dirty.value && !confirm('You have unsaved changes. Leave anyway?')) return false
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

async function load() {
  loading.value = true
  const id = typeof route.params.id === 'string' ? route.params.id : ''
  let loaded: Project = newProject()
  if (id) {
    try {
      loaded = await getProject(id)
    } catch (error) {
      showError(error, 'Could not load the ship.')
      await router.replace('/projects')
      return
    }
  }
  Object.assign(project, { _id: loaded._id, name: loaded.name, layers: loaded.layers })
  if (project.layers.length === 0) project.layers.push(newLayer('Hull'))
  activeLayer.value = 0
  selected.value = null
  history.reset(project.layers)
  historyVersion.value++
  savedSnapshot.value = snapshot()
  editor?.setLayers(project.layers)
  editor?.focus()
  loading.value = false
}

// The view is reused when only the id changes (e.g. back/forward between two
// ships). Saving a new ship also changes it, but sets project._id first, so
// that case doesn't reload.
watch(
  () => route.params.id,
  (id) => {
    if ((id || undefined) === project._id) return
    if (dirty.value && !confirm('You have unsaved changes. Discard them?')) return
    void load()
  },
)

watch(mode, (value) => editor?.setMode(value))
watch(snap, (value) => editor?.setSnap(value))

// --- History -----------------------------------------------------------------

function commit() {
  history.commit(project.layers)
  historyVersion.value++
}

function restore(layers: Layer[] | null) {
  if (!layers) return
  project.layers = layers
  historyVersion.value++
  const ref = selected.value
  if (ref && !project.layers[ref.layer]?.parts[ref.part]) selected.value = null
  activeLayer.value = Math.min(activeLayer.value, project.layers.length - 1)
  editor?.setLayers(project.layers)
  editor?.select(selected.value)
}

const undo = () => restore(history.undo())
const redo = () => restore(history.redo())

// --- Parts -------------------------------------------------------------------

function selectPart(ref: PartRef | null) {
  selected.value = ref
  if (ref) activeLayer.value = ref.layer
  editor?.select(ref)
}

/** Re-renders after the parts changed, keeping the selection. */
function refresh() {
  editor?.rebuild()
  editor?.select(selected.value)
}

function addPart(type: PartType) {
  if (partCount.value >= LIMITS.parts) {
    showAlert('error', `A ship can't have more than ${LIMITS.parts} parts.`)
    return
  }
  const layer = currentLayer.value
  if (!layer) return
  layer.visible = true
  layer.parts.push(newPart(type, currentColor.value))
  refresh()
  selectPart({ layer: activeLayer.value, part: layer.parts.length - 1 })
  commit()
}

function duplicateSelected() {
  const ref = selected.value
  const part = selectedPart.value
  if (!ref || !part) return
  if (partCount.value >= LIMITS.parts) {
    showAlert('error', `A ship can't have more than ${LIMITS.parts} parts.`)
    return
  }
  const copy = clonePart(part)
  copy.position[0] = Math.min(copy.position[0] + 1, LIMITS.coordinate)
  project.layers[ref.layer]!.parts.splice(ref.part + 1, 0, copy)
  refresh()
  selectPart({ layer: ref.layer, part: ref.part + 1 })
  commit()
}

function deleteSelected() {
  const ref = selected.value
  if (!ref || !selectedPart.value) return
  project.layers[ref.layer]!.parts.splice(ref.part, 1)
  selectPart(null)
  refresh()
  commit()
}

type VectorField = 'position' | 'rotation' | 'scale'

function displayValue(field: VectorField, axis: number): string {
  const value = selectedPart.value?.[field][axis] ?? 0
  return field === 'rotation'
    ? String(Math.round(((value * 180) / Math.PI) * 10) / 10)
    : String(Math.round(value * 1000) / 1000)
}

/**
 * Applies a typed number. While typing (`final` false) an out-of-range value
 * is simply not applied yet: clamping it would rewrite the box under the
 * cursor, so typing "0.2" into a size became 0.01 at the "0" and ended up as
 * "0.012". On change (blur/Enter) it is clamped and the box shows the result.
 */
function setVector(field: VectorField, axis: number, event: Event, final: boolean) {
  const part = selectedPart.value
  const input = event.target as HTMLInputElement
  const raw = parseFloat(input.value)
  if (!part) return
  if (Number.isFinite(raw)) {
    const value = field === 'rotation' ? (raw * Math.PI) / 180 : raw
    const [min, max] =
      field === 'position'
        ? [-LIMITS.coordinate, LIMITS.coordinate]
        : field === 'scale'
          ? [LIMITS.minScale, LIMITS.maxScale]
          : [-Infinity, Infinity]
    const clamped = Math.max(min, Math.min(max, value))
    if (final || clamped === value) {
      part[field][axis] = clamped
      refresh()
    }
  }
  if (final) {
    input.value = displayValue(field, axis)
    commit()
  }
}

function setColor(color: string) {
  const part = selectedPart.value
  currentColor.value = color
  if (!part) return
  part.color = color
  refresh()
  commit()
}

function setType(type: PartType) {
  if (!selectedPart.value) return
  selectedPart.value.type = type
  refresh()
  commit()
}

function setMirror(mirror: boolean) {
  if (!selectedPart.value) return
  selectedPart.value.mirror = mirror
  refresh()
  commit()
}

const SWATCHES = [
  '#9aa7b8',
  '#e6ecf5',
  '#555b66',
  '#e05a47',
  '#ff7043',
  '#ffd54f',
  '#66bb6a',
  '#4fc3f7',
  '#7e57c2',
]

// --- Layers ------------------------------------------------------------------

function setActiveLayer(index: number) {
  activeLayer.value = index
  if (selected.value && selected.value.layer !== index) selectPart(null)
}

function addLayer() {
  if (project.layers.length >= LIMITS.layers) {
    showAlert('error', `A ship can't have more than ${LIMITS.layers} layers.`)
    return
  }
  project.layers.push(newLayer(`Layer ${project.layers.length + 1}`))
  setActiveLayer(project.layers.length - 1)
  commit()
}

function removeLayer(index: number) {
  const layer = project.layers[index]
  if (!layer || project.layers.length === 1) return
  if (
    layer.parts.length > 0 &&
    !confirm(`Delete layer "${layer.name}" and its ${layer.parts.length} parts?`)
  ) {
    return
  }
  project.layers.splice(index, 1)
  selectPart(null)
  activeLayer.value = Math.min(activeLayer.value, project.layers.length - 1)
  refresh()
  commit()
}

function toggleLayer(index: number) {
  const layer = project.layers[index]
  if (!layer) return
  layer.visible = !layer.visible
  if (!layer.visible && selected.value?.layer === index) selectPart(null)
  refresh()
  commit()
}

// --- Saving ------------------------------------------------------------------

async function save() {
  const problems = validateProject(project)
  if (problems.length > 0) {
    showAlert('error', ...problems)
    return
  }
  saving.value = true
  try {
    const saved = await saveProject({ ...project, layers: cloneLayers(project.layers) })
    const created = !project._id
    project._id = saved._id
    project.name = saved.name
    savedSnapshot.value = snapshot()
    showAlert('success', 'Ship saved.')
    if (created) await router.replace(`/editor/${saved._id}`)
  } catch (error) {
    showError(error, 'Could not save the ship.')
  } finally {
    saving.value = false
  }
}

// --- Keyboard ----------------------------------------------------------------

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing = target?.closest('input, select, textarea, [contenteditable]')
  const ctrl = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()

  if (ctrl && key === 's') {
    event.preventDefault()
    void save()
    return
  }
  if (typing) return

  if (ctrl && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  } else if (ctrl && key === 'y') {
    event.preventDefault()
    redo()
  } else if (ctrl && key === 'd') {
    event.preventDefault()
    duplicateSelected()
  } else if (ctrl) {
    return
  } else if (key === 'delete' || key === 'backspace') {
    deleteSelected()
  } else if (key === 'w') {
    mode.value = 'translate'
  } else if (key === 'e') {
    mode.value = 'rotate'
  } else if (key === 'r') {
    mode.value = 'scale'
  } else if (key === 'f') {
    editor?.focus()
  } else if (key === 'escape') {
    selectPart(null)
  }
}
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <RouterLink class="back" to="/projects" title="My ships">←</RouterLink>
      <input
        v-model="project.name"
        class="name"
        placeholder="Ship name"
        :maxlength="LIMITS.projectName"
        aria-label="Ship name"
      />
      <button class="primary" type="button" :disabled="saving || loading" @click="save">
        {{ project._id ? 'Save' : 'Create' }}{{ dirty ? ' •' : '' }}
      </button>

      <div class="group">
        <button type="button" :disabled="!canUndo" title="Undo (Ctrl+Z)" @click="undo">↶</button>
        <button type="button" :disabled="!canRedo" title="Redo (Ctrl+Shift+Z)" @click="redo">
          ↷
        </button>
      </div>

      <div class="group" role="radiogroup" aria-label="Tool">
        <button
          v-for="[value, label, key] in [
            ['translate', 'Move', 'W'],
            ['rotate', 'Rotate', 'E'],
            ['scale', 'Scale', 'R'],
          ] as const"
          :key="value"
          type="button"
          :class="{ active: mode === value }"
          :title="`${label} (${key})`"
          @click="mode = value"
        >
          {{ label }}
        </button>
      </div>
      <label class="check"><input v-model="snap" type="checkbox" /> Snap</label>
      <button type="button" title="Focus (F)" @click="editor?.focus()">Focus</button>
      <span class="count">{{ partCount }} / {{ LIMITS.parts }} parts</span>
    </header>

    <aside class="panel left">
      <section>
        <h3>
          Layers
          <button type="button" class="small" title="Add layer" @click="addLayer">+</button>
        </h3>
        <ul class="list">
          <li
            v-for="(layer, i) in project.layers"
            :key="i"
            :class="{ active: i === activeLayer }"
            @click="setActiveLayer(i)"
          >
            <button
              type="button"
              class="icon"
              :title="
                layer.visible ? 'Hide (hidden layers are not part of the ship in game)' : 'Show'
              "
              @click.stop="toggleLayer(i)"
            >
              {{ layer.visible ? '👁' : '—' }}
            </button>
            <input
              v-model="layer.name"
              class="layer-name"
              :maxlength="LIMITS.layerName"
              @change="commit"
            />
            <span class="muted">{{ layer.parts.length }}</span>
            <button
              type="button"
              class="icon"
              title="Delete layer"
              :disabled="project.layers.length === 1"
              @click.stop="removeLayer(i)"
            >
              ✕
            </button>
          </li>
        </ul>
      </section>

      <section>
        <h3>Add part</h3>
        <div class="add-grid">
          <button v-for="type in PART_TYPES" :key="type" type="button" @click="addPart(type)">
            {{ PART_LABELS[type] }}
          </button>
        </div>
      </section>

      <section v-if="currentLayer">
        <h3>Parts in “{{ currentLayer.name }}”</h3>
        <ul class="list">
          <li
            v-for="(part, i) in currentLayer.parts"
            :key="i"
            :class="{ active: selected?.layer === activeLayer && selected?.part === i }"
            @click="selectPart({ layer: activeLayer, part: i })"
          >
            <span class="swatch" :style="{ background: part.color }" />
            {{ PART_LABELS[part.type] }} {{ i + 1 }}
            <span v-if="part.mirror" class="muted" title="Mirrored">⇋</span>
          </li>
          <li v-if="currentLayer.parts.length === 0" class="muted">No parts yet.</li>
        </ul>
      </section>
    </aside>

    <div ref="viewport" class="viewport" />

    <aside class="panel right">
      <template v-if="selectedPart">
        <h3>Part</h3>
        <label class="row">
          Type
          <select
            :value="selectedPart.type"
            @change="setType(($event.target as HTMLSelectElement).value as PartType)"
          >
            <option v-for="type in PART_TYPES" :key="type" :value="type">
              {{ PART_LABELS[type] }}
            </option>
          </select>
        </label>

        <div
          v-for="[field, label, step] in [
            ['position', 'Position', 0.25],
            ['rotation', 'Rotation °', 15],
            ['scale', 'Size', 0.1],
          ] as const"
          :key="field"
          class="vector"
        >
          <span>{{ label }}</span>
          <input
            v-for="(axis, i) in ['X', 'Y', 'Z']"
            :key="axis"
            type="number"
            :step="step"
            :aria-label="`${label} ${axis}`"
            :title="axis"
            :value="displayValue(field, i)"
            @input="setVector(field, i, $event, false)"
            @change="setVector(field, i, $event, true)"
          />
        </div>

        <label class="row">
          Color
          <input
            type="color"
            :value="selectedPart.color"
            @change="setColor(($event.target as HTMLInputElement).value)"
          />
        </label>
        <div class="swatches">
          <button
            v-for="color in SWATCHES"
            :key="color"
            type="button"
            class="swatch-button"
            :style="{ background: color }"
            :title="color"
            @click="setColor(color)"
          />
        </div>

        <label class="row check">
          <input
            type="checkbox"
            :checked="selectedPart.mirror"
            @change="setMirror(($event.target as HTMLInputElement).checked)"
          />
          Mirror left/right
        </label>

        <div class="actions">
          <button type="button" title="Ctrl+D" @click="duplicateSelected">Duplicate</button>
          <button type="button" class="danger" title="Delete" @click="deleteSelected">
            Delete
          </button>
        </div>
      </template>
      <template v-else>
        <h3>No part selected</h3>
        <p class="muted">
          Add a part from the left, or click one in the view. Drag to orbit, right-drag to pan,
          scroll to zoom.
        </p>
        <p class="muted">The blue arrow is the front of the ship.</p>
      </template>

      <p class="muted size">
        Ship radius: {{ radius.toFixed(1) }}. Every ship is scaled to the same size in game, so only
        the shape matters.
      </p>
    </aside>
  </div>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template-columns: 15rem 1fr 18rem;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'toolbar toolbar toolbar'
    'left viewport right';
  /* Not 100%: the parent <main> is a flex item, whose height doesn't count
     as definite for a percentage. This is a full-screen route anyway. */
  height: 100dvh;
}
.toolbar {
  grid-area: toolbar;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.8rem;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.back {
  font-size: 1.3rem;
  text-decoration: none;
  color: var(--text);
}
.name {
  width: 14rem;
}
.group {
  display: flex;
}
.group button {
  border-radius: 0;
}
.group button:first-child {
  border-radius: 6px 0 0 6px;
}
.group button:last-child {
  border-radius: 0 6px 6px 0;
}
button.active {
  border-color: var(--accent);
  color: var(--accent);
}
.count {
  margin-left: auto;
  color: var(--muted);
  font-size: 0.9rem;
}
.viewport {
  grid-area: viewport;
  position: relative;
  min-height: 0;
  overflow: hidden;
}
.panel {
  overflow-y: auto;
  padding: 0.6rem 0.8rem;
  background: var(--panel);
}
.left {
  grid-area: left;
  border-right: 1px solid var(--border);
}
.right {
  grid-area: right;
  border-left: 1px solid var(--border);
}
h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.6rem 0 0.4rem;
  font-size: 0.95rem;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
}
.list li.active {
  background: var(--panel-2);
  outline: 1px solid var(--accent);
}
.layer-name {
  flex: 1;
  min-width: 0;
  padding: 0.15rem 0.3rem !important;
}
button.small,
button.icon {
  padding: 0.1rem 0.45rem;
}
button.icon {
  background: none;
  border-color: transparent;
}
.add-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.swatch {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
  border: 1px solid var(--border);
}
.muted {
  color: var(--muted);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.row.check,
.check {
  justify-content: flex-start;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.vector {
  display: grid;
  grid-template-columns: 4.5rem repeat(3, 1fr);
  gap: 0.3rem;
  align-items: center;
  margin: 0.4rem 0;
}
.vector input {
  width: 100%;
  min-width: 0;
  padding: 0.25rem !important;
  /* The spinner arrows took most of the room; the step still works with the
     keyboard arrows. */
  appearance: textfield;
  -moz-appearance: textfield;
}
.vector input::-webkit-inner-spin-button,
.vector input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.swatch-button {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border-radius: 4px;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.8rem;
}
.size {
  margin-top: 1.5rem;
  font-size: 0.85rem;
}

/* Phones and narrow windows: the view on top, panels stacked below it. */
@media (max-width: 900px) {
  .editor {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 55dvh auto;
    grid-template-areas:
      'toolbar toolbar'
      'viewport viewport'
      'left right';
    height: auto;
    min-height: 100dvh;
  }
  .name {
    width: 9rem;
  }
}
@media (max-width: 560px) {
  .editor {
    grid-template-columns: 1fr;
    grid-template-areas:
      'toolbar'
      'viewport'
      'right'
      'left';
  }
}
</style>
