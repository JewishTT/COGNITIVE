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
  chat.sendMessage(
    'system',
    'Добро пожаловать в GHOST-7. Я ИИ-менеджер проекта — управляю задачами и исполняю команды. Пиши «помощь» для списка команд.',
  )
  // Friendly AI greeting after a beat.
  setTimeout(() => {
    const msg = chat.receiveAssistant(
      '👋 Привет! Я **GHOST-7** — твой ИИ-менеджер проекта. ' +
        'Я умею запускать тесты, собирать билды, добавлять сущности в ОСИНТ-граф и ' +
        'перезапускать стек Фабрики через docker. Что нужно сделать?',
    )
        chat.setDelivered(msg.id)
  }, 400)
}

/** Reset the store to a pristine state (used by tests / hot-reload). */
export function resetChat() {
  chat.clearAll()
}
