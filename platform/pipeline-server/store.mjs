// pipeline-server/store.mjs — этап «Хранение» 0-слоя.
//
// Превращает результаты сбора+извлечения в граф Neo4j через flowsint-api:
// находит/создаёт sketch, пишет корневой узел цели + найденные сущности и
// связи с весами доверия источника. Возвращает построенный граф (nodes/edges).

import * as fs from './flowsint.mjs'

// Экспертные веса доверия по типу источника (как в thebigbrother.ts платформы).
const PLATFORM_CONFIDENCE = {
  linkedin: 0.95, github: 0.9, twitter: 0.9, telegram: 0.85,
  instagram: 0.85, reddit: 0.8, hackernews: 0.7, pastebin: 0.3,
}

const SNAP = (n) => Math.max(0.2, Math.min(0.99, n))

function confForProfile(platform) {
  const p = String(platform || '').toLowerCase()
  for (const k of Object.keys(PLATFORM_CONFIDENCE)) if (p.includes(k)) return PLATFORM_CONFIDENCE[k]
  return 0.6
}

// Цвета по типам узлов (совпадают с thebigbrother.ts).
const TYPE_COLOR = {
  username: '#22d3ee', person: '#f472b6', social_profile: '#a78bfa',
  email: '#34d399', phone: '#fbbf24', ip: '#38bdf8', place: '#fb923c',
  organization: '#60a5fa', domain: '#4ade80', location: '#2dd4bf',
}

// Слой данных для сегментации графа (0 — источники, 1 — атрибуты/контакты,
// 2 — смежные сущности по NER). Кодируется в цвете и метаданных.
const LAYERS = {
  domain: 0, username: 0, social_profile: 0,
  email: 1, phone: 1, ip: 1,
  person: 2, organization: 2, place: 2,
}
const LAYER_COLOR = ['#22d3ee', '#34d399', '#a78bfa'] // 0/1/2

function node(type, label, props = {}, color) {
  const layer = LAYERS[type] ?? 0
  return {
    id: null,
    nodeType: type,
    nodeLabel: label,
    nodeSize: layer === 0 ? 14 : layer === 2 ? 12 : 10,
    nodeColor: color || (LAYER_COLOR[layer] || TYPE_COLOR[type] || '#22d3ee'),
    nodeProperties: { source: 'pipeline', layer, ...props },
    nodeMetadata: { created_at: new Date().toISOString(), pipeline: '0-layer', layer },
  }
}

export async function ensureSketch(title) {
  const existing = await fs.findSketchByTitle(title)
  if (existing) return existing
  // Граф живёт внутри расследования; создаём/находим расследование «Пайплайн»,
  // затем sketch внутри него.
  const invName = 'Пайплайн (0-слой)'
  const inv = await fs.ensureInvestigation(invName, 'Автоматические расследования пайплайна первичного сбора')
  return fs.createSketch(title, `Собран автоматическим пайплайном 0-слоя (${new Date().toISOString()})`, inv.id || inv.investigation_id)
}

const seenNodes = new Map() // `${type}:${label}` -> id
const seenEdges = new Map() // `${source}->${target}::${label}` -> true

async function ensureNode(sketchId, type, label, props) {
  const key = `${type}:${label}`
  if (seenNodes.has(key)) return seenNodes.get(key)
  const created = await fs.addNode(sketchId, node(type, label, props))
  const id = (created && (created.id || created.nodeId)) || null
  seenNodes.set(key, id)
  return id
}

async function link(sketchId, sourceId, targetId, label, weight) {
  if (!sourceId || !targetId) return
  const key = `${sourceId}->${targetId}::${label}`
  if (seenEdges.has(key)) return
  // вес доверия префиксом в label (эндпоинт /relations/add не принимает weight)
  const relLabel = weight != null ? `${label} ·${Math.round(weight * 100)}` : label
  seenEdges.set(key, true)
  try {
    await fs.addRelation(sketchId, sourceId, targetId, relLabel)
  } catch (e) {
    // игнорируем ошибку связи (узел уже создан) — не блокируем остальное
  }
}

/**
 * Материализует результат пайплайна в граф Neo4j.
 * @returns {Promise<{sketchId, sketchTitle, nodesCreated, edgesCreated, graph}>}
 */
export async function writeGraph(target, type, collected, extracted, onEvent, signal) {
  onEvent && onEvent('stage', 'store', 'Этап ХРАНЕНИЕ: запись в Neo4j (flowsint-api)')
  const cv = () => { if (signal && signal.aborted) { const e = new Error('Запуск остановлен пользователем'); e.code = 'RUN_CANCELLED'; throw e } }

  const sketchTitle = `Пайплайн · ${target}`
  const sketch = await ensureSketch(sketchTitle)
  const sketchId = sketch.id || sketch.sketch_id
  onEvent && onEvent('info', 'store', `Sketch «${sketchTitle}» (${sketchId})`)

  seenNodes.clear()
  seenEdges.clear()

  // 1) корневой узел цели
  cv()
  const rootType = type === 'domain' ? 'domain' : type === 'email' ? 'email' : 'username'
  const rootId = await ensureNode(sketchId, rootType, target, { processed: new Date().toISOString() })

  let nodesCreated = 1
  let edgesCreated = 0

  // 2) профили соцсетей (слой 0 — источники)
  for (const p of (collected.all.profiles || [])) {
    cv()
    const pl = p.platform || 'web'
    const pid = await ensureNode(sketchId, 'social_profile', p.url || `${pl}:${String(p.handle || target)}`, {
      platform: pl, handle: p.handle || null, confidence: SNAP(p.confidence ?? confForProfile(pl)), sourceKind: p.source,
    })
    await link(sketchId, rootId, pid, 'HAS_PROFILE', SNAP(p.confidence ?? confForProfile(pl)))
    nodesCreated++; edgesCreated++
  }

  // 3) email (слой 1 — контакты/атрибуты)
  const emailSet = new Set(extracted.emails)
  for (const e of [...emailSet]) {
    cv()
    const eid = await ensureNode(sketchId, 'email', String(e).toLowerCase(), { confidence: 0.6 })
    await link(sketchId, rootId, eid, 'HAS_EMAIL', 0.6)
    nodesCreated++; edgesCreated++
  }

  // 4) телефоны
  const phoneSet = new Set(extracted.phones)
  for (const ph of [...phoneSet]) {
    cv()
    const phid = await ensureNode(sketchId, 'phone', String(ph).trim(), { confidence: 0.5 })
    await link(sketchId, rootId, phid, 'HAS_PHONE', 0.5)
    nodesCreated++; edgesCreated++
  }

  // 5) IP
  const ipSet = new Set(extracted.ips)
  for (const ip of [...ipSet]) {
    cv()
    const iid = await ensureNode(sketchId, 'ip', String(ip), { confidence: 0.5 })
    await link(sketchId, rootId, iid, 'HAS_IP', 0.5)
    nodesCreated++; edgesCreated++
  }

  // 6) люди (spaCy NER) — слой 2
  for (const person of (extracted.persons || [])) {
    cv()
    const pid = await ensureNode(sketchId, 'person', String(person), { confidence: 0.8, ner: true })
    await link(sketchId, rootId, pid, 'MENTIONS_PERSON', 0.8)
    nodesCreated++; edgesCreated++
  }

  // 7) организации (spaCy NER) — слой 2
  for (const org of (extracted.orgs || [])) {
    cv()
    const oid = await ensureNode(sketchId, 'organization', String(org), { confidence: 0.7, ner: true })
    await link(sketchId, rootId, oid, 'MENTIONS_ORG', 0.7)
    nodesCreated++; edgesCreated++
  }

  // 8) гео (spaCy GPE) → месте — слой 2
  for (const gpe of (extracted.gpes || [])) {
    cv()
    const gid = await ensureNode(sketchId, 'place', String(gpe), { confidence: 0.6, ner: true })
    await link(sketchId, rootId, gid, 'LOCATED_AT', 0.6)
    nodesCreated++; edgesCreated++
  }

  // 9) EXIF-гео (если есть)
  if (extracted.exif && extracted.exif.results) {
    for (const ex of extracted.exif.results) {
      cv()
      if (ex.gps) {
        const gid = await ensureNode(sketchId, 'place', `${ex.gps.lat.toFixed(4)},${ex.gps.lon.toFixed(4)}`, { lat: ex.gps.lat, lon: ex.gps.lon, source: 'exiftool' })
        await link(sketchId, rootId, gid, 'LOCATED_AT', 0.9)
        nodesCreated++; edgesCreated++
      }
    }
  }

  // читаем итоговый граф из движка для ответа
  let graph = { nds: [], rls: [] }
  try {
    graph = await fs.fetchGraph(sketchId)
  } catch {}

  onEvent && onEvent('stage_done', 'store', `Записано в Neo4j: ${nodesCreated} узлов / ${edgesCreated} связей`)
  return { sketchId, sketchTitle, nodesCreated, edgesCreated, graph }
}
