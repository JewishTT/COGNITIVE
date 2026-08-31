// entities/graph/lib/vueflow — адаптация GraphNode/GraphEdge в канвас VueFlow.
import type { Node, Edge } from '@vue-flow/core'
import type { GraphData, GraphEdge, GraphNode } from '@/shared/api/types'

export function toFlowNode(g: GraphNode, highlightIds: string[] = []): Node {
  return {
    id: g.id,
    position: { x: g.x ?? 100, y: g.y ?? 100 },
    type: 'osnode',
    data: {
      label: g.nodeLabel,
      color: g.nodeColor || '#22d3ee',
      nodeType: g.nodeType,
      highlighted: highlightIds.includes(g.id),
    },
  }
}

export function toFlowEdge(r: GraphEdge): Edge {
  return {
    id: r.id,
    source: r.source,
    target: r.target,
    label: r.label,
    animated: true,
    style: { stroke: '#22d3ee' },
    labelStyle: { fill: '#9ca3af' },
  }
}

export function graphToFlow(g: GraphData, highlightIds: string[] = []): { nds: Node[]; rls: Edge[] } {
  return {
    nds: (g.nds || []).map((n) => toFlowNode(n, highlightIds)),
    rls: (g.rls || []).map(toFlowEdge),
  }
}