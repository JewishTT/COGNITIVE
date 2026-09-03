// entities/enricher — каталог и запуск энричеров движка (TheBigBrother и все остальные).
import { http } from '@/shared/api'
import type { Enricher, LaunchResult } from '@/shared/api/types'

export const enricherApi = {
  list(category?: string): Promise<{ enrichers: Enricher[] }> {
    const q = category && category.toLowerCase() !== 'undefined' ? `?category=${encodeURIComponent(category)}` : ''
    return http(`/enrichers${q}`)
  },
  run(enricherName: string, investigationId: string, nodeIds: string[], config?: Record<string, unknown>): Promise<LaunchResult> {
    return http(`/enrichers/${enricherName}/run`, {
      method: 'POST',
      body: JSON.stringify({ investigation_id: investigationId, node_ids: nodeIds, config }),
    })
  },
  getRunStatus(runId: string): Promise<LaunchResult> {
    return http(`/enrichers/runs/${runId}`)
  },
}