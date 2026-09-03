// pipeline-server/store.mjs — этап «Хранение» 0-слоя.
//
// Превращает результаты сбора+извлечения в граф Neo4j через новые сервисы
// (без REST-моста): находит/создаёт sketch, пишет корневой узел цели +
// найденные сущности и связи с весами доверия источника.

import { v4 as uuidv4 } from 'uuid'

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
  btc: '#f7931a', eth: '#627eea',
}

// Слой данных для сегментации графа (0 — источники, 1 — атрибуты/контакты,
// 2 — смежные сущности по NER). Кодируется в цвете и метаданных.
const LAYERS = {
  domain: 0, username: 0, social_profile: 0,
  email: 1, phone: 1, ip: 1, btc: 1, eth: 1,
  person: 2, organization: 2, place: 2,
}
const LAYER_COLOR = ['#22d3ee', '#34d399', '#a78bfa'] // 0/1/2

function node(type, label, props = {}, color) {
  const layer = LAYERS[type] ?? 0
  return {
    type,
    data: {
      label,
      layer,
      ...props,
    },
    confidence: props.confidence || (layer === 0 ? 0.9 : layer === 2 ? 0.8 : 0.6),
  }
}

// Кэш для investigation и sketch
let cachedInvestigation = null
let cachedSketch = null

async function ensureInvestigation(investigationService) {
  if (cachedInvestigation) return cachedInvestigation
  
  // Ищем существующее investigation или создаём новое
  // Примечание: в новой архитектуре investigation привязан к sketch
  cachedInvestigation = { id: uuidv4(), name: 'Пайплайн (0-слой)' }
  return cachedInvestigation
}

async function ensureSketch(sketchService, userId, title) {
  if (cachedSketch && cachedSketch.title === title) return cachedSketch
  
  // Ищем существующий sketch по заголовку
  const sketches = await sketchService.list(userId)
  const existing = sketches.find(s => s.title === title)
  if (existing) {
    cachedSketch = existing
    return existing
  }
  
  // Создаём новый sketch
  const sketch = await sketchService.create(userId, title, `Собран автоматическим пайплайном 0-слоя (${new Date().toISOString()})`)
  cachedSketch = sketch
  return sketch
}

const seenNodes = new Map() // `${type}:${label}` -> id
const seenEdges = new Map() // `${source}->${target}::${label}` -> true

async function ensureNode(investigationService, investigationId, type, label, props) {
  const key = `${type}:${label}`
  if (seenNodes.has(key)) return seenNodes.get(key)
  const nodeData = node(type, label, props)
  const created = await investigationService.addNode(investigationId, nodeData.type, nodeData.data, nodeData.confidence)
  const id = created.id
  seenNodes.set(key, id)
  return id
}

async function link(investigationService, investigationId, sourceId, targetId, type, weight) {
  if (!sourceId || !targetId) return
  const key = `${sourceId}->${targetId}::${type}`
  if (seenEdges.has(key)) return
  seenEdges.set(key, true)
  try {
    await investigationService.addRelation(investigationId, sourceId, targetId, type, { weight }, weight)
  } catch (e) {
    // игнорируем ошибку связи (узел уже создан) — не блокируем остальное
  }
}

/**
 * Материализует результат пайплайна в граф Neo4j.
 * @returns {Promise<{sketchId, sketchTitle, nodesCreated, edgesCreated, graph}>}
 */
export async function writeGraph(target, type, collected, extracted, onEvent, signal, services) {
  const { investigationService, sketchService } = services
  const userId = 'pipeline-system' // Системный пользователь для пайплайна
  
  onEvent && onEvent('stage', 'store', 'Этап ХРАНЕНИЕ: запись в Neo4j')
  const cv = () => { if (signal && signal.aborted) { const e = new Error('Запуск остановлен пользователем'); e.code = 'RUN_CANCELLED'; throw e } }

  // Создаём/находим investigation
  const investigation = await ensureInvestigation(investigationService)
  const investigationId = investigation.id
  
  // Создаём/находим sketch
  const sketchTitle = `Пайплайн · ${target}`
  const sketch = await ensureSketch(sketchService, userId, sketchTitle)
  const sketchId = sketch.id
  
  onEvent && onEvent('info', 'store', `Sketch «${sketchTitle}» (${sketchId})`)

  seenNodes.clear()
  seenEdges.clear()

  // 1) корневой узел цели
  cv()
  const rootType = type === 'domain' ? 'domain' : type === 'email' ? 'email' : 'username'
  const rootId = await ensureNode(investigationService, investigationId, rootType, target, { processed: new Date().toISOString() })

  let nodesCreated = 1
  let edgesCreated = 0

  // 2) профили соцсетей (слой 0 — источники)
  for (const p of (collected.all.profiles || [])) {
    cv()
    const pl = p.platform || 'web'
    const pid = await ensureNode(investigationService, investigationId, 'social_profile', p.url || `${pl}:${String(p.handle || target)}`, {
      platform: pl, handle: p.handle || null, confidence: SNAP(p.confidence ?? confForProfile(pl)), sourceKind: p.source,
    })
    await link(investigationService, investigationId, rootId, pid, 'HAS_PROFILE', SNAP(p.confidence ?? confForProfile(pl)))
    nodesCreated++; edgesCreated++
  }

  // 3) email (слой 1 — контакты/атрибуты)
  const emailSet = new Set(extracted.emails)
  for (const e of [...emailSet]) {
    cv()
    const eid = await ensureNode(investigationService, investigationId, 'email', String(e).toLowerCase(), { confidence: 0.6 })
    await link(investigationService, investigationId, rootId, eid, 'HAS_EMAIL', 0.6)
    nodesCreated++; edgesCreated++
  }

  // 4) телефоны
  const phoneSet = new Set(extracted.phones)
  for (const ph of [...phoneSet]) {
    cv()
    const phid = await ensureNode(investigationService, investigationId, 'phone', String(ph).trim(), { confidence: 0.5 })
    await link(investigationService, investigationId, rootId, phid, 'HAS_PHONE', 0.5)
    nodesCreated++; edgesCreated++
  }

  // 5) IP
  const ipSet = new Set(extracted.ips)
  for (const ip of [...ipSet]) {
    cv()
    const iid = await ensureNode(investigationService, investigationId, 'ip', String(ip), { confidence: 0.5 })
    await link(investigationService, investigationId, rootId, iid, 'HAS_IP', 0.5)
    nodesCreated++; edgesCreated++
  }

  // 5.1) BTC адреса
  for (const btc of (extracted.btc || [])) {
    cv()
    const bid = await ensureNode(investigationService, investigationId, 'btc', String(btc), { confidence: 0.7, chain: 'bitcoin' })
    await link(investigationService, investigationId, rootId, bid, 'HAS_BTC', 0.7)
    nodesCreated++; edgesCreated++
  }

  // 5.2) ETH адреса
  for (const eth of (extracted.eth || [])) {
    cv()
    const eid = await ensureNode(investigationService, investigationId, 'eth', String(eth), { confidence: 0.7, chain: 'ethereum' })
    await link(investigationService, investigationId, rootId, eid, 'HAS_ETH', 0.7)
    nodesCreated++; edgesCreated++
  }

  // 6) люди (spaCy NER) — слой 2
  for (const person of (extracted.persons || [])) {
    cv()
    const pid = await ensureNode(investigationService, investigationId, 'person', String(person), { confidence: 0.8, ner: true })
    await link(investigationService, investigationId, rootId, pid, 'MENTIONS_PERSON', 0.8)
    nodesCreated++; edgesCreated++
  }

  // 7) организации (spaCy NER) — слой 2
  for (const org of (extracted.orgs || [])) {
    cv()
    const oid = await ensureNode(investigationService, investigationId, 'organization', String(org), { confidence: 0.7, ner: true })
    await link(investigationService, investigationId, rootId, oid, 'MENTIONS_ORG', 0.7)
    nodesCreated++; edgesCreated++
  }

  // 8) гео (spaCy GPE) → месте — слой 2
  for (const gpe of (extracted.gpes || [])) {
    cv()
    const gid = await ensureNode(investigationService, investigationId, 'place', String(gpe), { confidence: 0.6, ner: true })
    await link(investigationService, investigationId, rootId, gid, 'LOCATED_AT', 0.6)
    nodesCreated++; edgesCreated++
  }

  // 9) EXIF-гео (если есть)
  if (extracted.exif && extracted.exif.results) {
    for (const ex of extracted.exif.results) {
      cv()
      if (ex.gps) {
        const gid = await ensureNode(investigationService, investigationId, 'place', `${ex.gps.lat.toFixed(4)},${ex.gps.lon.toFixed(4)}`, { lat: ex.gps.lat, lon: ex.gps.lon, source: 'exiftool' })
        await link(investigationService, investigationId, rootId, gid, 'LOCATED_AT', 0.9)
        nodesCreated++; edgesCreated++
      }
    }
  }

  // читаем итоговый граф
  const graph = await investigationService.getGraph(investigationId)

  onEvent && onEvent('stage_done', 'store', `Записано в Neo4j: ${nodesCreated} узлов / ${edgesCreated} связей (BTC: ${extracted.btc?.length || 0}, ETH: ${extracted.eth?.length || 0})`)
  return { sketchId, sketchTitle, investigationId, nodesCreated, edgesCreated, graph }
}