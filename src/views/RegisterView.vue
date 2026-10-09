<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { register } from '@/api/auth'
import { showAlert, showError } from '@/alerts'

const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')
const cpassword = ref('')
const busy = ref(false)

async function submit() {
  if (password.value !== cpassword.value) {
    showAlert('error', "The passwords don't match.")
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
    showAlert('success', 'Account created. You can log in now.')
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
    <h1>Register</h1>
    <form class="form" @submit.prevent="submit">
      <label>
        Username
        <input
          v-model="username"
          autocomplete="username"
          required
          minlength="3"
          maxlength="20"
          pattern="[\p{L}\p{N}_.\-]+"
          title="3 to 20 letters, digits, '_', '.' or '-'"
        />
      </label>
      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <label>
        Repeat password
        <input
          v-model="cpassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>
      <button class="primary" type="submit" :disabled="busy">Create account</button>
    </form>
  </div>
</template>
