<script setup lang="ts">
import { ref } from 'vue'

import { changePassword } from '@/api/auth'
import { showAlert, showError } from '@/alerts'
import { t } from '@/i18n'
import { session } from '@/session'

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const busy = ref(false)

async function submit() {
  if (newPassword.value !== repeatPassword.value) {
    showAlert('error', t.value.profile.mismatch)
    return
  }
  busy.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    showAlert('success', t.value.profile.changed)
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

    <h2>{{ t.profile.changePassword }}</h2>
    <form class="form" @submit.prevent="submit">
      <label>
        {{ t.profile.currentPassword }}
        <input v-model="currentPassword" type="password" autocomplete="current-password" required />
      </label>
      <label>
        {{ t.profile.newPassword }}
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <label>
        {{ t.profile.repeatNewPassword }}
        <input
          v-model="repeatPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <button class="primary" type="submit" :disabled="busy">{{ t.profile.submit }}</button>
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
