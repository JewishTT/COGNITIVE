// platform/pipeline-server/index.mjs — HTTP API пайплайна 0-слоя.
//
// Чистый node:http-сервер (без зависимостей). Проксируется платформой как
// `/pipeline` (см. platform/vite.platform.config.js). Отдаёт: здоровье,
// статус инструментов и движка, каталог тулов, авто-установку, запуск
// пайплайна, список/детали запусков и живой SSE-поток прогресса.

import http from 'node:http'
import { URL } from 'node:url'
import { config } from './config.mjs'
import { allToolStatus, installTool, ensureVenv } from './tools.mjs'
import { engineOnline, registerIfMissing } from './flowsint.mjs'
import { launch, cancel, listRuns, getRun, subscribe, unsubscribe } from './engine.mjs'

const { port } = config

function json(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

async function handle(req, res) {
  const u = new URL(req.url, `http://localhost:${port}`)
  const p = u.pathname
  const method = req.method || 'GET'
  const seg = p.split('/').filter(Boolean) // ["pipeline", ...]

  // префикс /pipeline отрезаем (в dev vite прокси уже может переписывать,
  // но если сервис доступен напрямую — разрешаем и с префиксом, и без)
  if (seg[0] === 'pipeline') seg.shift()

  try {
    // ---- health ----
    if (method === 'GET' && (p === '/health' || (seg[0] === 'health'))) {
      return json(res, 200, {
        ok: true, service: 'pipeline-server', engine: await engineOnline(), ts: Date.now(),
      })
    }

    // ---- status: инструменты + движок ----
    if (method === 'GET' && seg[0] === 'status') {
      return json(res, 200, {
        tools: allToolStatus(),
        groups: groupTools(),
        engine: await engineOnline(),
        python: { venv: ensureVenv() },
        searxng: Boolean(config.searxng.url || config.searxng.json),
      })
    }

    // ---- каталог тулов ----
    if (method === 'GET' && seg[0] === 'tools') {
      return json(res, 200, allToolStatus())
    }

    // ---- авто-установка инструмента ----
    if (method === 'POST' && seg[0] === 'install' && seg[1]) {
      const r = await installTool(seg[1])
      return json(res, r.ok ? 200 : 409, r)
    }

    // ---- запуск пайплайна ----
    if (method === 'POST' && seg[0] === 'launch') {
      const body = await readJson(req)
      const target = (body.target || '').trim()
      const type = (body.type || 'username').trim()
      if (!target) return json(res, 400, { error: 'target обязателен' })
      const sync = body.sync ? true : false
      if (sync) {
        const { executeRunSync } = await import('./engine.mjs')
        const result = await executeRunSync(target, type)
        return json(res, result.ok ? 200 : 500, result)
      }
      const id = launch(target, type)
      return json(res, 201, { id, target, type, status: 'queued' })
    }

    // ---- список запусков ----
    if (method === 'GET' && seg[0] === 'runs' && !seg[1]) {
      return json(res, 200, listRuns())
    }

    // ---- остановка запуска ----
    if (method === 'POST' && seg[0] === 'runs' && seg[1] && seg[2] === 'cancel') {
      const stopped = cancel(seg[1])
      return json(res, stopped ? 200 : 404, { ok: stopped })
    }

    // ---- детали запуска ----
    if (method === 'GET' && seg[0] === 'runs' && seg[1] && seg[2] === 'events') {
      return streamEvents(req, res, seg[1])
    }
    if (method === 'GET' && seg[0] === 'runs' && seg[1]) {
      const r = getRun(seg[1])
      if (!r) return json(res, 404, { error: 'run not found' })
      return json(res, 200, r)
    }

    return json(res, 404, { error: 'not found' })
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) })
  }
}

function groupTools() {
  const all = allToolStatus()
  const coll = all.filter((t) => t.kind === 'collection')
  const extr = all.filter((t) => t.kind === 'extraction')
  return { collection: coll, extraction: extr }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1e6) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function streamEvents(req, res, runId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`event: connected\ndata: {}\n\n`)
  const ok = subscribe(runId, (payload) => res.write(payload))
  if (!ok) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'run not found' })}\n\n`)
    res.end()
    return
  }
  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`)
    } catch {}
  }, 15000)
  req.on('close', () => {
    clearInterval(ping)
    unsubscribe(runId, (payload) => {})
  })
  return
}

const server = http.createServer(handle)
server.listen(port, '127.0.0.1', () => {
  console.log(`[pipeline-server] 0-слой пайплайн слушает http://127.0.0.1:${port}`)
})

// warm start: проверяем движок в фоне
engineOnline().then(() => {
  // ничего — статус подтянется по запросу
})

process.on('SIGINT', () => server.close(() => process.exit(0)))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
