// shared/api/types — доменные DTO движка Flowsint (формат REST 1:1).

export interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export interface Investigation {
  id: string
  name: string
  description: string
  status: string
  created_at: string
  last_updated_at: string
  current_user_role?: string | null
  sketches?: Sketch[]
}

export interface Sketch {
  id: string
  title: string
  description: string
  status: string
  investigation_id: string
  created_at: string
  last_updated_at: string
}

export interface GraphNode {
  id: string
  nodeLabel: string
  nodeType: string
  nodeColor: string | null
  nodeIcon: string | null
  nodeImage: string | null
  nodeFlag: string | null
  nodeShape: string | null
  nodeSize: number | null
  x: number
  y: number
  nodeProperties: Record<string, unknown>
  nodeMetadata: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  date?: string | null
  caption?: string | null
  type?: string | null
  weight?: number | null
  confidence_level?: number | string | null
}

export interface GraphData {
  nds: GraphNode[]
  rls: GraphEdge[]
}

export interface GraphUploadNode {
  id: string
  nodeLabel: string
  nodeType: string
  nodeColor?: string | null
  nodeSize?: number | null
  x?: number
  y?: number
  nodeProperties: Record<string, unknown>
  nodeMetadata: Record<string, unknown>
}

/** Элемент каталога энричеров (flowsint_enrichers registry.list). */
export interface Enricher {
  class_name: string
  name: string
  module: string
  description: string | null
  documentation: string
  category: string
  inputs: { type: string; properties?: Record<string, unknown> }
  outputs: unknown
  params: Record<string, unknown>
  params_schema: Record<string, unknown> | null
  required_params: string[] | null
  icon: string | null
  wobblyType: boolean
}

export interface LaunchResult {
  id: string
}

export interface TypeField {
  name: string
  label: string
  type: string
  required: boolean
}

export interface NodeType {
  id: string
  type: string
  key: string
  icon: string
  label: string
  label_key?: string
  description?: string
  fields: TypeField[]
  children?: NodeType[]
}

export interface TypeCategory {
  id: string
  type: string
  key: string
  icon: string
  label: string
  fields: TypeField[]
  children: NodeType[]
}

/** Запись лога события sketch'а (журнал + живой SSE). */
export interface EventLogEntry {
  id?: string
  sketch_id?: string | null
  type: string
  payload: Record<string, unknown>
  message?: string
  enricher_name?: string
  created_at?: string
  timestamp?: string
}

/** Живое событие SSE: { event, data } внутри data-строки стрима. */
export interface SseMessage {
  event: 'connected' | 'log' | 'enricher_complete' | 'status'
  data: unknown
}