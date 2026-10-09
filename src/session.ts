import { reactive } from 'vue'

import { fetchCurrentUser, type User } from './api/auth'

/**
 * Who is logged in. The server is asked once on startup; the session itself
 * lives in an HttpOnly cookie that scripts can't read, so this is only a
 * cache of the answer, kept in sync by login and logout.
 */
export const session = reactive({
  user: null as User | null,
  loaded: false,
})

let loading: Promise<void> | null = null

export function loadSession(): Promise<void> {
  loading ??= fetchCurrentUser()
    .then((user) => {
      session.user = user
    })
    .catch(() => {
      session.user = null
    })
    .finally(() => {
      session.loaded = true
    })
  return loading
}

export function setUser(user: User | null): void {
  session.user = user
}
