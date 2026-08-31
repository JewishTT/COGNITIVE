// pipeline-server/flowsint.mjs — тонкий клиент к движку Flowsint (FastAPI).
//
// Пайплайн не трогает вложенный git-репо flowsint: он авторизуется в
// flowsint-api под аккаунтом платформы и пишет собранный граф (узлы/рёбра с
// весами доверия) в Neo4j через штатные REST-эндпоинты /sketches/*.

import { config } from './config.mjs'

const { base, email, password } = config.flowsint

let token = null
let tokenAt = 0

async function loginFresh() {
  const res = await fetch(`${base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err && err.detail) || `flowsint auth ${res.status}`)
  }
  const json = await res.json()
  token = json.access_token
  tokenAt = Date.now()
  return token
}

async function ensureToken() {
  // refresh раз в случайный период далеко от истечения (30 мин)
  if (token && Date.now() - tokenAt < 25 * 60 * 1000) return token
  return loginFresh()
}

async function api(path, options = {}, retried = false) {
  await ensureToken()
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...((options.headers || {})),
    },
  })
  if (res.status === 401 && !retried) {
    token = null
    return api(path, options, true)
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const detail = data && (data.detail ?? data.message)
    const msg = typeof detail === 'string'
      ? detail
      : detail
        ? (typeof detail === 'object' ? JSON.stringify(detail) : String(detail))
        : `flowsint ${res.status} ${res.statusText || ''}`
    const err = new Error(`${msg} (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

// Флаг: движок недоступен — кэшируем, чтобы не долбить каждый запуск.
let engineAlive = null
export async function engineOnline() {
  if (engineAlive !== null) return engineAlive
  try {
    const h = await fetch(`${base}/health`)
    engineAlive = h.ok
  } catch {
    engineAlive = false
  }
  return engineAlive
}

export async function registerIfMissing() {
  // Движок сам зарегистрирует/залогинит нас на первом обращении. Для простоты
  // пробуем вход, при «Incorrect email or password» — регистрируем и логинимся.
  try {
    await loginFresh()
    return true
  } catch (e) {
    if (/Incorrect email or password/.test(String(e.message))) {
      await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      await loginFresh()
      return true
    }
    throw e
  }
}

export async function listSketches() {
  return api('/sketches')
}

export async function findSketchByTitle(title) {
  // Список всех sketch'ей: сначала берём все investigations и ищем по title
  // среди их sketches (sketches не имеют глобального поиска).
  const invs = await listInvestigations()
  for (const inv of (Array.isArray(invs) ? invs : [])) {
    const sketchList = inv.sketches || []
    const found = sketchList.find((s) => s.title === title)
    if (found) return found
  }
  return null
}

export async function createSketch(title, description, investigationId) {
  if (!investigationId) throw new Error('investigationId обязателен для SketchCreate')
  return api('/sketches/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: description || '', investigation_id: investigationId }),
  })
}

export async function listInvestigations() {
  return api('/investigations')
}

export async function findInvestigationByName(name) {
  const all = await listInvestigations()
  return (Array.isArray(all) ? all : []).find((i) => i.name === name) || null
}

export async function createInvestigation(name, description) {
  return api('/investigations/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || '' }),
  })
}

export async function ensureInvestigation(name, description) {
  const found = await findInvestigationByName(name)
  if (found) return found
  return createInvestigation(name, description || 'Создан автоматическим пайплайном 0-слоя')
}

export async function addNode(sketchId, node) {
  // node — сериализованный GraphNode (см. GraphNode в flowsint core)
  const body = {
    id: node.id ?? null,
    nodeLabel: node.nodeLabel,
    nodeType: node.nodeType,
    nodeSize: node.nodeSize ?? 10,
    nodeColor: node.nodeColor ?? '#22d3ee',
    nodeIcon: node.nodeIcon ?? null,
    nodeImage: node.nodeImage ?? null,
    nodeFlag: node.nodeFlag ?? null,
    nodeShape: node.nodeShape ?? null,
    nodeMetadata: node.nodeMetadata || { created_at: new Date().toISOString() },
    nodeProperties: node.nodeProperties || {},
    x: node.x ?? 100 + Math.random() * 300,
    y: node.y ?? 100 + Math.random() * 200,
  }
  const out = await api(`/sketches/${sketchId}/nodes/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (out && out.node) || out
}

export async function addRelation(sketchId, source, target, label) {
  // Примечание: эндпоинт /relations/add принимает строгую схему RelationInput
  // (source/target/type/label) без весов. Вес доверия храним в label-префиксе
  // («HAS_EMAIL ·0.9») и в nodeProperties узлов.
  const body = {
    source,
    target,
    type: 'one-way',
    label: label || 'RELATED_TO',
  }
  return api(`/sketches/${sketchId}/relations/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function fetchGraph(sketchId) {
  return api(`/sketches/${sketchId}/graph`)
}

export { api }
