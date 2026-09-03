// routes/neo4j-admin.mjs — Neo4j graph management endpoints.
//
// GET  /api/v1/neo4j/stats         — database statistics (node/rel counts, labels)
// POST /api/v1/neo4j/query         — run arbitrary Cypher query
// GET  /api/v1/neo4j/labels        — list all node labels
// GET  /api/v1/neo4j/relationships — list all relationship types
// GET  /api/v1/neo4j/nodes/:label  — sample nodes of a label
// DELETE /api/v1/neo4j/data        — clear all data (dangerous!)
// GET  /api/v1/neo4j/health        — connectivity check

import { config } from '../config.mjs'

function ok(res, data) { json(res, 200, data); return true }
function err(res, code, data) { json(res, code, data); return true }

export function createNeo4jAdminRoutes(deps) {
  const { neo4jDriver } = deps

  return async function handleNeo4jAdmin(req, res, url, method, body, user) {
    const p = url.pathname
    if (!neo4jDriver) return err(res, 503, { error: 'Neo4j not connected' })

    // GET /neo4j/health
    if (method === 'GET' && p === '/neo4j/health') {
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        await session.run('RETURN 1 AS n')
        await session.close()
        return ok(res, { ok: true, connected: true })
      } catch (e) {
        return err(res, 503, { ok: false, connected: false, error: e.message })
      }
    }

    // GET /neo4j/stats
    if (method === 'GET' && p === '/neo4j/stats') {
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const [nodeCount, relCount, labelsR, relsR] = await Promise.all([
          session.run('MATCH (n) RETURN count(n) AS count'),
          session.run('MATCH ()-[r]->() RETURN count(r) AS count'),
          session.run('CALL db.labels() YIELD label RETURN collect(label) AS labels'),
          session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types'),
        ])
        await session.close()

        const labels = labelsR.records[0]?.get('labels') || []
        const relTypes = relsR.records[0]?.get('types') || []

        const labelCounts = {}
        const s2 = neo4jDriver.session({ database: config.neo4j.database })
        for (const label of labels) {
          const r = await s2.run(`MATCH (n:\`${label}\`) RETURN count(n) AS count`)
          labelCounts[label] = r.records[0]?.get('count')?.toNumber() || 0
        }
        await s2.close()

        return ok(res, {
          nodes: nodeCount.records[0]?.get('count')?.toNumber() || 0,
          relationships: relCount.records[0]?.get('count')?.toNumber() || 0,
          labels, relationshipTypes: relTypes, labelCounts,
        })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    // POST /neo4j/query
    if (method === 'POST' && p === '/neo4j/query') {
      const { cypher, params = {} } = body || {}
      if (!cypher) return err(res, 400, { error: 'cypher required' })
      const norm = cypher.trim().toLowerCase()
      if (/^\s*(delete|drop|remove|create|merge)\s/.test(norm) && !body.confirmDestructive) {
        return err(res, 400, { error: 'Destructive query requires confirmDestructive: true' })
      }
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const result = await session.run(cypher, params)
        await session.close()
        const records = result.records.map(r => {
          const obj = {}
          for (const key of r.keys) obj[key] = serializeNeo4j(r.get(key))
          return obj
        })
        return ok(res, { records, count: records.length })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    // GET /neo4j/labels
    if (method === 'GET' && p === '/neo4j/labels') {
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const result = await session.run('CALL db.labels() YIELD label RETURN collect(label) AS labels')
        await session.close()
        return ok(res, { labels: result.records[0]?.get('labels') || [] })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    // GET /neo4j/relationships
    if (method === 'GET' && p === '/neo4j/relationships') {
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const result = await session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types')
        await session.close()
        return ok(res, { types: result.records[0]?.get('types') || [] })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    // GET /neo4j/nodes/:label
    if (method === 'GET' && p.startsWith('/neo4j/nodes/')) {
      const label = decodeURIComponent(p.split('/').pop())
      const limit = Number(url.searchParams.get('limit') || 50)
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        const result = await session.run(`MATCH (n:\`${label}\`) RETURN n LIMIT $limit`, { limit })
        await session.close()
        return ok(res, { nodes: result.records.map(r => serializeNeo4j(r.get('n'))) })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    // DELETE /neo4j/data
    if (method === 'DELETE' && p === '/neo4j/data') {
      if (!body?.confirm) return err(res, 400, { error: 'confirm: true required' })
      try {
        const session = neo4jDriver.session({ database: config.neo4j.database })
        await session.run('MATCH (n) DETACH DELETE n')
        await session.close()
        return ok(res, { ok: true, message: 'All data deleted' })
      } catch (e) {
        return err(res, 500, { error: e.message })
      }
    }

    return false
  }
}

function serializeNeo4j(value) {
  if (value == null) return null
  if (typeof value === 'object' && value.low !== undefined && value.high !== undefined) {
    return value.toNumber ? value.toNumber() : value.low
  }
  if (value.labels && value.properties) {
    return { _type: 'node', labels: value.labels, properties: serializeNeo4j(value.properties), identity: value.identity?.toNumber?.() }
  }
  if (value.type && value.start && value.end) {
    return { _type: 'relationship', type: value.type, properties: serializeNeo4j(value.properties), start: value.start?.toNumber?.(), end: value.end?.toNumber?.() }
  }
  if (value.segments) {
    return { _type: 'path', segments: value.segments.map(s => ({ start: serializeNeo4j(s.start), relationship: serializeNeo4j(s.relationship), end: serializeNeo4j(s.end) })) }
  }
  if (Array.isArray(value)) return value.map(serializeNeo4j)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = serializeNeo4j(v)
    return out
  }
  return value
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
