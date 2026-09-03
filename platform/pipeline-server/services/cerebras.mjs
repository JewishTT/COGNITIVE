// services/cerebras.mjs — LLM service via Python (subprocess).
//
// Provider chain: OpenCode Zen (big-pickle) → Pollinations (free).
// Uses llm_helper.py for all provider communication.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PYTHON = path.join(config.venvDir, 'Scripts', 'python.exe')
const HELPER = path.join(__dirname, '..', 'llm_helper.py')

let _llmLock = Promise.resolve()
function withLlmLock(fn) {
  const prev = _llmLock
  let release
  _llmLock = new Promise(r => { release = r })
  return prev.then(() => fn()).finally(release)
}

function getProvider() {
  // OpenCode Zen (big-pickle) - OpenAI-compatible, works from RU.
  return { name: 'opencode', model: config.opencode.model || 'big-pickle' }
}

function buildArgs(cmd, messages, opts = {}) {
  const provider = getProvider()
  const model = opts.model || provider.model
  const args = [
    HELPER, cmd,
    '--messages', JSON.stringify(messages),
    '--temp', String(opts.temperature ?? 0.7),
    '--max-tokens', String(opts.maxTokens ?? 4096),
  ]
  return { args, model, providerName: provider.name }
}

/**
 * Non-streaming chat completion.
 */
export async function chatCompletion(messages, opts = {}) {
  return withLlmLock(() => chatCompletionUnlocked(messages, opts))
}

async function chatCompletionUnlocked(messages, opts = {}) {
  const { args, model, providerName } = buildArgs('chat', messages, opts)

  return new Promise((resolve, reject) => {
    console.log('[llm] spawning:', PYTHON, HELPER, 'messages:', messages.length)
    const proc = spawn(PYTHON, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => { proc.kill(); reject(new Error('LLM timeout')) }, opts.timeout || 150000)

    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      clearTimeout(timeout)
      console.log('[llm] exit code:', code, 'stdout:', stdout.slice(0, 200), 'stderr:', stderr.slice(0, 200))
      if (code !== 0) {
        console.error(`[cerebras] exit ${code}: stderr=${stderr.slice(0, 500)}`)
        return reject(new Error(`llm_helper exit ${code}: ${stderr.slice(0, 300)}`))
      }
      try {
        const data = JSON.parse(stdout.trim())
        resolve({ content: data.content, usage: data.usage, model: data.model || model, provider: data.provider || providerName })
      } catch {
        console.error(`[cerebras] parse error: stdout=${stdout.slice(0, 500)}`)
        reject(new Error(`llm_helper parse error: ${stdout.slice(0, 300)}`))
      }
    })
    proc.on('error', e => { clearTimeout(timeout); console.error('[cerebras] spawn error:', e.message); reject(e) })
  })
}

/**
 * Streaming chat completion.
 */
export async function chatCompletionStream(messages, onChunk, opts = {}) {
  return withLlmLock(() => chatCompletionStreamUnlocked(messages, onChunk, opts))
}

async function chatCompletionStreamUnlocked(messages, onChunk, opts = {}) {
  const { args, model, providerName } = buildArgs('stream', messages, opts)

  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let fullText = ''
    let buffer = ''
    let stderr = ''
    let provider = providerName
    const timeout = setTimeout(() => { proc.kill(); reject(new Error('LLM timeout')) }, opts.timeout || 120000)

    proc.stdout.on('data', d => {
      buffer += d.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const obj = JSON.parse(trimmed)
          if (obj.delta) {
            fullText = obj.fullText
            onChunk(obj.delta, fullText)
          } else if (obj.done) {
            fullText = obj.fullText
            if (obj.provider) provider = obj.provider
          }
        } catch {}
      }
    })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      clearTimeout(timeout)
      if (code !== 0) {
        console.error(`[cerebras/stream] exit ${code}: stderr=${stderr.slice(0, 500)}`)
        return reject(new Error(`llm_helper exit ${code}: ${stderr.slice(0, 300)}`))
      }
      resolve({ fullText, model, provider })
    })
    proc.on('error', e => { clearTimeout(timeout); console.error('[cerebras/stream] spawn error:', e.message); reject(e) })
  })
}

/**
 * Build system prompt for GHOST-7 AI agent.
 */
export function buildSystemPrompt() {
  return `You are GHOST-7, an AI project manager and OSINT specialist embedded in the COGNITIVE platform.

## Capabilities
- **Neo4j Graph Database** — query, create, update, delete nodes and relationships
- **OSINT Pipeline** — collect intelligence on targets (domains, emails, usernames, IPs, phones)
- **Available tools**: theHarvester, Sherlock, Maigret, snscrape, TGSpyder, Playwright Stealth crawler, SearXNG, spaCy NER, ExifTool, Regex extraction
- **System management** — view pipeline status, tool availability, run scans

## Response Format
- Markdown: **bold**, \`code\`, lists, blockquotes, code blocks
- Be concise and direct — terminal aesthetic
- Neo4j queries use Cypher syntax
- Always specify target type (domain/email/username/IP/phone)

## Task Execution
1. Parse intent (action, target, parameters)
2. Create structured plan
3. Execute step by step
4. Report results with evidence

Always respond in the same language the operator uses.`
}
