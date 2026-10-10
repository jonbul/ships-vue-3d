import { reactive } from 'vue'

import { ApiError, type HelpLink } from './api/http'

export type AlertKind = 'success' | 'error' | 'info'

export interface Alert {
  id: number
  kind: AlertKind
  messages: string[]
  help?: HelpLink
}

export const alerts = reactive<Alert[]>([])
let nextId = 1

export function showAlert(kind: AlertKind, ...messages: string[]): void {
  pushAlert({ kind, messages })
}

function pushAlert(alert: Omit<Alert, 'id'>): void {
  const id = nextId++
  alerts.push({ id, ...alert })
  // Alerts with something to act on stay long enough to read and act on.
  const duration = alert.help ? 20000 : alert.kind === 'error' ? 6000 : 3000
  setTimeout(() => dismissAlert(id), duration)
}

export function dismissAlert(id: number): void {
  const index = alerts.findIndex((alert) => alert.id === id)
  if (index !== -1) alerts.splice(index, 1)
}

/** Shows whatever went wrong, with the server's own messages when it sent any. */
export function showError(error: unknown, fallback = 'Something went wrong.'): void {
  if (error instanceof ApiError)
    pushAlert({ kind: 'error', messages: error.messages, help: error.help })
  else showAlert('error', fallback)
}
