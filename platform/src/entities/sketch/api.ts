// entities/sketch — граф связей внутри расследования (sketch).
import { http } from '@/shared/api'
import type { Sketch } from '@/shared/api/types'

export const sketchApi = {
  create(title: string, description: string, investigationId: string): Promise<Sketch> {
    return http('/sketches/create', {
      method: 'POST',
      body: JSON.stringify({ title, description, investigation_id: investigationId }),
    })
  },
  remove(sketchId: string): Promise<void> {
    return http(`/sketches/${sketchId}`, { method: 'DELETE' })
  },
}