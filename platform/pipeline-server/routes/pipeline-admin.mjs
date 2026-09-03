// routes/pipeline-admin.mjs — Pipeline management endpoints.
//
// GET  /api/v1/pipeline/status       — overall status + tool availability
// GET  /api/v1/pipeline/tools        — detailed tool catalog
// POST /api/v1/pipeline/scan         — launch a scan
// GET  /api/v1/pipeline/runs         — list recent runs
// GET  /api/v1/pipeline/runs/:id     — run details
// POST /api/v1/pipeline/runs/:id/cancel — cancel a run
// GET  /api/v1/pipeline/runs/:id/events — SSE progress stream
// GET  /api/v1/pipeline/history      — scan history from Neo4j

import { allToolStatus, installTool } from '../tools.mjs'
import { collectForTarget } from '../collect.mjs'
import { extractEntities } from '../extract.mjs'
import { writeGraph } from '../store.mjs'
import { runs } from '../engine.mjs'
import { config } from '../config.mjs'

function ok(res, data) { j(res, 200, data); return true }
function err(res, code, data) { j(res, code, data); return true }

export function createPipelineAdminRoutes(deps) {
  const { neo4jDriver, eventBus } = deps

  return async function handlePipelineAdmin(req, res, url, method, body) {
    const p = url.pathname

    // GET /pipeline/status
    if (method === 'GET' && p === '/pipeline/status') {
      const tools = allToolStatus()
      const active = [...runs.values()].filter(r => r.status === 'running')
      return ok(res, {
        ok: true,
        tools: tools.map(t => ({ name: t.name, label: t.label, available: t.available, kind: t.kind, group: t.group })),
        activeRuns: active.length, totalRuns: runs.size,
        uptime: process.uptime(), memory: process.memoryUsage(),
      })
    }

    // GET /pipeline/tools
    if (method === 'GET' && p === '/pipeline/tools') {
      return ok(res, { tools: allToolStatus() })
    }

    // POST /pipeline/tools/:name/install
    if (method === 'POST' && /^\/pipeline\/tools\/[^/]+\/install$/.test(p)) {
      const name = p.split('/')[3]
      const result = await installTool(name)
      return ok(res, result)
    }

    // POST /pipeline/scan
    if (method === 'POST' && p === '/pipeline/scan') {
      const { target, type = 'domain', scanId } = body || {}
      if (!target) return err(res, 400, { error: 'target required' })
      const valid = ['domain', 'email', 'username', 'ip', 'phone']
      if (!valid.includes(type)) return err(res, 400, { error: `type must be: ${valid.join(', ')}` })

      const id = scanId || `scan_${Date.now().toString(36)}`
      const state = {
        id, target, type, status: 'running',
        startedAt: Date.now(), completedAt: null,
        collected: null, extracted: null, graphWritten: false,
        error: null, events: [],
      }
      runs.set(id, state)

      ;(async () => {
        try {
          const onEvent = (level, tool, msg) => {
            state.events.push({ ts: Date.now(), level, tool, msg })
            eventBus?.emit?.('pipeline:scan:progress', { scanId: id, level, tool, msg })
          }
          const collected = await collectForTarget(target, type, onEvent)
          state.collected = {
            emails: collected.all?.emails?.length || 0,
            hosts: collected.all?.hosts?.length || 0,
            links: collected.all?.links?.length || 0,
            profiles: collected.all?.profiles?.length || 0,
            texts: collected.all?.texts?.length || 0,
          }
          const extracted = await extractEntities(collected, onEvent)
          state.extracted = {
            emails: extracted.emails?.length || 0,
            phones: extracted.phones?.length || 0,
            ips: extracted.ips?.length || 0,
            domains: extracted.domains?.length || 0,
            btc: extracted.crypto?.btc?.length || 0,
            eth: extracted.crypto?.eth?.length || 0,
          }
          if (neo4jDriver) {
            try {
              await writeGraph(target, type, collected, extracted, onEvent, null, { neo4jDriver })
              state.graphWritten = true
            } catch (e) { onEvent('warn', 'store', `Neo4j write failed: ${e.message}`) }
          }
          state.status = 'completed'
          state.completedAt = Date.now()
          eventBus?.emit?.('pipeline:scan:completed', { scanId: id })
        } catch (e) {
          state.status = 'failed'
          state.error = e.message
          state.completedAt = Date.now()
        }
      })()

      return ok(res, { ok: true, scanId: id, status: 'running' })
    }

    // GET /pipeline/runs
    if (method === 'GET' && p === '/pipeline/runs') {
      const limit = Number(url.searchParams.get('limit') || 20)
      const all = [...runs.values()]
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit)
        .map(r => ({
          id: r.id, target: r.target, type: r.type, status: r.status,
          startedAt: r.startedAt, completedAt: r.completedAt,
          collected: r.collected, extracted: r.extracted,
        }))
      return ok(res, { runs: all })
    }

    // GET /pipeline/runs/:id
    if (method === 'GET' && /^\/pipeline\/runs\/[^/]+$/.test(p)) {
      const id = p.split('/')[3]
      const run = runs.get(id)
      if (!run) return err(res, 404, { error: 'run not found' })
      return ok(res, { run })
    }

    // POST /pipeline/runs/:id/cancel
    if (method === 'POST' && /^\/pipeline\/runs\/[^/]+\/cancel$/.test(p)) {
      const id = p.split('/')[3]
      const run = runs.get(id)
      if (!run) return err(res, 404, { error: 'run not found' })
      if (run.status !== 'running') return err(res, 400, { error: 'not running' })
      run.status = 'cancelled'
      run.completedAt = Date.now()
      return ok(res, { ok: true })
    }

    // GET /pipeline/runs/:id/events
    if (method === 'GET' && /^\/pipeline\/runs\/[^/]+\/events$/.test(p)) {
      const id = p.split('/')[3]
      const run = runs.get(id)
      if (!run) { j(res, 404, { error: 'run not found' }); return true }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
      for (const ev of run.events) res.write(`data: ${JSON.stringify(ev)}\n\n`)
      if (run.status !== 'running') {
        res.write(`data: ${JSON.stringify({ type: 'done', status: run.status })}\n\n`)
        res.end()
        return true
      }
      const listener = (evt) => {
        if (evt.scanId === id) {
          res.write(`data: ${JSON.stringify(evt)}\n\n`)
          if (evt.type === 'done') res.end()
        }
      }
      eventBus?.on?.('pipeline:scan:progress', listener)
      req.on('close', () => eventBus?.off?.('pipeline:scan:progress', listener))
      return true
    }

    // GET /pipeline/history
    if (method === 'GET' && p === '/pipeline/history') {
      if (!neo4jDriver) return ok(res, { history: [] })
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const result = await session.run('MATCH (n:Scan) RETURN n ORDER BY n.startedAt DESC LIMIT 25')
        await session.close()
        return ok(res, { history: result.records.map(r => r.get('n').properties) })
      } catch { return ok(res, { history: [] }) }
    }

    return false
  }
}

function j(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
