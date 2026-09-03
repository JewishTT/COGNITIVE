<template>
  <div class="rp-root">
    <!-- Node Inspector (shown when node selected) -->
    <transition name="slide">
      <div v-if="selectedNode" class="c-panel">
        <div class="c-panel-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Inspector
          <button class="c-btn c-btn-ghost c-btn-icon c-btn-sm u-ml-auto" @click="$emit('closeInspector')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="c-panel-body rp-inspector">
          <div class="rp-inspector-head">
            <span class="rp-node-dot" :style="{ background: getNodeColor(selectedNode) }" />
            <span class="rp-node-label">{{ selectedNode.nodeLabel }}</span>
            <span class="c-badge c-badge-info">{{ selectedNode.nodeType }}</span>
          </div>
          <div class="rp-props">
            <div v-for="(val, key) in selectedNode.nodeProperties" :key="key" class="rp-prop">
              <span class="rp-prop-key">{{ key }}</span>
              <span class="rp-prop-val">{{ val }}</span>
            </div>
          </div>
          <button class="c-btn c-btn-danger c-btn-sm u-w-full u-mt-2" @click="$emit('deleteNode', selectedNode.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Delete Node
          </button>
        </div>
      </div>
    </transition>

    <!-- Type Palette -->
    <div class="c-panel">
      <div class="c-panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        Types
      </div>
      <div class="c-panel-body">
        <TypePalette :sketch-id="sketchId" @added="$emit('added')" />
      </div>
    </div>

    <!-- Enricher Catalog -->
    <div class="c-panel">
      <div class="c-panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Enrichers
      </div>
      <div class="c-panel-body">
        <EnricherCatalog
          :sketch-id="sketchId"
          :node-ids="selectedNodeIds"
          :disabled="tbbBusy || loading"
          @enriched="(g) => $emit('enriched', g)"
        />
      </div>
    </div>

    <!-- Event Log -->
    <div class="c-panel rp-log">
      <div class="c-panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Event Log
      </div>
      <div class="c-panel-body">
        <EventLog :sketch-id="sketchId" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TypePalette from '@/widgets/type-palette/index.vue'
import EnricherCatalog from '@/widgets/enricher-catalog/index.vue'
import EventLog from '@/widgets/event-log/index.vue'
import type { GraphNode } from '@/shared/api/types'

defineProps<{
  selectedNode: GraphNode | null
  selectedNodeIds: string[]
  sketchId: string
  tbbBusy: boolean
  loading: boolean
}>()

defineEmits<{
  (e: 'closeInspector'): void
  (e: 'deleteNode', id: string): void
  (e: 'enriched', g: any): void
  (e: 'added'): void
}>()

const nodeColorMap: Record<string, string> = {
  person: 'var(--node-person)',
  username: 'var(--node-username)',
  email: 'var(--node-email)',
  phone: 'var(--node-phone)',
  domain: 'var(--node-domain)',
  ip: 'var(--node-ip)',
  company: 'var(--node-company)',
  organization: 'var(--node-company)',
  location: 'var(--node-location)',
  document: 'var(--node-document)',
}

function getNodeColor(node: GraphNode): string {
  return nodeColorMap[node.nodeType?.toLowerCase()] || 'var(--accent)'
}
</script>

<style scoped>
.rp-root {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  overflow-y: auto;
}

/* ── Inspector ────────────────────────────────────────────── */
.rp-inspector {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.rp-inspector-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--border-subtle);
}

.rp-node-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rp-node-label {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-props {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.rp-prop {
  display: flex;
  gap: var(--sp-2);
  font-size: var(--text-xs);
  padding: var(--sp-1) 0;
  border-top: 1px dashed var(--border-subtle);
}

.rp-prop-key {
  color: var(--fg-muted);
  min-width: 80px;
  flex-shrink: 0;
}

.rp-prop-val {
  color: var(--fg-primary);
  word-break: break-word;
  font-family: var(--font-mono);
}

/* ── Log panel ────────────────────────────────────────────── */
.rp-log {
  margin-top: auto;
  min-height: 120px;
  max-height: 200px;
}

/* ── Transition ───────────────────────────────────────────── */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--duration-normal) var(--ease-default);
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
