// entities/graph/lib/mock — демо-графы без бэкенда (симплициальный комплекс и
// «координированная личность» TheBigBrother) для TDA-слоя.
import type { GraphData, GraphEdge, GraphNode } from '@/shared/api/types'
import { platformConfidence, TBB_NODE } from '@/entities/enricher/lib/thebigbrother'

function node(id: string, label: string, type: string, x: number, y: number): GraphNode {
  return {
    id,
    nodeLabel: label,
    nodeType: type,
    nodeColor: '#22d3ee',
    nodeSize: 10,
    x,
    y,
    nodeProperties: {},
    nodeMetadata: {},
  }
}

function edge(id: string, source: string, target: string, label: string, weight: number | null = null): GraphEdge {
  return { id, source, target, label, type: 'one-way', weight }
}

/**
 * Демо TDA: 2 склеенных 2-симплекса (A,B,C)+(B,C,D), дыра (4-цикл E–F–G–H),
 * висячее ребро C–I и изолированная вершина J. На этом комплексе работает и
 * Betti, и критический анализ (bridge C–D, точки сочленения …).
 */
export function demoGraph(): GraphData {
  const nds: GraphNode[] = [
    node('dA', 'A', 'person', 90, 90),
    node('dB', 'B', 'person', 250, 90),
    node('dC', 'C', 'org', 90, 250),
    node('dD', 'D', 'org', 250, 250),
    node('dE', 'E', 'place', 450, 90),
    node('dF', 'F', 'place', 620, 90),
    node('dG', 'G', 'place', 620, 250),
    node('dH', 'H', 'place', 450, 250),
    node('dI', 'I', 'event', 90, 420),
    node('dJ', 'J', 'event', 450, 430),
  ]
  const rls: GraphEdge[] = [
    edge('dAB', 'dA', 'dB', 'связь'),
    edge('dAC', 'dA', 'dC', 'связь'),
    edge('dBC', 'dB', 'dC', 'общее ребро'),
    edge('dBD', 'dB', 'dD', 'связь'),
    edge('dCD', 'dC', 'dD', 'связь'),
    edge('dEF', 'dE', 'dF', 'связь'),
    edge('dFG', 'dF', 'dG', 'связь'),
    edge('dGH', 'dG', 'dH', 'связь'),
    edge('dHE', 'dH', 'dE', 'связь'),
    edge('dCI', 'dC', 'dI', 'участвовал'),
  ]
  return { nds, rls }
}

/** Демо TheBigBrother: координированная личность с 4-циклом без хорд (H1). */
export function theBigBrotherDemo(): GraphData {
  const nds: GraphNode[] = [
    node('tbb:p', 'Оператор X', TBB_NODE.PERSON, 300, 200),
    node('tbb:li', 'LinkedIn · X', TBB_NODE.PROFILE, 120, 80),
    node('tbb:gh', 'GitHub · X', TBB_NODE.PROFILE, 480, 80),
    node('tbb:tw', 'Twitter · X', TBB_NODE.PROFILE, 120, 330),
    node('tbb:tg', 'Telegram · X', TBB_NODE.PROFILE, 480, 330),
    node('tbb:em', 'x@proton.me', TBB_NODE.EMAIL, 300, 40),
    node('tbb:ph', '+1 555 0100', TBB_NODE.PHONE, 300, 370),
    node('tbb:geo', 'Берлин', TBB_NODE.PLACE, 300, 430),
  ]
  const rls: GraphEdge[] = [
    edge('tbb:1', 'tbb:p', 'tbb:li', 'HAS_PROFILE', platformConfidence('linkedin')),
    edge('tbb:2', 'tbb:p', 'tbb:gh', 'HAS_PROFILE', platformConfidence('github')),
    edge('tbb:3', 'tbb:p', 'tbb:tw', 'HAS_PROFILE', platformConfidence('twitter')),
    edge('tbb:4', 'tbb:p', 'tbb:tg', 'HAS_PROFILE', platformConfidence('telegram')),
    edge('tbb:5', 'tbb:p', 'tbb:em', 'HAS_EMAIL', 0.7),
    edge('tbb:6', 'tbb:p', 'tbb:ph', 'HAS_PHONE', 0.6),
    edge('tbb:7', 'tbb:p', 'tbb:geo', 'LOCATED_AT', 0.5),
    edge('tbb:8', 'tbb:li', 'tbb:tw', 'один ник', 0.65),
    edge('tbb:9', 'tbb:tw', 'tbb:tg', 'один ник', 0.65),
    edge('tbb:10', 'tbb:tg', 'tbb:gh', 'один ник', 0.65),
    edge('tbb:11', 'tbb:gh', 'tbb:li', 'один ник', 0.65),
    edge('tbb:12', 'tbb:li', 'tbb:em', 'email на странице', 0.5),
    edge('tbb:13', 'tbb:gh', 'tbb:em', 'email в bio', 0.4),
    edge('tbb:14', 'tbb:em', 'tbb:ph', 'тот же человек', 0.5),
  ]
  return { nds, rls }
}