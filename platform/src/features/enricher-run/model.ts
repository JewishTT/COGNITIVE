// features/enricher-run — оркестрация запуска энричера: узел -> диспетч celery ->
// ожидание enricher_complete по SSE -> (пере)чтение графа.
import { enricherApi } from '@/entities/enricher/api'
import { graphApi } from '@/entities/graph/api'
import { eventApi } from '@/entities/event/api'
import type { GraphData, GraphUploadNode } from '@/shared/api/types'

export interface RunOptions {
  timeoutMs?: number
  onEvent?: (type: string, data: unknown) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Ждёт события enricher_complete в живом SSE-стриме sketch'а.
 * Если стрим молчит дольше timeoutMs — падает с понятной ошибкой.
 */
export async function waitForEnricher(sketchId: string, timeoutMs = 300_000, onEvent?: RunOptions['onEvent']): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise<void>((resolve, reject) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        unsubscribe()
        reject(new Error('Время ожидания энричера истекло'))
      }
    }, timeoutMs)

    const unsubscribe = eventApi.stream(
      sketchId,
      (m) => {
        if (done) return
        onEvent?.(m.event, m.data)
        if (m.event === 'enricher_complete') {
          done = true
          clearTimeout(timer)
          unsubscribe()
          resolve()
        }
      },
      () => {
        if (done || Date.now() >= deadline) return
        // Стрим разорвался, но без enricher_complete — пробуем снова через мгновение.
        sleep(1200)
          .then(() => waitForEnricher(sketchId, Math.max(0, deadline - Date.now()), onEvent))
          .then(resolve, reject)
      },
    )
  })
}

/** Универсальный запуск: выбранные node_ids -> энричер -> ожидание -> обновлённый граф. */
export async function runEnricher(
  enricherName: string,
  nodeIds: string[],
  sketchId: string,
  options: RunOptions = {},
): Promise<GraphData> {
  if (!nodeIds.length) throw new Error('Выберите хотя бы один узел в графе')
  await enricherApi.run(enricherName, sketchId, nodeIds)
  await waitForEnricher(sketchId, options.timeoutMs, options.onEvent)
  return graphApi.get(sketchId)
}

const USERNAME_REGEX = /^user(name)?$/i

function makeUsernameNode(target: string): GraphUploadNode {
  return {
    id: '',
    nodeLabel: target,
    nodeType: 'username',
    nodeColor: '#22d3ee',
    nodeSize: 12,
    x: 100 + Math.random() * 300,
    y: 120 + Math.random() * 200,
    nodeProperties: { value: target, platform: null, last_seen: null },
    nodeMetadata: { created_at: new Date().toISOString() },
  }
}

/** TheBigBrother: гарантируем Узел Username в sketch'е и гоним энричер по нему. */
export async function runTheBigBrother(target: string, sketchId: string, options: RunOptions = {}): Promise<GraphData> {
  const name = (target || '').trim()
  if (!name) throw new Error('Укажите ник или email')

  const graph = await graphApi.get(sketchId)
  let nodeId = graph.nds.find((n) => n.nodeLabel === name && USERNAME_REGEX.test(n.nodeType))?.id || null
  if (!nodeId) {
    const added = await graphApi.addNode(sketchId, makeUsernameNode(name))
    nodeId = added.node.id
  }
  if (!nodeId) throw new Error('Не удалось создать узел Username')

  return runEnricher('username_to_socials_thebigbrother', [nodeId], sketchId, options)
}