// entities/pipeline — HTTP-клиент пайплайна 0-слоя (сбор данных).
//
// Пайплайн — отдельный сервис, проксируемый платформой как `/pipeline`
// (см. platform/vite.platform.config.js). Он сам авторизуется в движке
// Flowsint и пишет собранный граф в Neo4j.

const BASE = '/pipeline'

export interface PipelineTool {
  name: string
  label: string
  kind: 'collection' | 'extraction'
  group: string
  description: string
  available: boolean
}

export interface PipelineStatus {
  tools: PipelineTool[]
  groups: { collection: PipelineTool[]; extraction: PipelineTool[] }
  engine: boolean
  python: { venv: boolean }
  searxng: boolean
}

export interface PipelineRunStage {
  name: string
  label: string
  count?: number
  sketchId?: string
  nodes?: number
  edges?: number
  emails?: number
  phones?: number
  persons?: number
  nlpAvailable?: boolean
  skipped?: boolean
  sources?: number
  byTool?: Record<string, { available: boolean; count: number }>
}

export interface PipelineRunSummary {
  collectedTotal: number
  nodes: number
  edges: number
  sketchId: string | null
}

export interface PipelineRun {
  id: string
  target: string
  type: string
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  createdAt: number | null
  startedAt: number | null
  finishedAt: number | null
  error: string | null
  stages: PipelineRunStage[]
  summary: PipelineRunSummary | null
  enginesOnline: boolean | null
}

export interface PipelineEvent {
  ts: number
  level: string
  tool: string
  text: string
}

export const pipelineApi = {
  status(): Promise<PipelineStatus> {
    return fetchJson(`${BASE}/status`)
  },
  tools(): Promise<PipelineTool[]> {
    return fetchJson(`${BASE}/tools`)
  },
  install(name: string): Promise<{ ok: boolean; msg: string }> {
    return fetchJson(`${BASE}/install/${name}`, { method: 'POST' })
  },
  launch(target: string, type: string, sync = false): Promise<{ id: string; status: string }> {
    return fetchJson(`${BASE}/launch`, {
      method: 'POST',
      body: JSON.stringify({ target, type, sync }),
    })
  },
  runs(): Promise<PipelineRun[]> {
    return fetchJson(`${BASE}/runs`)
  },
  run(id: string): Promise<PipelineRun> {
    return fetchJson(`${BASE}/runs/${id}`)
  },
  cancel(id: string): Promise<{ ok: boolean }> {
    return fetchJson(`${BASE}/runs/${id}/cancel`, { method: 'POST' })
  },
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && (data.error || data.detail)) || `Пайплайн ${res.status}`)
  }
  return data as T
}
