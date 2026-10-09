import { request } from './http'

export interface User {
  _id: string
  admin: boolean
  username: string
  email: string
  credits: number
  kills: number
  deaths: number
}

export async function fetchCurrentUser(): Promise<User | null> {
  const data = await request<{ user: User | null }>('/userInfo')
  return data.user
}

export async function login(email: string, password: string, rememberMe: boolean): Promise<User> {
  const data = await request<{ user: User }>('/login', {
    method: 'POST',
    body: { email, password, rememberMe },
  })
  return data.user
}

export async function logout(): Promise<void> {
  await request('/logout', { method: 'POST' })
}

export async function register(body: {
  username: string
  email: string
  password: string
  cpassword: string
}): Promise<void> {
  await request('/register', { method: 'POST', body })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/changePassword', { method: 'POST', body: { currentPassword, newPassword } })
}
