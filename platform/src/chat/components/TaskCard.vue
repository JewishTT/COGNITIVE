<template>
  <div class="gev-task" :class="[`kind-${kind}`, `s-${status}`]">
    <div class="gev-task-head">
      <span class="gev-task-title">{{ title }}</span>
      <span class="gev-task-owner" :title="ownerLabel">{{ ownerLabel }}</span>
      <span class="gev-task-status" :class="status">{{ statusLabel }}</span>
    </div>

    <p v-if="description" class="gev-task-desc">{{ description }}</p>

    <div v-if="steps.length" class="gev-task-steps">
      <div
        v-for="s in steps"
        :key="s.id"
        class="gev-task-step"
        :class="s.status"
      >
        <span class="gev-step-dot" :class="s.status"></span>
        <span class="gev-step-label">{{ s.label }}</span>
        <span v-if="s.result && s.status === 'completed'" class="gev-step-result">{{ s.result }}</span>
      </div>
    </div>

    <div v-if="status === 'running'" class="gev-task-progress">
      <div class="gev-progress-bar" :style="{ width: `${progress}%` }"></div>
    </div>

    <div v-if="result && status !== 'running'" class="gev-task-result">
      {{ result }}
    </div>

    <div v-else-if="error && status === 'failed'" class="gev-task-error">
      {{ error }}
    </div>

    <div class="gev-task-foot">
      <span class="gev-task-time">{{ createdAgo }}</span>
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

const statusLabel = computed(() => {
  const m: Record<string, string> = {
    pending: 'В ОЖИДАНИИ',
    running: 'ВЫПОЛНЯЕТСЯ',
    completed: 'ГОТОВО',
    failed: 'ОШИБКА',
  }
  return m[props.task.status] ?? '—'
})

const createdAgo = computed(() => {
  const d = Date.now() - props.task.createdAt
  if (d < 60000) return 'только что'
  if (d < 3600000) return `${Math.floor(d / 60000)} мин назад`
  return `${Math.floor(d / 3600000)} ч назад`
})
</script>

<style scoped>
.gev-task {
  margin: 12px 0;
  padding: 12px 14px;
  background: rgba(10, 14, 20, 0.78);
  border: 1px solid rgba(34, 211, 238, 0.18);
  border-left: 3px solid transparent;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}
.gev-task-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.gev-task-title {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary, #e8eaed);
  letter-spacing: 0.5px;
}
.gev-task-owner {
  margin-left: auto;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(232, 234, 237, 0.45);
  border: 1px solid rgba(232, 234, 237, 0.15);
  border-radius: 999px;
  padding: 2px 8px;
}
.gev-task-status {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
}
.gev-task.s-pending .gev-task-status { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); }
.gev-task.s-running .gev-task-status { background: rgba(34, 211, 238, 0.15); color: #22d3ee; border-color: rgba(34, 211, 238, 0.5); box-shadow: 0 0 8px rgba(34, 211, 238, 0.4); animation: gev-pulse 2s ease-in-out infinite; }
.gev-task.s-completed .gev-task-status { background: rgba(52, 211, 153, 0.15); color: #34d399; border-color: rgba(52, 211, 153, 0.4); }
.gev-task.s-failed .gev-task-status { background: rgba(248, 113, 113, 0.15); color: #f87171; border-color: rgba(248, 113, 113, 0.5); }
.gev-task.s-running { border-left-color: #22d3ee; }
.gev-task.s-completed { border-left-color: #34d399; }
.gev-task.s-failed { border-left-color: #f87171; }
.gev-task.s-pending { border-left-color: #fbbf24; }
.gev-task.kind-test { border-left-color: #fbbf24; }
.gev-task.kind-build { border-left-color: #a78bfa; }
.gev-task.kind-osint { border-left-color: #f472b6; }
.gev-task.kind-deploy { border-left-color: #f97316; }
.gev-task.kind-shell { border-left-color: #60a5fa; }
.gev-task.kind-voice { border-left-color: #facc15; }
.gev-task-desc { margin: 8px 0 4px; font-size: 11px; color: rgba(232, 234, 237, 0.55); line-height: 1.4; }
.gev-task-steps { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
.gev-task-step { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(232, 234, 237, 0.65); }
.gev-step-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: rgba(232, 234, 237, 0.25); border: 1px solid rgba(232, 234, 237, 0.15); }
.gev-task-step.running .gev-step-dot { background: #22d3ee; box-shadow: 0 0 6px #22d3ee; }
.gev-task-step.completed .gev-step-dot { background: #34d399; }
.gev-task-step.failed .gev-step-dot { background: #f87171; }
.gev-step-result { margin-left: auto; color: #34d399; font-weight: 700; }
.gev-task-progress { margin-top: 10px; height: 4px; background: rgba(232, 234, 237, 0.08); border-radius: 2px; overflow: hidden; }
.gev-progress-bar { height: 100%; background: linear-gradient(90, #22d3ee, #7c3aed); border-radius: 2px; transition: width 280ms ease; }
.gev-task-result { margin-top: 10px; font-size: 11px; color: rgba(52, 211, 153, 0.85); background: rgba(52, 211, 153, 0.06); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 8px; padding: 8px 10px; line-height: 1.4; }
.gev-task-error { margin-top: 10px; font-size: 11px; color: #f87171; background: rgba(248, 113, 113, 0.06); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 8px; padding: 8px 10px; line-height: 1.4; }
.gev-task-foot { margin-top: 10px; display: flex; justify-content: flex-end; }
.gev-task-time { font-size: 9px; color: rgba(232, 234, 237, 0.35); }
@keyframes gev-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
</style>
