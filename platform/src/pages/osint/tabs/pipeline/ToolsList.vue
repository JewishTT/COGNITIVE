<template>
  <div class="tl-root">
    <div v-if="tools.length === 0" class="c-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="c-empty-icon">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
      </svg>
      <p class="c-empty-text">No tools available. Check pipeline server connection.</p>
    </div>

    <div v-else class="tl-grid">
      <div
        v-for="tool in tools"
        :key="tool.name"
        class="tl-card"
        :class="{ 'tl-card-installed': tool.status === 'installed' }"
      >
        <div class="tl-card-header">
          <div class="tl-card-icon" :class="`tl-icon-${tool.category}`">
            <svg v-if="tool.category === 'collection'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="tl-card-info">
            <div class="tl-card-name">{{ tool.label || tool.name }}</div>
            <div class="tl-card-version">v{{ tool.version || '?' }}</div>
          </div>
          <span class="c-badge" :class="tool.status === 'installed' ? 'c-badge-success' : 'c-badge-neutral'">
            {{ tool.status === 'installed' ? 'Installed' : 'Available' }}
          </span>
        </div>

        <p class="tl-card-desc">{{ tool.description || 'No description' }}</p>

        <div class="tl-card-footer">
          <span class="tl-card-category">{{ tool.category }}</span>
          <button
            v-if="tool.status !== 'installed'"
            class="c-btn c-btn-primary c-btn-sm"
            :disabled="installing === tool.name"
            @click="$emit('install', tool.name)"
          >
            {{ installing === tool.name ? 'Installing…' : 'Install' }}
          </button>
          <span v-else class="tl-card-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineTool } from '@/entities/pipeline/api'

defineProps<{
  tools: PipelineTool[]
  installing: string
}>()

defineEmits<{
  (e: 'install', name: string): void
}>()
</script>

<style scoped>
.tl-root {
  padding: var(--sp-3) 0;
}

.tl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--sp-3);
}

.tl-card {
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  transition: border-color var(--duration-fast) var(--ease-default);
}

.tl-card:hover {
  border-color: var(--border-strong);
}

.tl-card-installed {
  border-color: rgba(63, 185, 80, 0.3);
}

.tl-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
}

.tl-card-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tl-icon-collection {
  background: rgba(0, 212, 255, 0.1);
  color: var(--accent);
}

.tl-icon-extraction {
  background: rgba(188, 140, 255, 0.1);
  color: var(--node-domain);
}

.tl-card-info {
  flex: 1;
  min-width: 0;
}

.tl-card-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
}

.tl-card-version {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.tl-card-desc {
  font-size: var(--text-sm);
  color: var(--fg-secondary);
  margin: 0;
  line-height: 1.5;
  flex: 1;
}

.tl-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--sp-2);
  border-top: 1px solid var(--border-subtle);
}

.tl-card-category {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tl-card-check {
  display: flex;
  align-items: center;
}
</style>
