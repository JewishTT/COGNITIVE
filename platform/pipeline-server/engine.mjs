// pipeline-server/engine.mjs — оркестратор пайплайна 0-слоя.
//
// Планирует запуски (run): СБОР → ИЗВЛЕЧЕНИЕ → ХРАНЕНИЕ (Neo4j), ведёт
// журнал событий и поэтапные результаты. Поддерживает живые подписчики (SSE).

import { randomUUID } from 'node:crypto'
import { collectForTarget } from './collect.mjs'
import { extractEntities } from './extract.mjs'
import { writeGraph } from './store.mjs'
import { engineOnline, registerIfMissing } from './flowsint.mjs'

export class RunCancelledError extends Error {
  constructor() {
    super('Запуск остановлен пользователем')
    this.name = 'RunCancelledError'
  }
}

export function isCancelledError(e) {
  return e && (e.name === 'RunCancelledError' || e.code === 'RUN_CANCELLED')
}

export function checkCancelled(ac) {
  if (ac.signal.aborted) {
    const err = new RunCancelledError()
    err.code = 'RUN_CANCELLED'
    throw err
  }
}

export const runs = new Map() // runId -> state

export function listRuns() {
  return [...runs.values()]
    .map(({ id, status, target, type, createdAt, startedAt, finishedAt, error }) => ({
      id, status, target, type, createdAt, startedAt, finishedAt, error,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function getRun(id) {
  const r = runs.get(id)
  if (!r) return null
  return {
    id: r.id, status: r.status, target: r.target, type: r.type,
    createdAt: r.createdAt, startedAt: r.startedAt, finishedAt: r.finishedAt,
    error: r.error, stages: r.stages, summary: r.summary, enginesOnline: r.enginesOnline,
  }
}

export function subscribe(id, send) {
  const r = getExisting(id)
  if (!r) return false
  r.clients.add(send)
  try {
    // выталкиваем накопленные события сразу при подключении
    for (const ev of r.events) send(`event: log\ndata: ${JSON.stringify(ev)}\n\n`)
    send(`event: snapshot\ndata: ${JSON.stringify({ status: r.status })}\n\n`)
  } catch {}
  return true
}

export function unsubscribe(id, send) {
  const r = getExisting(id)
  if (r) r.clients.delete(send)
}

function getExisting(id) {
  return runs.get(id)
}

function emit(id, ev) {
  const r = runs.get(id)
  if (!r) return
  r.events.push(ev)
  if (r.events.length > 4000) r.events.splice(0, r.events.length - 4000)
  const payload = `event: log\ndata: ${JSON.stringify(ev)}\n\n`
  for (const send of r.clients) {
    try {
      send(payload)
    } catch {}
  }
  // Ограничение на кол-во клиентов, чтобы не накапливать отвалившихся
  for (const send of [...r.clients]) {
    // (соединения сами закрываются по res.close())
  }
}

/**
 * Запускает пайплайн по цели. Возвращает id запуска.
 */
export function launch(target, type, opts = {}) {
  const id = randomUUID()
  const createdAt = Date.now()
  const ac = new AbortController()
  runs.set(id, {
    id, target, type, status: 'queued', createdAt, startedAt: null, finishedAt: null,
    error: null, stages: [], summary: null, enginesOnline: null, events: [], clients: new Set(),
    ac,
  })
  if (opts.sync) return null
  // fire and forget
  queueMicrotask(() => executeRun(id).catch(() => {}))
  return id
}

/**
 * Запрашивает остановку запуска: флипает AbortController, после чего
 * активный прогон graceful-прерывается (прекращает дочерние процессы).
 */
export function cancel(id) {
  const r = runs.get(id)
  if (!r) return false
  if (r.status === 'running' || r.status === 'queued') {
    try { r.ac.abort() } catch {}
    return true
  }
  return false
}

export async function executeRunSync(target, type) {
  // одноразовый синхронный запуск (для /launch?sync=1) — без регистрации run
  const collector = { stage: null, tool: null, level: 'info', text: '' }
  const onEvent = (level, tool, text) => { collector.level = level; collector.tool = tool; collector.text = text }
  try {
    await registerIfMissing()
    const collected = await collectForTarget(target, type, onEvent)
    const extracted = await extractEntities(collected, onEvent)
    const stored = await writeGraph(target, type, collected, extracted, onEvent)
    return { ok: true, collected, extracted, stored }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

async function executeRun(id) {
  const r = runs.get(id)
  if (!r) return
  r.status = 'running'
  r.startedAt = Date.now()
  const signal = r.ac.signal

  const onEvent = (level, tool, text) => emit(id, { ts: Date.now(), level, tool, text })

  try {
    checkCancelled(r.ac)
    const online = await engineOnline()
    r.enginesOnline = online
    emit(id, { ts: Date.now(), level: 'info', tool: 'engine', text: `Движок Flowsint (Neo4j): ${online ? 'доступен' : 'НЕДОСТУПЕН'}` })
    if (!online) {
      emit(id, { ts: Date.now(), level: 'warn', tool: 'engine', text: 'Хранение в Neo4j будет пропущено (нет движка)' })
    } else {
      await registerIfMissing()
    }

    checkCancelled(r.ac)
    const collected = await collectForTarget(r.target, r.type, onEvent, signal)
    r.stages.push({ name: 'collect', label: 'Сбор', ...summarizeStages(collected.stages) })

    checkCancelled(r.ac)
    const extracted = await extractEntities(collected, onEvent, signal)
    r.stages.push({ name: 'extract', label: 'Извлечение',
      emails: extracted.emails.length, phones: extracted.phones.length, ips: extracted.ips.length,
      persons: extracted.persons.length, orgs: extracted.orgs.length, nlpAvailable: extracted.nlpAvailable })

    let stored = null
    if (online) {
      checkCancelled(r.ac)
      stored = await writeGraph(r.target, r.type, collected, extracted, onEvent, signal)
      r.stages.push({ name: 'store', label: 'Neo4j', sketchId: stored.sketchId, nodes: stored.nodesCreated, edges: stored.edgesCreated })
    } else {
      stored = { sketchId: null, nodesCreated: 0, edgesCreated: 0, skipped: true }
      r.stages.push({ name: 'store', label: 'Neo4j', sketchId: null, nodes: 0, edges: 0, skipped: true })
    }

    r.summary = { collectedTotal: countAll(collected), nodes: stored.nodesCreated, edges: stored.edgesCreated, sketchId: stored.sketchId }
    r.status = 'done'
    emit(id, { ts: Date.now(), level: 'success', tool: 'engine', text: `Запуск завершён: ${r.summary.nodes} узлов / ${r.summary.edges} связей` })
  } catch (e) {
    if (isCancelledError(e)) {
      r.status = 'cancelled'
      r.error = 'Остановлен пользователем'
      emit(id, { ts: Date.now(), level: 'warn', tool: 'engine', text: 'Запуск остановлен пользователем' })
    } else {
      r.status = 'error'
      r.error = String((e && e.message) || e)
      emit(id, { ts: Date.now(), level: 'error', tool: 'engine', text: `Ошибка: ${r.error}` })
    }
  } finally {
    r.finishedAt = Date.now()
  }
}

function summarizeStages(stages) {
  const byTool = {}
  for (const s of stages) byTool[s.tool] = { available: s.available, count: s.count }
  return { sources: stages.length, byTool }
}

function countAll(collected) {
  return Object.values(collected.all).reduce((n, a) => n + a.length, 0)
}
