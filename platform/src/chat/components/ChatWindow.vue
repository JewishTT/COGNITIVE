<template>
  <div class="gev-chat-wrap" :class="{ open, 'ai-thinking': thinking }">
    <!-- Collapsed trigger: neon pulse button on the right edge. -->
    <button
      v-if="!open"
      class="gev-chat-burst"
      type="button"
      aria-label="Открыть чат с ИИ-менеджером"
      title="Открыть чат с ИИ-менеджером"
      @click="open = true"
    >
      <span class="gev-burst-ring"></span>
      <span class="gev-burst-ico">💬</span>
      <span v-if="unreadCount > 0" class="gev-chat-badge" aria-label="непрочитанных">{{ unreadCount }}</span>
    </button>

    <!-- Expanded panel -->
    <aside v-else class="gev-chat" role="dialog" aria-label="Чат с ИИ-менеджером проекта">
      <header class="gev-chat-head">
        <div class="gev-head-title">
          <span class="gev-head-ico">G7</span>
          <span>GHOST-7 / Командный чат</span>
        </div>
        <div class="gev-head-meta">
          <span class="gev-status-dot" :class="posture"></span>
          <span class="gev-status-label">{{ postureLabel }}</span>
          <button
            class="gev-head-btn"
            type="button"
            aria-label="Свернуть чат"
            title="Свернуть чат"
            @click="open = false"
          >✕</button>
        </div>
      </header>

      <main class="gev-chat-body" ref="bodyRef" tabindex="0">
        <div class="gev-msgs">
          <ChatMessage v-for="m in orderedMessages" :key="m.id" :msg="m" />

          <div v-if="thinking" class="gev-typing">
            <span class="gev-typing-dot" style="--d: 0ms">·</span>
            <span class="gev-typing-dot" style="--d: 160ms">·</span>
            <span class="gev-typing-dot" style="--d: 320ms">·</span>
          </div>

          <div v-if="noTasksYet && !thinking" class="gev-empty-state">
            <p>Пиши команду — ИИ создаст и исполнит задачу.</p>
            <p class="gev-empty-sub">Например: «запусти регрессию»</p>
          </div>
        </div>
      </main>

      <!-- Quick suggestion chips -->
      <nav v-if="showChips" class="gev-chat-chips">
        <button v-for="c in suggestions" :key="c" class="gev-chip-btn" type="button" @click="sendQuick(c)">
          {{ c }}
        </button>
      </nav>

      <!-- Input -->
      <footer class="gev-chat-input">
        <textarea
          v-model="input"
          ref="inputRef"
          class="gev-input"
          :placeholder="inputPlaceholder"
          :disabled="thinking"
          rows="1"
          maxlength="1000"
          @keydown.ctrl.enter="send"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="gev-send" type="button" :disabled="!canSend" aria-label="Отправить" @click="send">
          <span v-if="!thinking">▶</span>
          <span v-else>···</span>
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { chat, seedWelcome } from '../chatStore'
import { handleMessage } from '../aiMock'
import ChatMessage from './ChatMessage.vue'

const open = ref(false)
const input = ref('')
const bodyRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const thinking = computed(() => chat.posture.value === 'thinking' || chat.posture.value === 'working')
const posture = computed(() => chat.posture.value)
const postureLabel = computed(() => {
  switch (chat.posture.value) {
    case 'thinking':
      return 'обдумывает...'
    case 'working':
      return 'работает...'
    case 'online':
      return 'в сети'
    default:
      return 'offline'
  }
})

const noTasksYet = computed(() => chat.tasks.value.length === 0)
const orderedMessages = computed(() => chat.messages.value)
const unreadCount = computed(() => chat.runningTaskCount.value)

const suggestions = [
  'запусти регрессию',
  'сборка production',
  'добавь узел в граф',
  'перезапусти фабрику',
  'статус проекта',
  'помощь',
]
const showChips = computed(() => open.value && chat.messages.value.length <= 1 && !thinking.value)
const canSend = computed(() => input.value.trim().length > 0 && !thinking.value)
const inputPlaceholder = computed(() =>
  thinking.value ? 'GHOST-7 работает...' : 'Введите команду или сообщение…',
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
  handleMessage(chat, text)
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
  // Auto-open briefly so the operator sees the AI greeting on first launch.
  open.value = true
  setTimeout(() => {
    open.value = false
  }, 4200)
})
</script>

<style scoped>
/* The whole chat widget sits above the shell content. */
.gev-chat-wrap {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
}

/* ---- Collapsed: neon burst button ---- */
.gev-chat-burst {
  position: relative;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 1px solid rgba(0, 212, 255, 0.5);
  border-radius: 50%;
  background: radial-gradient(14px circle, rgba(0, 212, 255, 0.28), transparent 65%);
  color: #22d3ee;
  font-size: 22px;
  cursor: pointer;
  transition: all 180ms ease, box-shadow 220ms ease;
  box-shadow:
    0 0 0 0px rgba(0, 212, 255, 0.5),
    0 0 12px rgba(0, 212, 255, 0.6);
  animation: gev-burst-pulse 2.6s ease-in-out infinite;
}
.gev-chat-burst:hover {
  background: radial-gradient(18px circle, rgba(0, 212, 255, 0.42), transparent 65%);
  border-color: #22d3ee;
  box-shadow:
    0 0 0 6px rgba(0, 212, 255, 0.35),
    0 0 18px rgba(0, 212, 255, 0.8);
  transform: scale(1.08);
}
@keyframes gev-burst-pulse {
  0%,
  100% { box-shadow: 0 0 0 0px rgba(0, 212, 255, 0.45), 0 0 8px rgba(0, 212, 255, 0.5); }
  50% { box-shadow: 0 0 0 10px rgba(0, 212, 255, 0), 0 0 16px rgba(0, 212, 255, 0.6); }
}
.gev-burst-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #22d3ee;
  animation: gev-spin 3s linear infinite;
  pointer-events: none;
}
@keyframes gev-spin {
  to { transform: rotate(360deg); }
}
.gev-burst-ico { line-height: 1; }

.gev-chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #fb624c;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px #fb624c;
  animation: gev-badge-blink 1.4s ease-in-out infinite;
  border: 1px solid rgba(10, 14, 20, 0.9);
}
@keyframes gev-badge-blink {
  0%,
  100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* ---- Expanded panel ---- */
.gev-chat {
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 80vh;
  max-height: 720px;
  display: flex;
  flex-direction: column;
  background: rgba(10, 14, 20, 0.92);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6) inset,
    0 24px 64px rgba(0, 0, 0, 0.6),
    0 0 36px rgba(0, 212, 255, 0.18);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  overflow: hidden;
}
.gev-chat.ai-thinking {
  border-color: rgba(255, 94, 173, 0.4);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6) inset,
    0 24px 64px rgba(0, 0, 0, 0.6),
    0 0 32px rgba(255, 94, 173, 0.34);
}

.gev-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 2px solid rgba(0, 212, 255, 0.2);
  background: linear-gradient(90deg, rgba(10, 14, 20, 0.8), rgba(12, 12, 22, 0.9));
  flex: 0 0 auto;
}
.gev-head-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #e8eaed;
  letter-spacing: 0.5px;
}
.gev-head-ico {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, #22d3ee, #a78bfa);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #04121a;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.45);
  letter-spacing: 1px;
}
.gev-head-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(232, 234, 237, 0.6);
}
.gev-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  background: #34d399;
  box-shadow: 0 0 6px #34d399;
}
.gev-status-dot.thinking {
  background: #fbbf24;
  box-shadow: 0 0 8px #fbbf24;
  animation: gev-pulse-soft 1.2s ease-in-out infinite;
}
.gev-status-dot.working {
  background: #f87171;
  box-shadow: 0 0 8px #f87171;
  animation: gev-pulse-soft 0.9s ease-in-out infinite;
}
.gev-status-dot.online { box-shadow: 0 0 6px #34d399; }
@keyframes gev-pulse-soft {
  0%,
  100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.gev-head-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(232, 234, 237, 0.12);
  border-radius: 6px;
  color: rgba(232, 234, 237, 0.6);
  width: 26px;
  height: 26px;
  font-size: 14px;
  cursor: pointer;
  transition: all 140ms ease;
}
.gev-head-btn:hover {
  background: rgba(248, 113, 113, 0.18);
  border-color: #f87171;
  color: #f87171;
}

.gev-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.gev-chat-body::-webkit-scrollbar { width: 6px; }
.gev-chat-body::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.25); border-radius: 3px; }
.gev-chat-body::-webkit-scrollbar-track { background: transparent; }

.gev-msgs {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.gev-typing {
  align-self: flex-start;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 22px;
  line-height: 1;
  color: #22d3ee;
  opacity: 0.8;
}
.gev-typing-dot {
  display: inline-block;
  animation: gev-typing-bounce 1.1s ease-in-out infinite both;
  animation-delay: var(--d, 0ms);
}
@keyframes gev-typing-bounce {
  0%, 8%, 20%, 28% { transform: none; opacity: 0.55; }
  14%, 24% { transform: translateY(-4px); opacity: 1; }
}

.gev-empty-state {
  text-align: center;
  color: rgba(232, 234, 237, 0.45);
  font-size: 12px;
  margin: 8px auto 0;
  opacity: 0.75;
}
.gev-empty-sub { opacity: 0.4; font-size: 11px; margin-top: 4px; }

.gev-chat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid rgba(34, 211, 238, 0.1);
  background: rgba(10, 14, 20, 0.6);
}
.gev-chip-btn {
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.25);
  border-radius: 999px;
  color: rgba(232, 234, 237, 0.7);
  font-size: 11px;
  padding: 5px 11px;
  cursor: pointer;
  transition: all 140ms ease;
  font-family: inherit;
  white-space: nowrap;
}
.gev-chip-btn:hover {
  background: rgba(34, 211, 238, 0.22);
  border-color: rgba(34, 211, 238, 0.45);
  color: #e8eaed;
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
}

.gev-chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px 14px;
  border-top: 2px solid rgba(0, 212, 255, 0.18);
  background: rgba(10, 14, 20, 0.78);
}
.gev-input {
  flex: 1;
  background: rgba(12, 12, 20, 0.9);
  border: 1px solid rgba(34, 211, 238, 0.22);
  border-radius: 10px;
  color: var(--text, #e8eaed);
  font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
  font-size: 12.5px;
  padding: 10px 12px;
  resize: none;
  outline: none;
  transition: border-color 140ms ease, box-shadow 140ms ease;
  min-height: 38px;
  max-height: 160px;
}
.gev-input::placeholder { color: rgba(232, 234, 237, 0.35); }
.gev-input:focus {
  border-color: rgba(0, 212, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.15);
}
.gev-input:disabled { opacity: 0.5; cursor: wait; }
.gev-send {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 10px;
  background: linear-gradient(135deg, #22d3ee, #0ea5e9);
  color: #04121a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 140ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.35);
}
.gev-send:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.6);
  transform: translateY(-1px);
}
.gev-send:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
</style>
