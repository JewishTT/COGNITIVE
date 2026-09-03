/**
 * aiMock.ts — Real AI backend integration for GHOST-7 chat.
 *
 * Replaces the placeholder mock with actual Cerebras GPT-OSS-120B calls
 * via the pipeline-server backend. Handles streaming, tool awareness,
 * and intent parsing for OSINT pipeline commands.
 */
import { chat } from './chatStore'
import type { ChatMessage, ProjectTask } from './types'
import { newId, makeTask } from './useChat'

const API_BASE = '/flowsint-api/api/v1'

/** Parsed user intent for dispatching actions. */
export interface ParsedIntent {
  action: 'scan' | 'status' | 'query' | 'help' | 'chat'
  target?: string
  targetType?: 'domain' | 'email' | 'username' | 'ip' | 'phone'
  params?: Record<string, string>
}

/**
 * Parse user text into an intent (simple regex + keyword approach).
 */
export function parseIntent(text: string): ParsedIntent {
  const lower = text.toLowerCase().trim()

  // Scan commands
  const scanMatch = lower.match(/(?:скан|scan|сбор|собери|проанализируй|check)\s+(.+)/i)
  if (scanMatch) {
    const target = scanMatch[1].trim()
    const targetType = detectTargetType(target)
    return { action: 'scan', target, targetType }
  }

  // Status commands
  if (/^(?:статус|status|состояние|tools|инструменты)/i.test(lower)) {
    return { action: 'status' }
  }

  // Neo4j queries
  const queryMatch = lower.match(/(?:запрос|query|найди|найти|покажи|show)\s+(.+)/i)
  if (queryMatch) {
    return { action: 'query', target: queryMatch[1].trim() }
  }

  // Help
  if (/^(?:помощь|help|что умеешь|команды|commands)/i.test(lower)) {
    return { action: 'help' }
  }

  return { action: 'chat' }
}

function detectTargetType(target: string): 'domain' | 'email' | 'username' | 'ip' | 'phone' {
  if (/@/.test(target)) return 'email'
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(target)) return 'ip'
  if (/^\+?\d[\d\s\-()]{6,}$/.test(target)) return 'phone'
  if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/.test(target)) return 'domain'
  return 'username'
}

/**
 * Send a message to the real AI backend and stream the response.
 */
export async function handleMessage(text: string): Promise<void> {
  const intent = parseIntent(text)
  chat.setPosture('thinking')

  try {
    // Handle local intents that don't need LLM
    if (intent.action === 'status') {
      await handleStatusCommand()
      return
    }
    if (intent.action === 'help') {
      handleHelpCommand()
      return
    }

    // For scan commands, create a task first
    if (intent.action === 'scan' && intent.target) {
      const task = makeTask({
        title: `OSINT Scan: ${intent.target}`,
        description: `Сбор разведывательных данных по цели ${intent.target} (${intent.targetType})`,
        kind: 'osint',
        steps: [
          { id: 'collect', label: 'Сбор данных' },
          { id: 'extract', label: 'Извлечение сущностей' },
          { id: 'store', label: 'Запись в граф' },
        ],
      })
      chat.addTask(task)
      chat.updateTask(task.id, { status: 'running', stepId: 'collect', stepStatus: 'running' })

      // Launch scan via backend
      const scanResult = await fetchJSON(`${API_BASE}/pipeline/scan`, {
        method: 'POST',
        body: JSON.stringify({ target: intent.target, type: intent.targetType }),
      })

      if (scanResult.scanId) {
        chat.updateTask(task.id, {
          stepId: 'collect', stepStatus: 'completed',
          stepResult: `Scan started: ${scanResult.scanId}`,
        })

        // Poll for completion
        pollScanStatus(scanResult.scanId, task.id)
      }
    }

    // Send to AI for response
    await streamAIResponse(text)
  } catch (err: any) {
    chat.setPosture('online')
    chat.receiveAssistant(`Ошибка: ${err.message || 'Не удалось выполнить команду'}`)
  }
}

async function streamAIResponse(text: string): Promise<void> {
  chat.setPosture('thinking')

  const msg = chat.sendMessage('assistant', '')
  chat.setDelivered(msg.id)

  try {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, stream: true }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response stream')

    const decoder = new TextDecoder()
    let fullText = ''
    let sseBuffer = ''

    // SSE frames are newline-delimited; a TCP chunk can split a frame in half,
    // so we keep a line buffer instead of parsing each read() independently.
    const consume = (line: string): void => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) return
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const event = JSON.parse(payload)
        if (event.type === 'chunk' && event.content) {
          fullText = event.fullText || fullText + event.content
          msg.content = fullText
        } else if (event.type === 'done') {
          msg.content = event.content || fullText
        } else if (event.type === 'error') {
          msg.content = `Ошибка ИИ: ${event.error}`
        }
      } catch {}
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      sseBuffer += decoder.decode(value, { stream: true })
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() || ''
      for (const line of lines) consume(line)
    }
    // flush any trailing frame left in the buffer
    if (sseBuffer) consume(sseBuffer)

    msg.content = msg.content || fullText || '(пустой ответ)'
  } catch (err: any) {
    msg.content = `Ошибка подключения к ИИ: ${err.message}`
  } finally {
    chat.setPosture('online')
  }
}

async function handleStatusCommand(): Promise<void> {
  chat.setPosture('working')
  try {
    const data = await fetchJSON(`${API_BASE}/pipeline/status`)
    const tools = data.tools || []
    const available = tools.filter((t: any) => t.available)
    const unavailable = tools.filter((t: any) => !t.available)

    let response = `**Статус пайплайна**\n\n`
    response += `Доступно: **${available.length}/${tools.length}** инструментов\n\n`
    response += `✅ ${available.map((t: any) => t.label).join(', ') || 'нет'}\n`
    if (unavailable.length) {
      response += `❌ ${unavailable.map((t: any) => t.label).join(', ')}\n`
    }
    response += `\nАктивные запуски: ${data.activeRuns || 0}`
    response += `\nUptime: ${Math.round(data.uptime || 0)}s`

    chat.receiveAssistant(response)
  } catch (err: any) {
    chat.receiveAssistant(`Ошибка получения статуса: ${err.message}`)
  }
  chat.setPosture('online')
}

function handleHelpCommand(): void {
  chat.receiveAssistant(
    `**Команды GHOST-7:**\n\n` +
    `- \`скан <цель>\` — запустить OSINT-сбор по домену/email/нику/IP\n` +
    `- \`статус\` — показать доступные инструменты и запуски\n` +
    `- \`помощь\` — это сообщение\n\n` +
    `**Также доступно:**\n` +
    `- Запросы к Neo4j графу\n` +
    `- Управление инструментами\n` +
    `- Любой вопрос — ИИ ответит с учётом контекста проекта`
  )
}

async function pollScanStatus(scanId: string, taskId: string): Promise<void> {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      // Server wraps the run object: { run: { id, status, extracted, ... } }
      const data = await fetchJSON(`${API_BASE}/pipeline/runs/${scanId}`)
      const run = data?.run ?? data ?? {}
      if (run.status === 'completed') {
        const r = run.extracted || {}
        chat.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          result: `Готово: ${r.emails || 0} emails, ${r.phones || 0} phones, ${r.ips || 0} IP, ${r.persons || 0} персон`,
          stepId: 'store', stepStatus: 'completed',
        })
        return
      }
      if (run.status === 'failed' || run.status === 'cancelled') {
        chat.updateTask(taskId, { status: 'failed', error: run.error || `Scan ${run.status}` })
        return
      }
      // Update progress
      const elapsed = Date.now() - (run.startedAt || Date.now())
      chat.updateTask(taskId, { progress: Math.min(90, Math.round(elapsed / 300)) })
    } catch {}
  }
  chat.updateTask(taskId, { status: 'failed', error: 'Timeout waiting for scan' })
}

async function fetchJSON(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
