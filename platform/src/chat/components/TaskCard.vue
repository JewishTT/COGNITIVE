<template>
  <div class="task-card" :class="[`kind-${kind}`, `s-${status}`]">
    <div class="task-header">
      <div class="task-header-left">
        <div class="task-icon" :class="kind">
          <svg v-if="kind === 'osint'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <svg v-else-if="kind === 'build'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <span class="task-title">{{ title }}</span>
      </div>
      <div class="task-header-right">
        <span class="task-owner">{{ ownerLabel }}</span>
        <span class="task-status-badge" :class="status">{{ statusLabel }}</span>
      </div>
    </div>

    <p v-if="description" class="task-desc">{{ description }}</p>

    <div v-if="steps.length" class="task-steps">
      <div v-for="s in steps" :key="s.id" class="task-step" :class="s.status">
        <div class="step-indicator" :class="s.status">
          <svg v-if="s.status === 'completed'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <svg v-else-if="s.status === 'failed'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <span class="step-label">{{ s.label }}</span>
        <span v-if="s.result && s.status === 'completed'" class="step-result">{{ s.result }}</span>
      </div>
    </div>

    <div v-if="status === 'running'" class="task-progress">
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
      <span class="progress-label">{{ progress }}%</span>
    </div>

    <div v-if="result && status !== 'running'" class="task-result">
      {{ result }}
    </div>
    <div v-else-if="error && status === 'failed'" class="task-error">
      {{ error }}
    </div>

    <div class="task-footer">
      <span class="task-time">{{ createdAgo }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectTask } from '../types'

const props = defineProps<{ task: ProjectTask }>()

const kind = computed(() => props.task.kind)
const status = computed(() => props.task.status)
const progress = computed(() => props.task.progress)
const steps = computed(() => props.task.steps)
const ownerLabel = computed(() => (props.task.owner === 'assistant' ? 'AI' : 'OP'))

const title = computed(() => {
  const m: Record<string, string> = {
    osint: 'OSINT SCAN',
    build: 'BUILD',
    test: 'TEST',
    deploy: 'DEPLOY',
    shell: 'SHELL',
    voice: 'VOICE',
    generic: 'TASK',
  }
  return `${m[props.task.kind] || 'TASK'}: ${props.task.title}`
})

const statusLabel = computed(() => {
  const m: Record<string, string> = {
    pending: 'PENDING',
    running: 'RUNNING',
    completed: 'DONE',
    failed: 'FAILED',
  }
  return m[props.task.status] ?? '—'
})

const createdAgo = computed(() => {
  const d = Date.now() - props.task.createdAt
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  return `${Math.floor(d / 3600000)}h ago`
})
</script>

<style scoped>
.task-card {
  margin: 10px 0 4px;
  padding: 12px 14px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid #21262d;
  border-radius: 8px;
  border-left: 3px solid #21262d;
}
.task-card.s-running { border-left-color: #58a6ff; }
.task-card.s-completed { border-left-color: #3fb950; }
.task-card.s-failed { border-left-color: #f85149; }
.task-card.s-pending { border-left-color: #d29922; }
.task-card.kind-osint { border-left-color: #bc8cff; }
.task-card.kind-build { border-left-color: #a78bfa; }
.task-card.kind-test { border-left-color: #d29922; }
.task-card.kind-deploy { border-left-color: #f97316; }
.task-card.kind-shell { border-left-color: #58a6ff; }

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.task-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.task-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
}
.task-icon.osint { background: rgba(188, 140, 255, 0.1); color: #bc8cff; }
.task-icon.build { background: rgba(167, 139, 250, 0.1); color: #a78bfa; }
.task-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #e6edf3;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.task-owner {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(139, 148, 158, 0.5);
  padding: 2px 6px;
  border: 1px solid #21262d;
  border-radius: 4px;
}
.task-status-badge {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.task-status-badge.s-pending { color: #d29922; background: rgba(210, 153, 34, 0.1); }
.task-status-badge.s-running { color: #58a6ff; background: rgba(88, 166, 255, 0.1); }
.task-status-badge.s-completed { color: #3fb950; background: rgba(63, 185, 80, 0.1); }
.task-status-badge.s-failed { color: #f85149; background: rgba(248, 81, 73, 0.1); }

.task-desc {
  margin: 8px 0 4px;
  font-size: 12px;
  color: rgba(139, 148, 158, 0.6);
  line-height: 1.4;
}

.task-steps {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.task-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(230, 237, 243, 0.6);
}
.step-indicator {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: rgba(139, 148, 158, 0.1);
  border: 1px solid #21262d;
}
.step-indicator.completed { background: rgba(63, 185, 80, 0.15); border-color: rgba(63, 185, 80, 0.3); color: #3fb950; }
.step-indicator.running { background: rgba(88, 166, 255, 0.15); border-color: rgba(88, 166, 255, 0.3); color: #58a6ff; animation: pulse 1.5s ease-in-out infinite; }
.step-indicator.failed { background: rgba(248, 81, 73, 0.15); border-color: rgba(248, 81, 73, 0.3); color: #f85149; }
.step-label { flex: 1; min-width: 0; }
.step-result { color: #3fb950; font-weight: 500; font-size: 11px; }

.task-progress {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-track {
  flex: 1;
  height: 3px;
  background: rgba(139, 148, 158, 0.1);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #58a6ff;
  border-radius: 2px;
  transition: width 300ms ease;
}
.progress-label {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.5);
  font-family: 'JetBrains Mono', monospace;
  min-width: 28px;
  text-align: right;
}

.task-result {
  margin-top: 8px;
  font-size: 12px;
  color: #3fb950;
  background: rgba(63, 185, 80, 0.06);
  border: 1px solid rgba(63, 185, 80, 0.15);
  border-radius: 6px;
  padding: 8px 10px;
  line-height: 1.4;
}
.task-error {
  margin-top: 8px;
  font-size: 12px;
  color: #f85149;
  background: rgba(248, 81, 73, 0.06);
  border: 1px solid rgba(248, 81, 73, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  line-height: 1.4;
}

.task-footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
.task-time {
  font-size: 10px;
  color: rgba(139, 148, 158, 0.3);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
