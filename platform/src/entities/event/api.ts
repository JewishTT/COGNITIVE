// entities/event — журнал событий sketch'а: история + живой SSE-стрим.
import { getAuthToken, http } from '@/shared/api'
import type { EventLogEntry, SseMessage } from '@/shared/api/types'

export const eventApi = {
  logs(sketchId: string, limit = 100): Promise<EventLogEntry[]> {
    return http(`/events/logs?sketch_id=${sketchId}&limit=${limit}`)
  },

  /**
   * Подписка на живой поток событий.
   * onEvent({event:'log'|'enricher_complete'|'connected', data}) — вызывается для
   * каждого кадра SSE. Возвращает функцию отписки.
   */
  async stream(
    sketchId: string,
    onEvent: (m: SseMessage) => void,
    onClose?: () => void,
  ): Promise<() => void> {
    const token = await getAuthToken()
    const ctrl = new AbortController()
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/flowsint-api/api/events`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        })
        if (!res.body) throw new Error('нет SSE-стрима')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        try {
          while (!cancelled) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const frames = buf.split('\n\n')
            buf = frames.pop() || ''
            for (const frame of frames) {
              const dataLine = frame.split('\n').find((l) => l.startsWith('data:'))
              if (!dataLine) continue
              const payload = JSON.parse(dataLine.slice(5).trim())
              if (payload && (payload.event as string)) {
                onEvent({ event: payload.event, data: payload.data })
              }
            }
          }
        } finally {
          reader.cancel().catch(() => undefined)
        }
      } catch (e) {
        if (!cancelled) onClose?.()
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  },
}