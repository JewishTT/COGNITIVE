// entities/investigation — расследования движка Flowsint.
import { http } from '@/shared/api'
import type { Investigation } from '@/shared/api/types'

export const investigationApi = {
  list(): Promise<Investigation[]> {
    return http('/investigations')
  },
  create(name: string, sketchId?: string): Promise<Investigation> {
    return http('/investigations', {
      method: 'POST',
      body: JSON.stringify({ name, sketch_id: sketchId }),
    })
  },
  get(investigationId: string): Promise<Investigation> {
    return http(`/investigations/${investigationId}`)
  },
}