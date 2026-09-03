<template>
  <div class="msg" :class="role">
    <div class="msg-row">
      <div class="msg-avatar" :class="role">
        <svg v-if="role === 'assistant'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div class="msg-content">
        <div class="msg-meta">
          <span class="msg-role">{{ role === 'assistant' ? 'GHOST-7' : 'OPERATOR' }}</span>
          <span class="msg-time">{{ timeLabel }}</span>
        </div>
        <div class="msg-text">
          <ChatContent :content="msg.content" />
        </div>
      </div>
    </div>
    <TaskCard v-if="inlineTask" :task="inlineTask" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage, ProjectTask } from '../types'
import TaskCard from './TaskCard.vue'
import ChatContent from './ChatContent.vue'

const props = defineProps<{ msg: ChatMessage }>()

const role = computed(() => props.msg.role)

const timeLabel = computed(() => {
  const d = new Date(props.msg.timestamp)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

const inlineTask = computed<ProjectTask | null>(() => {
  const p = props.msg.payload
  if (p?.type === 'task_created') return p.task
  return null
})
</script>

<style scoped>
.msg {
  width: 100%;
  min-width: 0;
}
.msg.system { display: none; }

.msg-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: rgba(139, 148, 158, 0.6);
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid #21262d;
}
.msg-avatar.assistant {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.08);
  border-color: rgba(88, 166, 255, 0.2);
}
.msg-avatar.user {
  color: #8b949e;
  background: rgba(139, 148, 158, 0.08);
  border-color: rgba(139, 148, 158, 0.2);
}

.msg-content {
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.msg-role {
  font-size: 11px;
  font-weight: 600;
  color: #e6edf3;
  letter-spacing: 0.3px;
}
.msg.assistant .msg-role { color: #58a6ff; }
.msg-time {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.4);
}

.msg-text {
  font-size: 13px;
  color: rgba(230, 237, 243, 0.85);
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
.msg.assistant .msg-text { color: #e6edf3; }

/* ─── Inline formatting ─── */
.msg-text :deep(strong) {
  color: #e6edf3;
  font-weight: 600;
}
.msg-text :deep(em) {
  color: rgba(230, 237, 243, 0.6);
  font-style: italic;
}
.msg-text :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: rgba(110, 118, 129, 0.15);
  padding: 1px 5px;
  border-radius: 4px;
  color: #79c0ff;
  font-size: 12px;
}
.msg-text :deep(.gev-code-block) {
  background: rgba(22, 27, 34, 0.9);
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 12px 14px;
  margin: 8px 0;
  overflow-x: auto;
  position: relative;
}
.msg-text :deep(.gev-code-block code) {
  background: none;
  padding: 0;
  border-radius: 0;
  color: #e6edf3;
  font-size: 12px;
  white-space: pre;
}
.msg-text :deep(.gev-code-lang) {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 9px;
  color: rgba(139, 148, 158, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.msg-text :deep(.gev-link) {
  color: #58a6ff;
  text-decoration: none;
  border-bottom: 1px solid rgba(88, 166, 255, 0.2);
  transition: border-color 0.15s;
}
.msg-text :deep(.gev-link:hover) {
  border-bottom-color: #58a6ff;
}
.msg-text :deep(q) {
  quotes: "\00AB" "\00BB" "\00AB" "\00BB";
  color: rgba(230, 237, 243, 0.6);
}

/* ─── Headings ─── */
.msg-text :deep(h2),
.msg-text :deep(h3),
.msg-text :deep(h4) {
  color: #e6edf3;
  font-weight: 600;
  margin: 10px 0 4px;
  line-height: 1.3;
}
.msg-text :deep(h2) { font-size: 14px; }
.msg-text :deep(h3) { font-size: 13px; }
.msg-text :deep(h4) { font-size: 12px; color: rgba(230, 237, 243, 0.7); }

/* ─── Lists ─── */
.msg-text :deep(.gev-list) {
  margin: 6px 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.msg-text :deep(li) {
  margin: 0;
  font-size: 13px;
  color: rgba(230, 237, 243, 0.8);
}
</style>
