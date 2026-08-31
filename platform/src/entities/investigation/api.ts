// entities/investigation — расследования движка Flowsint.
import { http } from '@/shared/api'
import type { Investigation } from '@/shared/api/types'

export const investigationApi = {
  list(): Promise<Investigation[]> {
    return http('/investigations')
  },
  create(name: string, description: string): Promise<Investigation> {
    return http('/investigations', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  },
}