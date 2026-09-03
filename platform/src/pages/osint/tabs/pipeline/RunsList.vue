<template>
  <div class="rl-root">
    <!-- Filters -->
    <div class="rl-filters">
      <button
        v-for="filter in filters"
        :key="filter.id"
        class="c-tab"
        :class="{ active: activeFilter === filter.id }"
        @click="activeFilter = filter.id"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filteredRuns.length === 0" class="c-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="c-empty-icon">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <p class="c-empty-text">No runs found</p>
    </div>

    <!-- Runs list -->
    <div v-else class="rl-list">
      <div
        v-for="run in filteredRuns"
        :key="run.id"
        class="rl-card"
      >
        <div class="rl-card-left">
          <div class="rl-card-dot" :class="`rl-dot-${run.status}`" />
          <div class="rl-card-info">
            <div class="rl-card-header">
              <span class="rl-card-target">{{ run.target }}</span>
              <span class="rl-card-type">{{ run.type }}</span>
            </div>
            <div class="rl-card-meta">
              <span class="rl-card-id">#{{ run.id.slice(0, 8) }}</span>
              <span class="rl-card-time">{{ formatTime(run.startedAt) }}</span>
              <span v-if="run.duration" class="rl-card-duration">{{ formatDuration(run.duration) }}</span>
            </div>
          </div>
        </div>

        <div class="rl-card-right">
          <span class="c-badge" :class="statusBadge(run.status)">
            {{ statusLabel(run.status) }}
          </span>
          <div class="rl-card-actions">
            <button
              class="c-btn c-btn-ghost c-btn-icon c-btn-sm"
              title="View details"
              @click="$emit('viewRun', run.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              v-if="run.status === 'running'"
              class="c-btn c-btn-danger c-btn-icon c-btn-sm"
              title="Cancel"
              @click="$emit('cancelRun', run.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PipelineRun } from '@/entities/pipeline/api'

const props = defineProps<{
  runs: PipelineRun[]
  loading: boolean
}>()

defineEmits<{
  (e: 'viewRun', id: string): void
  (e: 'cancelRun', id: string): void
}>()

const activeFilter = ref('all')

const filters = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

const filteredRuns = computed(() => {
  if (activeFilter.value === 'all') return props.runs
  return props.runs.filter(r => r.status === activeFilter.value)
})

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    running: 'c-badge-info',
    completed: 'c-badge-success',
    failed: 'c-badge-error',
    cancelled: 'c-badge-warning',
    queued: 'c-badge-neutral',
  }
  return map[status] || 'c-badge-neutral'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    running: 'Running',
    completed: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
    queued: 'Queued',
  }
  return map[status] || status
}

function formatTime(ts?: string): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString()
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
</script>

<style scoped>
.rl-root {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
}

.rl-filters {
  display: flex;
  gap: var(--sp-1);
}

.rl-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.rl-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  gap: var(--sp-3);
}

.rl-card-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}

.rl-card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rl-dot-running {
  background: var(--status-running);
  animation: c-pulse 1.5s ease-in-out infinite;
}
.rl-dot-completed { background: var(--status-success); }
.rl-dot-failed { background: var(--status-error); }
.rl-dot-cancelled { background: var(--status-warning); }
.rl-dot-queued { background: var(--fg-muted); }

.rl-card-info {
  min-width: 0;
}

.rl-card-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.rl-card-target {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
  font-family: var(--font-mono);
}

.rl-card-type {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  padding: 1px var(--sp-2);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

.rl-card-meta {
  display: flex;
  gap: var(--sp-3);
  font-size: var(--text-xs);
  color: var(--fg-muted);
  margin-top: var(--sp-1);
}

.rl-card-id {
  font-family: var(--font-mono);
}

.rl-card-right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-shrink: 0;
}

.rl-card-actions {
  display: flex;
  gap: var(--sp-1);
}
</style>
