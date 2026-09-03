// routes/chat.mjs — AI chat endpoints backed by Cerebras GPT-OSS-120B.
//
// POST /api/v1/chat/send       — send message, get streaming response
// GET  /api/v1/chat/history     — conversation history
// DELETE /api/v1/chat/history   — clear history
// GET  /api/v1/chat/tools       — list available tools

import { chatCompletionStream, chatCompletion, buildSystemPrompt } from '../services/cerebras.mjs'

const conversations = new Map()
const MAX_HISTORY = 50

function getHistory(sid = 'default') {
  if (!conversations.has(sid)) conversations.set(sid, [])
  return conversations.get(sid)
}
function trimHistory(sid) {
  const h = getHistory(sid)
  while (h.length > MAX_HISTORY) h.shift()
}

export function createChatRoutes() {
  return async function handleChat(req, res, url, method, body) {
    const p = url.pathname

    // POST /chat/send
    if (method === 'POST' && p === '/chat/send') {
      const { message, sessionId = 'default', stream = true } = body || {}
      if (!message) { j(res, 400, { error: 'message required' }); return true }

      const history = getHistory(sessionId)
      history.push({ role: 'user', content: message })

      const systemPrompt = buildSystemPrompt()
      const llmMessages = [{ role: 'system', content: systemPrompt }, ...history.slice(-20)]

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        })

        let fullText = ''
        try {
          await chatCompletionStream(llmMessages, (chunk, full) => {
            fullText = full
            try { res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk, fullText })}\n\n`) } catch {}
          })
          history.push({ role: 'assistant', content: fullText })
          trimHistory(sessionId)
        } catch (err) {
          console.error('[chat/stream] LLM error:', err.message)
          const fallback = genFallback(message)
          fullText = fallback
          history.push({ role: 'assistant', content: fallback })
          trimHistory(sessionId)
        }
        try {
          res.write(`data: ${JSON.stringify({ type: 'done', content: fullText })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
        } catch {}
        return true
      }

      // Non-streaming
      try {
        const result = await chatCompletion(llmMessages)
        history.push({ role: 'assistant', content: result.content })
        trimHistory(sessionId)
        j(res, 200, { content: result.content, usage: result.usage, model: result.model })
      } catch (err) {
        console.error('[chat/send] LLM error:', err.message, err.stack?.split('\n').slice(0, 3).join(' | '))
        const fallback = genFallback(message)
        history.push({ role: 'assistant', content: fallback })
        trimHistory(sessionId)
        j(res, 200, { content: fallback, model: 'local-fallback' })
      }
      return true
    }

    // GET /chat/history
    if (method === 'GET' && p === '/chat/history') {
      const sid = url.searchParams.get('sessionId') || 'default'
      j(res, 200, { messages: getHistory(sid) })
      return true
    }

    // DELETE /chat/history
    if (method === 'DELETE' && p === '/chat/history') {
      const sid = url.searchParams.get('sessionId') || 'default'
      conversations.set(sid, [])
      j(res, 200, { ok: true })
      return true
    }

    // GET /chat/tools
    if (method === 'GET' && p === '/chat/tools') {
      const { allToolStatus } = await import('../tools.mjs')
      j(res, 200, { tools: allToolStatus() })
      return true
    }

    return false
  }
}

function j(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function genFallback(message) {
  const lower = message.toLowerCase().trim()
  if (/^(?:помощь|help|команды|commands)/i.test(lower)) {
    return `**Команды GHOST-7:**\n\n- \`скан <цель>\` — OSINT-сбор\n- \`статус\` — инструменты\n- \`помощь\` — это сообщение`
  }
  if (/^(?:статус|status)/i.test(lower)) {
    return `**Статус** — ИИ-модель недоступна. Используйте \`/api/v1/pipeline/status\``
  }
  return `**GHOST-7** — ИИ недоступен. Попробуйте позже.\n\nКоманды: \`помощь\`, \`статус\`, \`скан <цель>\``
}
