// entities/enricher/lib/thebigbrother — зеркало Python-энричера TheBigBrother
// (flowsint-enrichers/.../username_to_socials_thebigbrother): те же типы узлов
// и экспертные веса платформ, чтобы данные в графе были единообразными.
import type { GraphData, GraphEdge, GraphNode } from '@/shared/api/types'

export const TBB_NODE = {
  PERSON: 'person',
  PROFILE: 'social_profile',
  EMAIL: 'email',
  PHONE: 'phone',
  PLACE: 'place',
} as const

export const PLATFORM_CONFIDENCE: Record<string, number> = {
  linkedin: 0.95,
  github: 0.9,
  keybase: 0.88,
  twitter: 0.8,
  x: 0.8,
  mastodon: 0.78,
  instagram: 0.72,
  telegram: 0.75,
  facebook: 0.7,
  reddit: 0.68,
  youtube: 0.66,
  vk: 0.62,
  discord: 0.6,
  tiktok: 0.6,
  medium: 0.55,
  pastebin: 0.3,
  unknown: 0.5,
}

export function platformConfidence(platform: string): number {
  const key = (platform || 'unknown').toLowerCase()
  return PLATFORM_CONFIDENCE[key] ?? PLATFORM_CONFIDENCE.unknown
}

const TYPE_COLOR: Record<string, string> = {
  person: '#22d3ee',
  social_profile: '#a78bfa',
  email: '#34d399',
  phone: '#fbbf24',
  place: '#f472b6',
}

function node(id: string, label: string, type: string, x: number, y: number): GraphNode {
  return {
    id,
    nodeLabel: label,
    nodeType: type,
    nodeColor: TYPE_COLOR[type] ?? '#22d3ee',
    nodeSize: type === TBB_NODE.PERSON ? 14 : 10,
    x,
    y,
    nodeProperties: {},
    nodeMetadata: {},
  }
}

function edge(id: string, source: string, target: string, label: string, weight: number | null): GraphEdge {
  return { id, source, target, label, type: 'one-way', weight }
}

/** Сырой вывод TheBigBrotherTool (тот же контракт, что у Python-тула). */
export interface TheBigBrotherRaw {
  target?: string
  profiles?: Record<string, string>
  emails?: string[]
  phones?: string[]
  usernames?: string[]
  geolocation?: { lat?: number; lon?: number; place?: string } | null
}

export function enrichFromTheBigBrother(raw: TheBigBrotherRaw, rootId = 'person:target'): GraphData {
  const nds: GraphNode[] = []
  const rls: GraphEdge[] = []
  const root = node(rootId, raw.target || 'Цель', TBB_NODE.PERSON, 300, 200)
  nds.push(root)

  let n = 0
  const addRel = (s: string, t: string, label: string, w: number | null) => {
    rls.push(edge(`tbb:r:${n++}`, s, t, label, w))
  }

  for (const [platform, url] of Object.entries(raw.profiles || {})) {
    const id = `tbb:profile:${platform}`
    nds.push(node(id, `${platform}: ${handleOf(url)}`, TBB_NODE.PROFILE, 120 + (n % 2) * 360, 90 + (n % 3) * 110))
    addRel(root.id, id, 'HAS_PROFILE', platformConfidence(platform))
  }
  for (const email of raw.emails || []) {
    const id = `tbb:email:${email}`
    nds.push(node(id, email, TBB_NODE.EMAIL, 300, 40))
    addRel(root.id, id, 'HAS_EMAIL', 0.7)
  }
  for (const phone of raw.phones || []) {
    const id = `tbb:phone:${phone}`
    nds.push(node(id, phone, TBB_NODE.PHONE, 300, 370))
    addRel(root.id, id, 'HAS_PHONE', 0.6)
  }
  const geo = raw.geolocation
  if (geo && (geo.place || geo.lat != null)) {
    const label = geo.place || `${geo.lat}, ${geo.lon}`
    nds.push(node('tbb:geo', label, TBB_NODE.PLACE, 300, 420))
    addRel(root.id, 'tbb:geo', 'LOCATED_AT', 0.5)
  }
  return { nds, rls }
}

function handleOf(url: string): string {
  return url.replace(/\/$/, '').split('/').pop() || url
}