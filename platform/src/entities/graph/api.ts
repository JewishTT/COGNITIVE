// entities/graph — операции с графом sketch'а (узлы, связи, позиции).
import { http } from '@/shared/api'
import type { GraphData, GraphEdge, GraphNode, GraphUploadNode } from '@/shared/api/types'

export const graphApi = {
  get(sketchId: string): Promise<GraphData> {
    return http(`/sketches/${sketchId}/graph`)
  },
  addNode(sketchId: string, body: GraphUploadNode): Promise<{ node: GraphNode }> {
    return http(`/sketches/${sketchId}/nodes/add`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  addEdge(sketchId: string, source: string, target: string, label: string): Promise<GraphEdge> {
    return http(`/sketches/${sketchId}/relations/add`, {
      method: 'POST',
      body: JSON.stringify({ source, target, type: 'one-way', label }),
    })
  },
  deleteNodes(sketchId: string, nodeIds: string[]): Promise<void> {
    return http(`/sketches/${sketchId}/nodes`, {
      method: 'DELETE',
      body: JSON.stringify({ nodeIds }),
    })
  },
  deleteEdges(sketchId: string, relationshipIds: string[]): Promise<void> {
    return http(`/sketches/${sketchId}/relationships`, {
      method: 'DELETE',
      body: JSON.stringify({ relationshipIds }),
    })
  },
  updatePositions(
    sketchId: string,
    positions: Array<{ nodeId: string; x: number; y: number }>,
  ): Promise<unknown> {
    return http(`/sketches/${sketchId}/nodes/positions`, {
      method: 'PUT',
      body: JSON.stringify({ positions }),
    })
  },
}