<template>
  <div class="rd-root">
    <!-- Header -->
    <div class="rd-header">
      <div class="rd-header-left">
        <button class="c-btn c-btn-ghost c-btn-sm" @click="$router.back()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <span class="rd-header-sep" />
        <span class="rd-header-title">
          Run <span class="rd-header-id">#{{ run.id.slice(0, 8) }}</span>
        </span>
      </div>
      <div class="rd-header-right">
        <span class="c-badge" :class="statusBadge(run.status)">
          <span class="c-status-dot" :class="`c-status-dot-${run.status === 'running' ? 'running' : run.status === 'completed' ? 'success' : 'error'}`" />
          {{ statusLabel(run.status) }}
        </span>
        <button
          v-if="run.status === 'running'"
          class="c-btn c-btn-danger c-btn-sm"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Info grid -->
    <div class="rd-info">
      <div class="rd-info-item">
        <span class="rd-info-label">Target</span>
        <span class="rd-info-value rd-mono">{{ run.target }}</span>
      </div>
      <div class="rd-info-item">
        <span class="rd-info-label">Type</span>
        <span class="rd-info-value">{{ run.type }}</span>
      </div>
      <div class="rd-info-item">
        <span class="rd-info-label">Started</span>
        <span class="rd-info-value">{{ formatTime(run.startedAt) }}</span>
      </div>
      <div class="rd-info-item">
        <span class="rd-info-label">Duration</span>
        <span class="rd-info-value">{{ run.duration ? formatDuration(run.duration) : '—' }}</span>
      </div>
      <div v-if="run.nodesCollected" class="rd-info-item">
        <span class="rd-info-label">Nodes</span>
        <span class="rd-info-value rd-accent">{{ run.nodesCollected }}</span>
      </div>
      <div v-if="run.edgesCollected" class="rd-info-item">
        <span class="rd-info-label">Edges</span>
        <span class="rd-info-value rd-accent">{{ run.edgesCollected }}</span>
      </div>
    </div>

    <!-- Live log -->
    <div class="rd-log">
      <div class="rd-log-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        Live Log
      </div>
      <div class="rd-log-body c-scroll">
        <div v-if="liveLog.length === 0" class="rd-log-empty">
          Waiting for output…
        </div>
        <div v-else class="rd-log-lines">
          <div v-for="(line, i) in liveLog" :key="i" class="rd-log-line">
            {{ line }}
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <div v-if="run.errors?.length" class="rd-errors">
      <div class="rd-errors-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        Errors
      </div>
      <div v-for="(err, i) in run.errors" :key="i" class="rd-error-line">
        {{ err }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineRun } from '@/entities/pipeline/api'

defineProps<{
  run: PipelineRun
  liveLog: string[]
}>()

defineEmits<{
  (e: 'cancel'): void
}>()

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    running: 'c-badge-info',
    completed: 'c-badge-success',
    failed: 'c-badge-error',
    cancelled: 'c-badge-warning',
  }
  return map[status] || 'c-badge-neutral'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}

function formatTime(ts?: string): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
</script>

<style scoped>
.rd-root {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
}

/* ── Header ──────────────────────────────────────────────── */
.rd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.rd-header-left {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.rd-header-sep {
  width: 1px;
  height: 16px;
  background: var(--border-default);
}

.rd-header-title {
  font-size: var(--text-base);
  color: var(--fg-secondary);
}

.rd-header-id {
  font-family: var(--font-mono);
  color: var(--fg-primary);
}

.rd-header-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* ── Info ─────────────────────────────────────────────────── */
.rd-info {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--sp-2);
}

.rd-info-item {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-3);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.rd-info-label {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rd-info-value {
  font-size: var(--text-base);
  color: var(--fg-primary);
}

.rd-mono {
  font-family: var(--font-mono);
}

.rd-accent {
  color: var(--accent);
  font-weight: var(--weight-bold);
}

/* ── Log ──────────────────────────────────────────────────── */
.rd-log {
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.rd-log-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-sm);
  color: var(--fg-secondary);
}

.rd-log-body {
  padding: var(--sp-3);
  max-height: 300px;
  overflow-y: auto;
  background: var(--surface-0);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.rd-log-empty {
  color: var(--fg-muted);
  text-align: center;
  padding: var(--sp-4);
}

.rd-log-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rd-log-line {
  color: var(--fg-secondary);
  line-height: 1.6;
  word-break: break-all;
}

/* ── Errors ───────────────────────────────────────────────── */
.rd-errors {
  background: rgba(248, 81, 73, 0.05);
  border: 1px solid rgba(248, 81, 73, 0.2);
  border-radius: var(--radius-lg);
}

.rd-errors-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid rgba(248, 81, 73, 0.1);
  font-size: var(--text-sm);
  color: var(--status-error);
  font-weight: var(--weight-semibold);
}

.rd-error-line {
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--status-error);
  border-top: 1px solid rgba(248, 81, 73, 0.05);
}
</style>
