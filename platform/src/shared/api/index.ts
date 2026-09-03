// shared/api — HTTP-клиент движка Flowsint.
//
// Автовход без единой формы входа: платформа молча логинится под учётной
// записью движка. Если аккаунт ещё не существует — создаёт и логинится.
// При протухшем токене (401) — молча перелогинивается и повторяет запрос.

import { reactive } from 'vue'

export const osintStatus = reactive<{
  online: boolean | null
  message: string
}>({
  online: true,
  message: 'Движок Flowsint (Neo4j) — нативный слой платформы',
})

const API_BASE = '/flowsint-api/api/v1'

export const FS_EMAIL = 'admin@ghostseven.io'
export const FS_PASS = 'Ghost7Admin!2026'
const TOKEN_KEY = 'flowsint_token'

let authToken: string | null = localStorage.getItem(TOKEN_KEY)
let authBusy: Promise<void> | null = null

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err && (err.error as string)) || `Auth ${res.status}`)
  }
  return (await res.json()).token as string
}

async function ensureAuth(): Promise<void> {
  if (authToken) return
  if (authBusy) return authBusy
  authBusy = (async () => {
    try {
      authToken = await login(FS_EMAIL, FS_PASS)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (/Invalid credentials/.test(msg) || /401/.test(msg)) {
        await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: FS_EMAIL, password: FS_PASS }),
        })
        authToken = await login(FS_EMAIL, FS_PASS)
      } else {
        throw e
      }
    }
    if (authToken) localStorage.setItem(TOKEN_KEY, authToken)
  })()
  try {
    await authBusy
  } finally {
    authBusy = null
  }
}

export async function getAuthToken(): Promise<string> {
  await ensureAuth()
  return authToken as string
}

export async function http<T>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  osintStatus.online = true
  try {
    await ensureAuth()
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...((options.headers as Record<string, string> | undefined) ?? {}),
      },
    })
    if (res.status === 401 && !_retried) {
      authToken = null
      localStorage.removeItem(TOKEN_KEY)
      authBusy = null
      return http<T>(path, options, true)
    }
    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      osintStatus.online = false
      osintStatus.message = `Ошибка ${res.status} от движка Flowsint`
      throw new Error((data && (data.detail as string)) || `Ошибка ${res.status}`)
    }
    return data as T
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Ошибка')) throw e
    osintStatus.online = false
    osintStatus.message = 'Движок Flowsint недоступен'
    throw e instanceof Error ? e : new Error('Сеть недоступна')
  }
}