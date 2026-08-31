// entities/enricher — каталог и запуск энричеров движка (TheBigBrother и все остальные).
import { http } from '@/shared/api'
import type { Enricher, LaunchResult } from '@/shared/api/types'

export const enricherApi = {
  list(category?: string): Promise<Enricher[]> {
    const q = category && category.toLowerCase() !== 'undefined' ? `?category=${encodeURIComponent(category)}` : ''
    return http(`/enrichers${q}`)
  },
  launch(enricherName: string, nodeIds: string[], sketchId: string): Promise<LaunchResult> {
    return http(`/enrichers/${enricherName}/launch`, {
      method: 'POST',
      body: JSON.stringify({ node_ids: nodeIds, sketch_id: sketchId }),
    })
  },
}