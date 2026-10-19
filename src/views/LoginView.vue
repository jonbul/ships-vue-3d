<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { login } from '@/api/auth'
import { showError } from '@/alerts'
import { t } from '@/i18n'
import { setUser } from '@/session'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const busy = ref(false)

async function submit() {
  busy.value = true
  try {
    setUser(await login(email.value, password.value, rememberMe.value))
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    // Only follow redirects within this site.
    await router.push(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>{{ t.login.title }}</h1>
    <form class="form" @submit.prevent="submit">
      <label>
        {{ t.login.email }}
        <input v-model="email" type="email" autocomplete="email" required autofocus />
      </label>
      <label>
        {{ t.login.password }}
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <label class="inline">
        <input v-model="rememberMe" type="checkbox" />
        {{ t.login.rememberMe }}
      </label>
      <button class="primary" type="submit" :disabled="busy">{{ t.login.submit }}</button>
      <p>
        {{ t.login.noAccount }} <RouterLink to="/register">{{ t.login.register }}</RouterLink>
        <br />
        {{ t.login.sharedAccounts }}
      </p>
    </form>
  </div>
</template>
