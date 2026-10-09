<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { deleteProject, listProjects } from '@/api/projects'
import { showAlert, showError } from '@/alerts'
import ShipThumbnail from '@/components/ShipThumbnail.vue'
import type { Project } from '@/shared/shipModel'

const projects = ref<Project[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    projects.value = await listProjects()
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
})

async function remove(project: Project) {
  if (!project._id || !confirm(`Delete "${project.name}"? This can't be undone.`)) return
  try {
    await deleteProject(project._id)
    projects.value = projects.value.filter((p) => p._id !== project._id)
    showAlert('success', `"${project.name}" deleted.`)
  } catch (error) {
    showError(error)
  }
}

function formatDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString() : ''
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>My ships</h1>
      <RouterLink class="button primary" to="/editor">+ New ship</RouterLink>
    </div>

    <p v-if="loading">Loading…</p>
    <p v-else-if="projects.length === 0" class="empty">
      You haven't designed any ships yet. Start with
      <RouterLink to="/editor">a new one</RouterLink>.
    </p>

    <div class="grid">
      <article v-for="project in projects" :key="project._id" class="card">
        <RouterLink :to="`/editor/${project._id}`">
          <ShipThumbnail :layers="project.layers" :alt="project.name" />
        </RouterLink>
        <h3>{{ project.name }}</h3>
        <p class="dates">Modified {{ formatDate(project.dateModified) }}</p>
        <div class="card-actions">
          <RouterLink class="button" :to="`/editor/${project._id}`">Edit</RouterLink>
          <button class="danger" type="button" @click="remove(project)">Delete</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.empty {
  color: var(--muted);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 1rem;
}
.card {
  padding: 0.7rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
}
.card h3 {
  margin: 0.6rem 0 0.2rem;
  overflow-wrap: anywhere;
}
.dates {
  margin: 0 0 0.6rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.card-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
