// features/node-create — построение GraphUploadNode по выбранному типу движка
// (поля из TypeField + отображаемое имя) и вставка в граф.
import { graphApi } from '@/entities/graph/api'
import type { GraphNode, GraphUploadNode, NodeType } from '@/shared/api/types'

export interface NodeFormValue {
  nodeLabel: string
  props: Record<string, unknown>
}

/** Собирает тело узла по типу движка (палитра типов / поля формы). */
export function buildNodeBody(type: NodeType, form: NodeFormValue, color = '#22d3ee'): GraphUploadNode {
  const nodeProperties: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(form.props)) {
    if (v !== '' && v != null) nodeProperties[k] = v
  }
  nodeProperties.nodeLabel = form.nodeLabel
  return {
    id: '',
    nodeLabel: form.nodeLabel,
    nodeType: type.type.toLowerCase(),
    nodeColor: color,
    nodeSize: 10,
    x: 120 + Math.random() * 300,
    y: 120 + Math.random() * 200,
    nodeProperties,
    nodeMetadata: { created_at: new Date().toISOString() },
  }
}

/** Вставка узла в граф sketch'а; возвращает сохранённый узел. */
export async function addNodeToSketch(sketchId: string, body: GraphUploadNode): Promise<GraphNode> {
  const res = await graphApi.addNode(sketchId, body)
  return res.node
}