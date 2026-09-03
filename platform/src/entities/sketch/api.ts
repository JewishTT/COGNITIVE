// entities/sketch — граф связей внутри расследования (sketch).
import { http } from '@/shared/api'
import type { Sketch } from '@/shared/api/types'

export const sketchApi = {
  create(title: string, description: string, investigationId?: string): Promise<Sketch> {
    return http('/sketches', {
      method: 'POST',
      body: JSON.stringify({ title, description, investigation_id: investigationId }),
    })
  },
  list(): Promise<{ sketches: Sketch[] }> {
    return http('/sketches')
  },
  get(sketchId: string): Promise<Sketch> {
    return http(`/sketches/${sketchId}`)
  },
  update(sketchId: string, data: Partial<Pick<Sketch, 'title' | 'description'>>): Promise<Sketch> {
    return http(`/sketches/${sketchId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  remove(sketchId: string): Promise<void> {
    return http(`/sketches/${sketchId}`, { method: 'DELETE' })
  },
}