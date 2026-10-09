import { reactive } from 'vue'

import { ApiError } from './api/http'

export type AlertKind = 'success' | 'error' | 'info'

export interface Alert {
  id: number
  kind: AlertKind
  messages: string[]
}

export const alerts = reactive<Alert[]>([])
let nextId = 1

export function showAlert(kind: AlertKind, ...messages: string[]): void {
  const id = nextId++
  alerts.push({ id, kind, messages })
  setTimeout(() => dismissAlert(id), kind === 'error' ? 6000 : 3000)
}

export function dismissAlert(id: number): void {
  const index = alerts.findIndex((alert) => alert.id === id)
  if (index !== -1) alerts.splice(index, 1)
}

/** Shows whatever went wrong, with the server's own messages when it sent any. */
export function showError(error: unknown, fallback = 'Something went wrong.'): void {
  if (error instanceof ApiError) showAlert('error', ...error.messages)
  else showAlert('error', fallback)
}
