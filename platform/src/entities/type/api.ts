// entities/type — каталог типов сущностей (палитра добавления узлов).
import { http } from '@/shared/api'
import type { TypeCategory } from '@/shared/api/types'

export const typeApi = {
  categories(): Promise<TypeCategory[]> {
    return http('/types')
  },
}