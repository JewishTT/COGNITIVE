// platform/pipeline-server/index.mjs — HTTP API пайплайна 0-слоя.
//
// Чистый node:http-сервер (без зависимостей). Проксируется платформой как
// `/pipeline` (см. platform/vite.platform.config.js). Отдаёт: здоровье,
// статус инструментов и движка, каталог тулов, авто-установку, запуск
// пайплайна, список/детали запусков и живой SSE-поток прогресса.
//
// + Flowsint integration: auth, sketches, investigations, enrichers, events

import http from 'node:http'
import { URL } from 'node:url'
import { config } from './config.mjs'
import { allToolStatus, installTool, ensureVenv } from './tools.mjs'
import { launch, cancel, listRuns, getRun, subscribe, unsubscribe } from './engine.mjs'

// New services
import { AuthService } from './services/auth.mjs'
import { SketchService } from './services/sketch.mjs'
import { InvestigationService } from './services/investigation.mjs'
import { EnricherService } from './services/enricher.mjs'
import { EventBus } from './services/event-bus.mjs'
import { Neo4jMigration } from './services/neo4j-migrate.mjs'

// New route handlers
import { createChatRoutes } from './routes/chat.mjs'
import { createPipelineAdminRoutes } from './routes/pipeline-admin.mjs'
import { createNeo4jAdminRoutes } from './routes/neo4j-admin.mjs'

const { port } = config

// Initialize Neo4j driver
import neo4j from 'neo4j-driver'
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
)

// Initialize services
const authService = new AuthService(driver)
const sketchService = new SketchService(driver)
const investigationService = new InvestigationService(driver)
const enricherService = new EnricherService(driver)
const eventBus = new EventBus()
const neo4jMigration = new Neo4jMigration(driver)

// Set services for engine
import { setServices } from './engine.mjs'
setServices({ investigationService, sketchService, enricherService, eventBus })

// Initialize new route handlers
const handleChat = createChatRoutes({ neo4jDriver: driver })
const handlePipelineAdmin = createPipelineAdminRoutes({ neo4jDriver: driver, eventBus })
const handleNeo4jAdmin = createNeo4jAdminRoutes({ neo4jDriver: driver })

// Ensure indexes
neo4jMigration.ensureIndexes().catch(console.error)

// Prevent crashes from unhandled errors
process.on('uncaughtException', (e) => {
  console.error('[pipeline-server] Uncaught exception:', e.message)
})
process.on('unhandledRejection', (e) => {
  console.error('[pipeline-server] Unhandled rejection:', e?.message || e)
})

function json(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
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

// Auth middleware
async function authenticate(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.split(' ')[1]
  try {
    return authService.verifyToken(token)
  } catch {
    return null
  }
}

function groupTools() {
  const all = allToolStatus()
  const coll = all.filter((t) => t.kind === 'collection')
  const extr = all.filter((t) => t.kind === 'extraction')
  return { collection: coll, extraction: extr }
}

async function handle(req, res) {
  const u = new URL(req.url, `http://localhost:${port}`)
  const p = u.pathname
  const method = req.method || 'GET'
  const seg = p.split('/').filter(Boolean) // ["pipeline", ...]

  // префикс /pipeline отрезаем (в dev vite прокси уже может переписывать,
  // но если сервис доступен напрямую — разрешаем и с префиксом, и без)
  if (seg[0] === 'pipeline') seg.shift()

  // префикс /api/v1 отрезаем для flowsint маршрутов
  let apiSeg = [...seg]
  if (apiSeg[0] === 'api' && apiSeg[1] === 'v1') {
    apiSeg = apiSeg.slice(2)
  }

  try {
    // ---- health ----
    if (method === 'GET' && (p === '/health' || (seg[0] === 'health'))) {
      return json(res, 200, {
        ok: true, service: 'pipeline-server', engine: true, ts: Date.now(),
      })
    }

    // ---- AI CHAT ROUTES (/api/v1/chat/*) ----
    if (apiSeg[0] === 'chat') {
      const body = (method === 'POST' || method === 'DELETE') ? await readJson(req) : null
      // Strip /api/v1 prefix for handler
      const strippedUrl = new URL('/' + apiSeg.join('/'), u.origin)
      const handled = await handleChat(req, res, strippedUrl, method, body, null)
      if (handled) return
    }

    // ---- PIPELINE ADMIN ROUTES (/api/v1/pipeline/*) ----
    if (apiSeg[0] === 'pipeline') {
      const body = (method === 'POST' || method === 'DELETE') ? await readJson(req) : null
      const strippedUrl = new URL('/' + apiSeg.join('/'), u.origin)
      const handled = await handlePipelineAdmin(req, res, strippedUrl, method, body, null)
      if (handled) return
    }

    // ---- NEO4J ADMIN ROUTES (/api/v1/neo4j/*) ----
    if (apiSeg[0] === 'neo4j') {
      const body = (method === 'POST' || method === 'DELETE') ? await readJson(req) : null
      const strippedUrl = new URL('/' + apiSeg.join('/'), u.origin)
      const handled = await handleNeo4jAdmin(req, res, strippedUrl, method, body, null)
      if (handled) return
    }

    // ---- FLOWSINT ROUTES (/api/v1/*) ----

    // POST /api/v1/auth/register
    if (method === 'POST' && apiSeg[0] === 'auth' && apiSeg[1] === 'register') {
      const body = await readJson(req)
      const { email, password } = body
      if (!email || !password) return json(res, 400, { error: 'Email and password are required' })
      if (password.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters' })
      try {
        const result = await authService.register(email, password)
        return json(res, 201, result)
      } catch (err) {
        if (err.message === 'User already exists') return json(res, 409, { error: 'User already exists' })
        throw err
      }
    }

    // POST /api/v1/auth/login
    if (method === 'POST' && apiSeg[0] === 'auth' && apiSeg[1] === 'login') {
      const body = await readJson(req)
      const { email, password } = body
      if (!email || !password) return json(res, 400, { error: 'Email and password are required' })
      try {
        const result = await authService.login(email, password)
        return json(res, 200, result)
      } catch (err) {
        if (err.message === 'Invalid credentials') return json(res, 401, { error: 'Invalid credentials' })
        throw err
      }
    }

    // GET /api/v1/auth/me
    if (method === 'GET' && apiSeg[0] === 'auth' && apiSeg[1] === 'me') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      try {
        const userData = await authService.getUser(user.id)
        return json(res, 200, userData)
      } catch (err) {
        if (err.message === 'User not found') return json(res, 404, { error: 'User not found' })
        throw err
      }
    }

    // POST /api/v1/sketches
    if (method === 'POST' && apiSeg[0] === 'sketches' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      const { title, description, investigation_id } = body
      if (!title) return json(res, 400, { error: 'Title is required' })
      const sketch = await sketchService.create(user.id, title, description, investigation_id)
      return json(res, 201, sketch)
    }

    // GET /api/v1/sketches
    if (method === 'GET' && apiSeg[0] === 'sketches' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const sketches = await sketchService.list(user.id)
      return json(res, 200, { sketches })
    }

    // GET /api/v1/sketches/:id
    if (method === 'GET' && apiSeg[0] === 'sketches' && apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      try {
        const sketch = await sketchService.getById(user.id, apiSeg[1])
        return json(res, 200, sketch)
      } catch (err) {
        if (err.message === 'Sketch not found') return json(res, 404, { error: 'Sketch not found' })
        throw err
      }
    }

    // PUT /api/v1/sketches/:id
    if (method === 'PUT' && apiSeg[0] === 'sketches' && apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      try {
        const sketch = await sketchService.update(user.id, apiSeg[1], body)
        return json(res, 200, sketch)
      } catch (err) {
        if (err.message === 'Sketch not found') return json(res, 404, { error: 'Sketch not found' })
        if (err.message === 'No updates provided') return json(res, 400, { error: 'No updates provided' })
        throw err
      }
    }

    // DELETE /api/v1/sketches/:id
    if (method === 'DELETE' && apiSeg[0] === 'sketches' && apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      await sketchService.delete(user.id, apiSeg[1])
      return res.writeHead(204).end()
    }

    // GET /api/v1/investigations
    if (method === 'GET' && apiSeg[0] === 'investigations' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const investigations = await investigationService.list(user.id)
      return json(res, 200, investigations)
    }

    // POST /api/v1/investigations
    if (method === 'POST' && apiSeg[0] === 'investigations' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      const { sketch_id, name } = body
      if (!sketch_id || !name) return json(res, 400, { error: 'sketch_id and name are required' })
      const investigation = await investigationService.create(sketch_id, name)
      return json(res, 201, investigation)
    }

    // GET /api/v1/investigations/:id
    if (method === 'GET' && apiSeg[0] === 'investigations' && apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      try {
        const investigation = await investigationService.getById(apiSeg[1])
        return json(res, 200, investigation)
      } catch (err) {
        if (err.message === 'Investigation not found') return json(res, 404, { error: 'Investigation not found' })
        throw err
      }
    }

    // POST /api/v1/investigations/:id/nodes
    if (method === 'POST' && apiSeg[0] === 'investigations' && apiSeg[1] && apiSeg[2] === 'nodes') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      const { type, data, confidence } = body
      if (!type) return json(res, 400, { error: 'type is required' })
      const node = await investigationService.addNode(apiSeg[1], type, data || {}, confidence)
      return json(res, 201, node)
    }

    // POST /api/v1/investigations/:id/relations
    if (method === 'POST' && apiSeg[0] === 'investigations' && apiSeg[1] && apiSeg[2] === 'relations') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      const { source_id, target_id, type, data, weight } = body
      if (!source_id || !target_id || !type) return json(res, 400, { error: 'source_id, target_id, and type are required' })
      const relation = await investigationService.addRelation(apiSeg[1], source_id, target_id, type, data, weight)
      return json(res, 201, relation)
    }

    // GET /api/v1/investigations/:id/graph
    if (method === 'GET' && apiSeg[0] === 'investigations' && apiSeg[1] && apiSeg[2] === 'graph') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const depth = parseInt(u.searchParams.get('depth')) || 1
      try {
        const graph = await investigationService.getGraph(apiSeg[1], depth)
        return json(res, 200, graph)
      } catch (err) {
        if (err.message === 'Investigation not found') return json(res, 404, { error: 'Investigation not found' })
        throw err
      }
    }

    // GET /api/v1/enrichers
    if (method === 'GET' && apiSeg[0] === 'enrichers' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const enrichers = await enricherService.listEnrichers()
      return json(res, 200, { enrichers })
    }

    // POST /api/v1/enrichers/:name/run
    if (method === 'POST' && apiSeg[0] === 'enrichers' && apiSeg[1] && apiSeg[2] === 'run') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      const body = await readJson(req)
      const { investigation_id, node_ids, config } = body
      if (!investigation_id) return json(res, 400, { error: 'investigation_id is required' })
      const result = await enricherService.runEnricher(apiSeg[1], investigation_id, node_ids || [], config || {})
      eventBus.emit('enricher.started', { runId: result.runId, enricher: result.enricher, investigationId: investigation_id })
      return json(res, 202, result)
    }

    // GET /api/v1/enrichers/:name/runs/:run_id
    if (method === 'GET' && apiSeg[0] === 'enrichers' && apiSeg[1] && apiSeg[2] === 'runs' && apiSeg[3]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      try {
        const run = await enricherService.getRunStatus(apiSeg[3])
        return json(res, 200, run)
      } catch (err) {
        if (err.message === 'Run not found') return json(res, 404, { error: 'Run not found' })
        throw err
      }
    }

    // GET /api/v1/events/logs
    if (method === 'GET' && apiSeg[0] === 'events' && apiSeg[1] === 'logs') {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      
      const sketchId = u.searchParams.get('sketch_id')
      const limit = parseInt(u.searchParams.get('limit')) || 100
      
      // For now, return empty logs - in production, query from Neo4j
      const logs = []
      return json(res, 200, logs)
    }

    // GET /api/v1/events (SSE)
    if (method === 'GET' && apiSeg[0] === 'events' && !apiSeg[1]) {
      const user = await authenticate(req)
      if (!user) return json(res, 401, { error: 'Unauthorized' })
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.write(`data: ${JSON.stringify({ event: 'connected', data: { timestamp: new Date().toISOString() } })}\n\n`)
      eventBus.addClient(res)
      
      const heartbeat = setInterval(() => {
        try { res.write(`:heartbeat\n\n`) } catch {}
      }, 30000)
      req.on('close', () => clearInterval(heartbeat))
      return
    }

    // ---- PIPELINE ROUTES (existing) ----

    // ---- status: инструменты + движок ----
    if (method === 'GET' && seg[0] === 'status') {
      return json(res, 200, {
        tools: allToolStatus(),
        groups: groupTools(),
        engine: true,
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
    console.error('Request error:', e)
    return json(res, 500, { error: String((e && e.message) || e) })
  }
}

const server = http.createServer(handle)
server.listen(port, '127.0.0.1', () => {
  console.log(`[pipeline-server] 0-слой пайплайн слушает http://127.0.0.1:${port}`)
})

process.on('SIGINT', () => {
  driver.close()
  server.close(() => process.exit(0))
})
process.on('SIGTERM', () => {
  driver.close()
  server.close(() => process.exit(0))
})