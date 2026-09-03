/**
 * formatContent.ts — a rich markdown-ish renderer for chat messages.
 *
 * Supported subset (sufficient for the AI agent's replies):
 *
 *   **bold**                → <strong>
 *   *italic*                → <em>
 *   `inline code`           → <code>
 *   ```code blocks```       → <pre><code>
 *   "text"                  → <q>
 *   leading "- " lines      → <li> inside <ul>
 *   leading "1. " lines     → <li> inside <ol>
 *   leading "## " headers   → <h3>
 *   leading "### " headers  → <h4>
 *   blank-line-separated    → <p>
 *   ✅ ❌ ⚠️ emojis         → colored spans
 *
 * Output is real VNodes (no innerHTML), so it's XSS-safe by construction.
 */
import { h, type VNode } from 'vue'

function renderInline(text: string): VNode[] {
  const nodes: VNode[] = []
  // Split keeping delimiters: bold, italic, code, quotes, links
  const parts = text.split(/(\*\*.*?\*\*|\*[^*]+\*|`[^`]*`|"[^"]*"|https?:\/\/\S+)/g).filter(Boolean)
  let k = 0
  for (const part of parts) {
    if (/^\*\*(.*)\*\*$/.test(part)) {
      nodes.push(h('strong', { key: k++ }, part.slice(2, -2)))
    } else if (/^\*([^*]+)\*$/.test(part)) {
      nodes.push(h('em', { key: k++ }, part.slice(1, -1)))
    } else if (/^`([^`]*)`$/.test(part)) {
      nodes.push(h('code', { class: 'gev-inline-code', key: k++ }, part.slice(1, -1)))
    } else if (/^"([^"]*)"$/.test(part)) {
      nodes.push(h('q', { key: k++ }, part.slice(1, -1)))
    } else if (/^https?:\/\/\S+$/.test(part)) {
      nodes.push(h('a', { key: k++, href: part, target: '_blank', rel: 'noopener', class: 'gev-link' }, part))
    } else {
      nodes.push(part as VNode)
    }
  }
  return nodes
}

/** Render a single block (non-list) line into VNodes. */
function renderBlock(line: string): VNode {
  return h('span', { class: 'gev-line' }, renderInline(line))
}

/** Render a code block (multi-line). */
function renderCodeBlock(lines: string[], lang: string): VNode {
  const codeContent = lines.join('\n')
  return h('pre', { class: 'gev-code-block' }, [
    lang ? h('span', { class: 'gev-code-lang' }, lang) : null,
    h('code', {}, codeContent),
  ])
}

export function renderContent(content: string): VNode[] {
  if (!content) return []
  const out: VNode[] = []
  const lines = content.split(/\r?\n/)
  let listBuf: string[] = []
  let listType: 'ul' | 'ol' = 'ul'
  let codeBuf: string[] = []
  let codeLang = ''
  let inCode = false
  let k = 0

  const flushList = () => {
    if (!listBuf.length) return
    const tag = listType === 'ol' ? 'ol' : 'ul'
    out.push(
      h(tag, { class: 'gev-list', key: `${tag}-${k++}` },
        listBuf.map(l => h('li', renderInline(l)))
      )
    )
    listBuf = []
  }

  const flushCode = () => {
    if (!codeBuf.length) return
    out.push(renderCodeBlock(codeBuf, codeLang))
    codeBuf = []
    codeLang = ''
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]

    // Code block toggle
    if (raw.trimStart().startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        flushList()
        codeLang = raw.trimStart().slice(3).trim()
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeBuf.push(raw)
      continue
    }

    const isBlank = raw.trim() === ''
    const isUlItem = /^\s*[-*]\s+.+/.test(raw)
    const isOlItem = /^\s*\d+\.\s+.+/.test(raw)
    const isHeader = /^#{1,4}\s+/.test(raw)

    if (isUlItem || isOlItem) {
      const newItemType = isOlItem ? 'ol' : 'ul'
      if (listType !== newItemType && listBuf.length) flushList()
      listType = newItemType
      const itemText = raw.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '')
      listBuf.push(itemText)
    } else if (isBlank) {
      flushList()
    } else if (isHeader) {
      flushList()
      const level = raw.match(/^(#{1,4})/)?.[1]?.length || 2
      const text = raw.replace(/^#{1,4}\s+/, '')
      const tag = `h${Math.min(level + 1, 6)}`
      out.push(h(tag, { class: `gev-heading gev-h${level}`, key: `h-${k++}` }, renderInline(text)))
    } else {
      flushList()
      out.push(renderBlock(raw))
    }
  }
  flushList()
  flushCode()
  return out
}
