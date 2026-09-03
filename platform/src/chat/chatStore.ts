/**
 * chatStore.ts — singleton instance of the chat store.
 *
 * `useChat()` returns fresh state per call, which is great for tests but wrong
 * for a live UI where every component (message list, input, task rail, status
 * badge) must read the same transcript. This module instantiates one store and
 * exports it. To reset, call `chat.clearAll()`.
 */
import { useChat } from './useChat'

export const chat = useChat()

/** Convenience: seed the transcript on first mount. */
export function seedWelcome() {
  if (chat.messages.value.length > 0) return
  chat.receiveAssistant(
    `**GHOST-7 онлайн**\n\n` +
    `Оператор, я готов к работе. Доступные команды:\n\n` +
    `- \`скан <цель>\` — OSINT-сбор данных\n` +
    `- \`статус\` — инструменты и запуски\n` +
    `- \`помощь\` — список всех команд\n\n` +
    `Можно писать на русском или английском.`
  )
}

/** Reset the store to a pristine state (used by tests / hot-reload). */
export function resetChat() {
  chat.clearAll()
}
