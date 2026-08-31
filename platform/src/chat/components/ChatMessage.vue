<template>
  <div class="gev-msg" :class="role">
    <div class="gev-msg-ctx">
      <span class="gev-avatar" :class="role" aria-hidden="true">
        <span class="gev-ico">{{ avatar }}</span>
      </span>
                <div class="gev-msg-content">
      <ChatContent :content="msg.content" />
    </div>
    </div>

    <!-- Inline task card when the AI echoed a task creation. -->
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

const avatar = computed(() => {
  switch (props.msg.role) {
    case 'user':
      return '👤'
    case 'assistant':
      return '🤖'
    default:
      return '⚙️'
  }
})

const inlineTask = computed<ProjectTask | null>(() => {
  const p = props.msg.payload
  if (p?.type === 'task_created') return p.task
  return null
})

</script>

<style scoped>
.gev-msg {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 10px;
  align-start: start;
}
.gev-msg.system { display: none; }
.gev-msg-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, rgba(232, 234, 237, 0.8));
  line-height: 1.5;
  word-break: break-word;
}
.gev-msg.assistant .gev-msg-content { color: #e8eaed; }
.gev-msg-content .gev-line,
.gev-msg-content p { margin: 0; }
.gev-msg-content .gev-list {
  margin: 4px 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gev-msg-content li { margin: 0; }
.gev-msg-content code {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  background: rgba(34, 211, 238, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  color: #38bdf8;
  font-size: 12px;
}
.gev-msg-content q { quotes: "«" "»" "«" "»"; }
.gev-msg-content strong { color: var(--accent, #00d4ff); font-weight: 700; }
.gev-msg.assistant .gev-msg-content strong { color: #38bdf8; }
.gev-empty-hint { color: rgba(232, 234, 237, 0.35); font-style: italic; }

.gev-avatar {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 14px;
  line-height: 1;
  background: rgba(12, 12, 20, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.gev-msg.assistant .gev-avatar {
  background: radial-gradient(12px circle at 30% 30%, rgba(0, 212, 255, 0.22), transparent 60%),
    linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(168, 134, 255, 0.12));
  border-color: rgba(0, 212, 255, 0.4);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}
.gev-msg.user .gev-avatar {
  background: linear-gradient(135deg, rgba(168, 134, 255, 0.2), rgba(255, 86, 173, 0.08));
  border-color: rgba(168, 134, 255, 0.4);
  box-shadow: 0 0 8px rgba(168, 134, 255, 0.3);
}
</style>
