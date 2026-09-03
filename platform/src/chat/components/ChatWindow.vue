<template>
  <div class="chat-wrap" :class="{ open, 'ai-thinking': thinking }">
    <!-- Collapsed trigger -->
    <button
      v-if="!open"
      class="chat-trigger"
      type="button"
      aria-label="Открыть чат с ИИ-менеджером"
      title="Открыть чат с ИИ-менеджером"
      @click="open = true"
    >
      <span class="trigger-ring"></span>
      <svg class="trigger-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span v-if="unreadCount > 0" class="chat-badge">{{ unreadCount }}</span>
    </button>

    <!-- Expanded panel -->
    <aside v-else class="chat-panel" role="dialog" aria-label="Чат с ИИ-менеджером проекта">
      <header class="chat-header">
        <div class="header-left">
          <div class="header-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="header-text">
            <span class="header-name">GHOST-7</span>
            <span class="header-sub">OSINT / COMMAND</span>
          </div>
        </div>
        <div class="header-right">
          <span class="status-indicator" :class="posture"></span>
          <span class="status-text">{{ postureLabel }}</span>
          <button class="header-close" type="button" aria-label="Свернуть чат" @click="open = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </header>

      <main class="chat-body" ref="bodyRef" tabindex="0">
        <div class="messages">
          <ChatMessage v-for="m in orderedMessages" :key="m.id" :msg="m" />

          <div v-if="thinking" class="typing-indicator">
            <span class="typing-dot" style="--d: 0ms"></span>
            <span class="typing-dot" style="--d: 160ms"></span>
            <span class="typing-dot" style="--d: 320ms"></span>
          </div>

          <div v-if="noTasksYet && !thinking" class="empty-state">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <p class="empty-title">GHOST-7 Online</p>
            <p class="empty-sub">Введите команду или вопрос</p>
          </div>
        </div>
      </main>

      <!-- Quick suggestions -->
      <nav v-if="showChips" class="chat-chips">
        <button v-for="c in suggestions" :key="c" class="chip" type="button" @click="sendQuick(c)">
          {{ c }}
        </button>
      </nav>

      <!-- Input -->
      <footer class="chat-input-area">
        <div class="input-wrap">
          <textarea
            v-model="input"
            ref="inputRef"
            class="chat-input"
            :placeholder="inputPlaceholder"
            :disabled="thinking"
            rows="1"
            maxlength="1000"
            @keydown.ctrl.enter="send"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <button class="send-btn" type="button" :disabled="!canSend" aria-label="Отправить" @click="send">
            <svg v-if="!thinking" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <span v-else class="send-loading"></span>
          </button>
        </div>
        <div class="input-meta">
          <span class="input-hint">Enter — отправить · Ctrl+Enter — новая строка</span>
        </div>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { chat, seedWelcome } from '../chatStore'
import ChatMessage from './ChatMessage.vue'

const open = ref(false)
const input = ref('')
const bodyRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const thinking = computed(() => chat.posture.value === 'thinking' || chat.posture.value === 'working')
const posture = computed(() => chat.posture.value)
const postureLabel = computed(() => {
  switch (chat.posture.value) {
    case 'thinking': return 'АНАЛИЗ'
    case 'working': return 'РАБОТА'
    case 'online': return 'ONLINE'
    default: return 'OFFLINE'
  }
})

const noTasksYet = computed(() => chat.tasks.value.length === 0)
const orderedMessages = computed(() => chat.messages.value)
const unreadCount = computed(() => chat.runningTaskCount.value)

const suggestions = [
  'статус пайплайна',
  'помощь',
  'скан github.com',
  'запрос в Neo4j',
]
const showChips = computed(() => open.value && chat.messages.value.length <= 1 && !thinking.value)
const canSend = computed(() => input.value.trim().length > 0 && !thinking.value)
const inputPlaceholder = computed(() =>
  thinking.value ? 'GHOST-7 обрабатывает...' : 'Команда / вопрос / цель...',
)

function fitHeight() {
  const ta = inputRef.value
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight}px`
  ta.style.overflow = ta.scrollHeight > 160 ? 'auto' : 'hidden'
}

function scrollDown() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

function send() {
  if (!canSend.value) return
  const text = input.value.trim()
  input.value = ''
  fitHeight()
  chat.setUserMessage(text)
  import('../aiMock').then(({ handleMessage }) => handleMessage(text)).catch(err => {
    chat.receiveAssistant(`Ошибка: ${err.message}`)
  })
  scrollDown()
}

function sendQuick(c: string) {
  input.value = c
  fitHeight()
  send()
}

watch(() => chat.messages.value.length, () => scrollDown())

onMounted(() => {
  seedWelcome()
  open.value = true
  setTimeout(() => { open.value = false }, 4200)
})
</script>

<style scoped>
.chat-wrap {
  position: relative;
  bottom: -700px;
  right: 24px;
  z-index: 2000;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ─── Trigger ─── */
.chat-trigger {
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid rgba(88, 166, 255, 0.3);
  border-radius: 12px;
  background: rgba(13, 17, 23, 0.95);
  color: #58a6ff;
  cursor: pointer;
  transition: all 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.chat-trigger:hover {
  background: rgba(22, 27, 34, 0.98);
  border-color: rgba(88, 166, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.5);
  transform: translateY(-1px);
}
.trigger-ring {
  display: none;
}
.trigger-icon {
  width: 22px;
  height: 22px;
}

.chat-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #f85149;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0d1117;
}

/* ─── Panel ─── */
.chat-panel {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 400px;
  max-width: calc(100vw - 48px);
  height: 80vh;
  max-height: 720px;
  display: flex;
  flex-direction: column;
  background: rgba(13, 17, 23, 0.98);
  border: 1px solid #21262d;
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.3) inset,
    0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.chat-panel.ai-thinking {
  border-color: rgba(88, 166, 255, 0.3);
}

/* ─── Header ─── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #21262d;
  background: rgba(13, 17, 23, 0.95);
  flex: 0 0 auto;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #58a6ff;
}
.header-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.header-name {
  font-size: 13px;
  font-weight: 600;
  color: #e6edf3;
  letter-spacing: 0.3px;
}
.header-sub {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.7);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3fb950;
}
.status-indicator.thinking {
  background: #d29922;
  animation: pulse 1.5s ease-in-out infinite;
}
.status-indicator.working {
  background: #f85149;
  animation: pulse 1s ease-in-out infinite;
}
.status-text {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.6);
  letter-spacing: 0.5px;
  font-weight: 500;
}
.header-close {
  width: 28px;
  height: 28px;
  border: 1px solid #21262d;
  border-radius: 6px;
  background: transparent;
  color: rgba(139, 148, 158, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}
.header-close:hover {
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.3);
  color: #f85149;
}

/* ─── Body ─── */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.chat-body::-webkit-scrollbar { width: 4px; }
.chat-body::-webkit-scrollbar-thumb { background: #21262d; border-radius: 2px; }
.chat-body::-webkit-scrollbar-track { background: transparent; }

.messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

/* ─── Typing ─── */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}
.typing-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #58a6ff;
  animation: typingBounce 1.2s ease-in-out infinite both;
  animation-delay: var(--d, 0ms);
}
@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

/* ─── Empty state ─── */
.empty-state {
  text-align: center;
  padding: 32px 0;
}
.empty-icon {
  color: rgba(88, 166, 255, 0.3);
  margin-bottom: 12px;
}
.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #e6edf3;
  margin: 0 0 4px;
}
.empty-sub {
  font-size: 12px;
  color: rgba(139, 148, 158, 0.5);
  margin: 0;
}

/* ─── Chips ─── */
.chat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid #21262d;
  background: rgba(13, 17, 23, 0.6);
}
.chip {
  background: rgba(88, 166, 255, 0.06);
  border: 1px solid rgba(88, 166, 255, 0.15);
  border-radius: 6px;
  color: rgba(230, 237, 243, 0.6);
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: inherit;
  white-space: nowrap;
}
.chip:hover {
  background: rgba(88, 166, 255, 0.12);
  border-color: rgba(88, 166, 255, 0.3);
  color: #e6edf3;
}

/* ─── Input ─── */
.chat-input-area {
  border-top: 1px solid #21262d;
  background: rgba(13, 17, 23, 0.8);
  padding: 12px 16px 10px;
}
.input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid #21262d;
  border-radius: 8px;
  padding: 4px 4px 4px 12px;
  transition: border-color 150ms ease;
}
.input-wrap:focus-within {
  border-color: rgba(88, 166, 255, 0.4);
}
.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #e6edf3;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  padding: 8px 0;
  resize: none;
  outline: none;
  min-height: 32px;
  max-height: 160px;
  line-height: 1.5;
}
.chat-input::placeholder { color: rgba(139, 148, 158, 0.4); }
.chat-input:disabled { opacity: 0.4; cursor: wait; }

.send-btn {
  width: 32px;
  height: 32px;
  flex: none;
  border: none;
  border-radius: 6px;
  background: #238636;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}
.send-btn:hover:not(:disabled) {
  background: #2ea043;
  box-shadow: 0 0 0 2px rgba(46, 160, 67, 0.3);
}
.send-btn:disabled {
  background: #21262d;
  color: rgba(139, 148, 158, 0.3);
  cursor: not-allowed;
}
.send-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.input-meta {
  padding-top: 6px;
}
.input-hint {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.3);
  letter-spacing: 0.2px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
