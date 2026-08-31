/**
 * formatContent.ts — a tiny markdown-ish renderer for chat messages.
 *
 * We deliberately avoid pulling a full markdown dependency into the platform
 * bundle. Supported subset (sufficient for the AI agent's replies):
 *
 *   **bold**                → <strong>
 *   inline `code`           → <code>
 *   "text"                  → <q>
 *   leading "- " lines      → <li> inside <ul>
 *   blank-line-separated    → <p>
 *
 * Output is real VNodes (no innerHTML), so it's XSS-safe by construction.
 */
import { h, type VNode } from 'vue'

function renderInline(text: string): VNode[] {
  const nodes: VNode[] = []
  // Split keeping the delimiters so we can rebuild.
  const parts = text.split(/(\*\*.*?\*\*|`[^`]*`|"[^"]*")/g).filter(Boolean)
  let k = 0
  for (const part of parts) {
    if (/^\*\*(.*)\*\*$/.test(part)) {
      nodes.push(h('strong', { key: k++ }, part.slice(2, -2)))
    } else if (/^`([^`]*)`$/.test(part)) {
      nodes.push(h('code', { key: k++ }, part.slice(1, -1)))
    } else if (/^"([^"]*)"$/.test(part)) {
      nodes.push(h('q', { key: k++ }, part.slice(1, -1)))
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

export function renderContent(content: string): VNode[] {
  if (!content) return []
  const out: VNode[] = []
  const lines = content.split(/\r?\n/)
  let listBuf: string[] = []
  let k = 0

  const flushList = () => {
    if (!listBuf.length) return
    out.push(
      h(
        'ul',
        { class: 'gev-list', key: `ul-${k++}` },
        listBuf.map((l) => h('li', renderInline(l))),
      ),
    )
    listBuf = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const isBlank = raw.trim() === ''
    const isItem = /^\s*[-*]\s+.+/.test(raw)

    if (isItem) {
      const itemText = raw.replace(/^\s*[-*]\s+/, '')
      listBuf.push(itemText)
    } else if (isBlank) {
      flushList()
      // blank line collapses (no extra <p> spacer) to keep dense terminal feel
    } else {
      flushList()
      out.push(renderBlock(raw))
      void i
    }
  }
  flushList()
  return out
}
