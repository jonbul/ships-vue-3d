<script setup lang="ts">
import { ref } from 'vue'

import { changePassword } from '@/api/auth'
import { showAlert, showError } from '@/alerts'
import { session } from '@/session'

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const busy = ref(false)

async function submit() {
  if (newPassword.value !== repeatPassword.value) {
    showAlert('error', "The new passwords don't match.")
    return
  }
  busy.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    showAlert('success', 'Password changed. Your other devices have been logged out.')
    currentPassword.value = newPassword.value = repeatPassword.value = ''
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="session.user" class="page">
    <h1>{{ session.user.username }}</h1>
    <p class="muted">{{ session.user.email }}</p>

    <h2>Change password</h2>
    <form class="form" @submit.prevent="submit">
      <label>
        Current password
        <input v-model="currentPassword" type="password" autocomplete="current-password" required />
      </label>
      <label>
        New password
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <label>
        Repeat new password
        <input
          v-model="repeatPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <button class="primary" type="submit" :disabled="busy">Change password</button>
    </form>
  </div>
</template>

<style scoped>
.muted {
  color: var(--muted);
}
h2 {
  margin-top: 2rem;
}
</style>
