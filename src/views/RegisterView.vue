<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { register } from '@/api/auth'
import { showAlert, showError } from '@/alerts'
import { t } from '@/i18n'

const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')
const cpassword = ref('')
const busy = ref(false)

async function submit() {
  if (password.value !== cpassword.value) {
    showAlert('error', t.value.register.mismatch)
    return
  }
  busy.value = true
  try {
    await register({
      username: username.value,
      email: email.value,
      password: password.value,
      cpassword: cpassword.value,
    })
    showAlert('success', t.value.register.created)
    await router.push('/login')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>{{ t.register.title }}</h1>
    <form class="form" @submit.prevent="submit">
      <label>
        {{ t.register.username }}
        <input
          v-model="username"
          autocomplete="username"
          required
          minlength="3"
          maxlength="20"
          pattern="[\p{L}\p{N}_.\-]+"
          :title="t.register.usernameRule"
        />
      </label>
      <label>
        {{ t.register.email }}
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        {{ t.register.password }}
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <label>
        {{ t.register.repeatPassword }}
        <input
          v-model="cpassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <button class="primary" type="submit" :disabled="busy">{{ t.register.submit }}</button>
    </form>
  </div>
</template>
