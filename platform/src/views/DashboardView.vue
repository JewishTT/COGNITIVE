<template>
  <section class="dash">
    <!-- Page header block -->
    <div class="dash-head">
      <div class="dash-title">
        <span class="dash-kicker">// COMMAND CENTER</span>
        <h1>ОБЗОР</h1>
        <p>Состояние всех подсистем и быстрый доступ к модулям.</p>
      </div>
      <button class="dash-refresh">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        ОБНОВИТЬ
      </button>
    </div>

    <!-- Telemetry strip -->
    <div class="dash-telemetry">
      <div class="tstat">
        <span class="tstat-label">NODES</span>
        <span class="tstat-value">{{ nodeCount }}</span>
        <span class="tstat-delta up">▲ 12</span>
      </div>
      <div class="tstat">
        <span class="tstat-label">EDGES</span>
        <span class="tstat-value">{{ edgeCount }}</span>
        <span class="tstat-delta up">▲ 34</span>
      </div>
      <div class="tstat">
        <span class="tstat-label">SCANS</span>
        <span class="tstat-value">{{ pipelineRuns }}</span>
        <span class="tstat-delta">— 0</span>
      </div>
      <div class="tstat">
        <span class="tstat-label">UPTIME</span>
        <span class="tstat-value live">{{ uptime }}</span>
        <span class="tstat-delta ok">● NOMINAL</span>
      </div>
      <div class="tstat">
        <span class="tstat-label">QUEUE</span>
        <span class="tstat-value">0</span>
        <span class="tstat-delta">IDLE</span>
      </div>
    </div>

    <!-- Module grid -->
    <div class="dash-grid">
      <!-- NAVIGATION ZONE -->
      <div class="dash-zone">
        <div class="zone-head">
          <span class="zone-idx">01</span>
          <span class="zone-title">МОДУЛИ</span>
          <span class="zone-hint">4</span>
        </div>
        <div class="mtiles">
          <router-link to="/globe" class="mtile">
            <span class="mtile-icon globe" v-html="icons.globe"></span>
            <span class="mtile-body">
              <strong>Globe</strong>
              <small>3D мониторинг</small>
            </span>
            <span class="mtile-go">→</span>
          </router-link>
          <router-link to="/osint" class="mtile">
            <span class="mtile-icon osint" v-html="icons.osint"></span>
            <span class="mtile-body">
              <strong>OSINT</strong>
              <small>Граф расследований</small>
            </span>
            <span class="mtile-go">→</span>
          </router-link>
          <router-link to="/factory" class="mtile">
            <span class="mtile-icon factory" v-html="icons.factory"></span>
            <span class="mtile-body">
              <strong>Factory</strong>
              <small>AI-контент</small>
            </span>
            <span class="mtile-go">→</span>
          </router-link>
          <router-link to="/ecommerce" class="mtile">
            <span class="mtile-icon commerce" v-html="icons.commerce"></span>
            <span class="mtile-body">
              <strong>Commerce</strong>
              <small>Проекты</small>
            </span>
            <span class="mtile-go">→</span>
          </router-link>
        </div>

        <div class="zone-head mt">
          <span class="zone-idx">02</span>
          <span class="zone-title">СИСТЕМА</span>
        </div>
        <ul class="sys-list">
          <li class="sys-row"><span class="sys-name">Core API</span><span class="sys-val ok">ONLINE</span></li>
          <li class="sys-row"><span class="sys-name">Graph DB</span><span class="sys-val ok">ONLINE</span></li>
          <li class="sys-row"><span class="sys-name">Pipeline Engine</span><span class="sys-val warn">FALLBACK</span></li>
          <li class="sys-row"><span class="sys-name">NLP Enricher</span><span class="sys-val ok">ONLINE</span></li>
        </ul>
      </div>

      <!-- CHAT ZONE -->
      <div class="dash-zone chat">
        <div class="zone-head">
          <span class="zone-idx">03</span>
          <span class="zone-title">АНАЛИТИКА</span>
          <span class="zone-status" :class="posture">{{ postureLabel }}</span>
        </div>

        <div ref="chatBodyRef" class="dash-chat-body">
          <div v-for="(m, i) in messages" :key="i" class="dc-msg" :class="m.role">
            <div class="dc-msg-meta">
              <span class="dc-role">{{ m.role }}</span>
            </div>
            <div class="dc-text" v-html="renderHtml(m.content)"></div>
          </div>
          <div v-if="thinking" class="dc-thinking">
            <span class="dc-dot"></span><span class="dc-dot"></span><span class="dc-dot"></span>
          </div>
        </div>

        <div class="dash-chat-input">
          <span class="ci-prefix">&gt;</span>
          <input v-model="chatInput" placeholder="Ввод запроса…" :disabled="thinking" @keydown.enter.prevent="sendChat" />
          <button class="ci-send" :disabled="!chatInput.trim() || thinking" @click="sendChat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { chat, seedWelcome } from '../chat/chatStore'

const icons = {
  globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  osint: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  factory: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  commerce: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="1"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
}

const chatInput = ref('')
const chatBodyRef = ref<HTMLElement | null>(null)

const messages = computed(() => chat.messages.value)
const thinking = computed(() => chat.posture.value === 'thinking' || chat.posture.value === 'working')
const posture = computed(() => chat.posture.value)
const postureLabel = computed(() => {
  switch (chat.posture.value) {
    case 'thinking': return 'ANALYZING'
    case 'working': return 'WORKING'
    case 'online': return 'ONLINE'
    default: return 'OFFLINE'
  }
})

const nodeCount = ref(847)
const edgeCount = ref(2341)
const pipelineRuns = ref(12)
const uptime = ref('99.7%')

function renderHtml(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function scrollChat() {
  nextTick(() => {
    if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
  })
}

function sendChat() {
  const text = chatInput.value.trim()
  if (!text || thinking.value) return
  chatInput.value = ''
  chat.setUserMessage(text)
  import('../chat/aiMock').then(({ handleMessage }) => handleMessage(text)).catch(() => {})
  scrollChat()
}

onMounted(() => {
  seedWelcome()
  scrollChat()
})
</script>

<style scoped>
.dash {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  background: var(--surface-0);
  color: var(--fg-primary);
  font-family: var(--font-sans);
}

/* ============ HEAD ============ */
.dash-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px;
}
.dash-kicker {
  display: block;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 1.5px;
  color: var(--fg-muted);
  margin-bottom: 4px;
}
.dash-title h1 {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin: 0;
  color: var(--fg-primary);
}
.dash-title p {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--fg-muted);
}
.dash-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--fg-secondary);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  cursor: pointer;
  transition: all 150ms;
}
.dash-refresh:hover { color: var(--fg-primary); border-color: var(--border-strong); }

/* ============ TELEMETRY ============ */
.dash-telemetry {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border: 1px solid var(--border-default);
  background: var(--surface-1);
}
.tstat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-right: 1px solid var(--border-default);
}
.tstat:last-child { border-right: none; }
.tstat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--fg-muted);
}
.tstat-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--fg-primary);
}
.tstat-value.live { color: var(--status-success); }
.tstat-delta { font-family: var(--font-mono); font-size: 9px; color: var(--fg-muted); }
.tstat-delta.up { color: var(--status-success); }
.tstat-delta.ok { color: var(--status-success); }

/* ============ GRID ============ */
.dash-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 12px;
}
.dash-zone {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
}

.zone-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-default);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.zone-idx {
  font-size: 9px;
  color: var(--fg-muted);
  border: 1px solid var(--border-default);
  padding: 1px 5px;
}
.zone-title {
  flex: 1;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--fg-secondary);
}
.zone-hint {
  font-size: 10px;
  color: var(--fg-muted);
}
.zone-head.mt { margin-top: 14px; border-top: 1px solid var(--border-default); }

.zone-status, .zone-status span { font-size: 9px; letter-spacing: 0.5px; }

/* ============ MODULE TILES ============ */
.mtiles { display: flex; flex-direction: column; }
.mtile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--border-default);
  text-decoration: none;
  color: inherit;
  background: transparent;
  transition: background 150ms;
}
.mtile:last-child { border-bottom: none; }
.mtile:hover { background: var(--surface-2); }
.mtile-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  color: var(--fg-secondary);
  flex-shrink: 0;
}
.mtile-icon.globe { color: var(--node-domain, #a78bfa); border-color: color-mix(in srgb, var(--node-domain, #a78bfa) 35%, transparent); }
.mtile-icon.osint { color: var(--node-person, #60a5fa); border-color: color-mix(in srgb, var(--node-person, #60a5fa) 35%, transparent); }
.mtile-icon.factory { color: var(--node-email, #4ade80); border-color: color-mix(in srgb, var(--node-email, #4ade80) 35%, transparent); }
.mtile-icon.commerce { color: var(--status-warning); border-color: color-mix(in srgb, var(--status-warning) 35%, transparent); }
.mtile-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.mtile-body strong {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--fg-primary);
}
.mtile-body small { font-size: 10px; color: var(--fg-muted); }
.mtile-go { color: var(--fg-muted); font-size: 13px; transition: transform 150ms, color 150ms; }
.mtile:hover .mtile-go { color: var(--fg-primary); transform: translateX(2px); }

/* ============ SYSTEM LIST ============ */
.sys-list { list-style: none; margin: 0; padding: 0; }
.sys-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  border-bottom: 1px solid var(--border-default);
}
.sys-row:last-child { border-bottom: none; }
.sys-name { color: var(--fg-secondary); }
.sys-val {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.sys-val::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.sys-val.ok { color: var(--status-success); }
.sys-val.warn { color: var(--status-warning); }

/* ============ CHAT ============ */
.zone-status { color: var(--status-success); }
.zone-status.analyzing, .zone-status.working { color: var(--status-warning); }
.zone-status.offline { color: var(--fg-muted); }

.dash-chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dash-chat-body::-webkit-scrollbar { width: 5px; }
.dash-chat-body::-webkit-scrollbar-thumb { background: var(--border-strong); }

.dc-msg { max-width: 88%; }
.dc-msg.user { align-self: flex-end; }
.dc-msg.assistant { align-self: flex-start; }
.dc-msg-meta { margin-bottom: 2px; }
.dc-role {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.dc-msg.assistant .dc-role { color: var(--node-person, #60a5fa); }
.dc-msg.user .dc-role { color: var(--fg-muted); }
.dc-text {
  font-size: 12px;
  line-height: 1.5;
  padding: 7px 10px;
  word-break: break-word;
  border: 1px solid var(--border-default);
  border-left: 2px solid var(--node-person, #60a5fa);
  background: var(--surface-2);
  color: var(--fg-primary);
}
.dc-msg.user .dc-text { border-left-color: var(--fg-muted); background: var(--surface-2); }
.dc-text :deep(strong) { color: var(--fg-primary); font-weight: 600; }
.dc-text :deep(em) { color: var(--fg-secondary); }
.dc-text :deep(code) {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--surface-active);
  padding: 1px 4px;
  color: var(--node-person, #60a5fa);
}

.dc-thinking { display: flex; gap: 4px; padding: 4px 0; }
.dc-dot {
  width: 5px;
  height: 5px;
  background: var(--node-person, #60a5fa);
  border-radius: 50%;
  animation: dotBounce 1.2s ease-in-out infinite both;
}
.dc-dot:nth-child(2) { animation-delay: 0.15s; }
.dc-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-3px); opacity: 1; }
}

.dash-chat-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-default);
}
.ci-prefix {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--status-success);
}
.dash-chat-input input {
  flex: 1;
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  padding: 7px 9px;
  color: var(--fg-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  outline: none;
  transition: border-color 150ms;
}
.dash-chat-input input::placeholder { color: var(--fg-muted); }
.dash-chat-input input:focus { border-color: var(--node-person, #60a5fa); }
.dash-chat-input input:disabled { opacity: 0.4; }
.ci-send {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  color: var(--status-success);
  cursor: pointer;
  transition: background 150ms;
  flex-shrink: 0;
}
.ci-send:hover:not(:disabled) { background: var(--surface-active); }
.ci-send:disabled { opacity: 0.35; cursor: not-allowed; }

@media (max-width: 900px) {
  .dash-telemetry { grid-template-columns: repeat(2, 1fr); }
  .tstat:nth-child(2n) { border-right: none; }
  .dash-grid { grid-template-columns: 1fr; }
  .dash-zone.chat { min-height: 320px; }
}
</style>
