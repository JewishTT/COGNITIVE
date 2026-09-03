<template>
  <div class="gw-root">
    <!-- Toolbar -->
    <div class="gw-toolbar">
      <div class="gw-toolbar-left">
        <!-- TDA toggle -->
        <button
          class="c-btn c-btn-ghost c-btn-sm"
          :class="{ 'gw-btn-active': showTda }"
          :disabled="!sketchId || !currentGraph || currentGraph.nds.length === 0"
          @click="$emit('toggleTda')"
          title="TDA Overlay"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          TDA
        </button>

        <span class="gw-toolbar-sep" />

        <!-- TheBigBrother input -->
        <div class="gw-tbb-group">
          <input
            v-model="tbbTarget"
            class="c-input c-input-sm"
            placeholder="username for TheBigBrother"
            :disabled="!sketchId || tbbBusy"
            @keyup.enter="runTbb"
          />
          <button
            class="c-btn c-btn-primary c-btn-sm"
            :disabled="!sketchId || !tbbTarget.trim() || tbbBusy"
            @click="runTbb"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            {{ tbbBusy ? 'Running…' : 'TBB' }}
          </button>
        </div>

        <span class="gw-toolbar-sep" />

        <!-- Edge mode -->
        <button
          class="c-btn c-btn-ghost c-btn-sm"
          :class="{ 'gw-btn-active': edgeMode }"
          :disabled="!sketchId"
          @click="edgeMode = !edgeMode"
          title="Add Edge"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {{ edgeMode ? 'Cancel' : 'Edge' }}
        </button>
      </div>

      <div class="gw-toolbar-right">
        <!-- Refresh -->
        <button
          class="c-btn c-btn-ghost c-btn-icon"
          :disabled="!sketchId || loading"
          @click="$emit('refresh')"
          title="Refresh graph"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'gw-spin': loading }">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
        </button>

        <!-- Fit view -->
        <button
          class="c-btn c-btn-ghost c-btn-icon"
          :disabled="!sketchId"
          @click="$emit('fitView')"
          title="Fit view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Canvas area -->
    <div class="gw-canvas-wrap" :class="{ 'gw-edge-mode': edgeMode }">
      <!-- Empty state -->
      <div v-if="!sketchId" class="gw-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="gw-empty-icon">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
        <p class="gw-empty-text">Select or create a sketch to start</p>
      </div>

      <!-- Loading overlay -->
      <div v-else-if="loading" class="gw-loading">
        <div class="gw-spinner" />
        <span>Loading graph…</span>
      </div>

      <!-- Graph canvas (existing widget) -->
      <GraphCanvas
        v-else
        ref="graphCanvasRef"
        :sketch-id="sketchId"
        :highlight-ids="highlightIds"
        @graph="(g) => $emit('graph', g)"
        @selection="(n, e) => $emit('selection', n, e)"
        @tbb-state="(b) => $emit('tbbState', b)"
      />

      <!-- TDA overlay -->
      <transition name="fade">
        <TdaLayer
          v-if="showTda && sketchId && currentGraph && currentGraph.nds.length > 0"
          :graph="currentGraph"
          :highlight-ids="highlightIds"
          @highlight="(ids) => $emit('highlight', ids)"
          @clear="() => $emit('clearHighlight')"
          class="gw-tda-overlay"
        />
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GraphCanvas from '@/widgets/graph-canvas/index.vue'
import TdaLayer from '@/widgets/tda-layer/index.vue'
import { runTheBigBrother } from '@/features/enricher-run/model'
import type { GraphData } from '@/shared/api/types'

const props = defineProps<{
  sketchId: string | null
  currentGraph: GraphData | null
  highlightIds: string[]
  selectedNodeIds: string[]
  loading: boolean
  showTda: boolean
}>()

const emit = defineEmits<{
  (e: 'graph', g: GraphData): void
  (e: 'selection', nodes: string[], edges: string[]): void
  (e: 'tbbState', busy: boolean): void
  (e: 'toggleTda'): void
  (e: 'refresh'): void
  (e: 'fitView'): void
  (e: 'highlight', ids: string[]): void
  (e: 'clearHighlight'): void
}>()

const graphCanvasRef = ref<InstanceType<typeof GraphCanvas> | null>(null)
const tbbTarget = ref('')
const edgeMode = ref(false)
const tbbBusy = ref(false)

async function runTbb() {
  if (!tbbTarget.value.trim() || !props.sketchId) return
  tbbBusy.value = true
  emit('tbbState', true)
  try {
    const g = await runTheBigBrother(tbbTarget.value.trim(), props.sketchId)
    emit('graph', g)
    tbbTarget.value = ''
  } catch (e) {
    console.error('TBB failed:', e)
  } finally {
    tbbBusy.value = false
    emit('tbbState', false)
  }
}

defineExpose({
  loadGraph: () => graphCanvasRef.value?.loadGraph?.(),
  fitView: () => graphCanvasRef.value?.fitView?.(),
})
</script>

<style scoped>
.gw-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Toolbar ──────────────────────────────────────────────── */
.gw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-subtle);
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.gw-toolbar-left,
.gw-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.gw-toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--border-default);
}

.gw-btn-active {
  background: var(--surface-active);
  color: var(--accent);
  border-color: rgba(0, 212, 255, 0.2);
}

/* ── TBB input group ──────────────────────────────────────── */
.gw-tbb-group {
  display: flex;
  gap: var(--sp-1);
}

.gw-tbb-group .c-input {
  width: 180px;
}

.gw-tbb-group .c-input-sm {
  padding: var(--sp-1) var(--sp-2);
  font-size: var(--text-xs);
}

/* ── Canvas ───────────────────────────────────────────────── */
.gw-canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--surface-0);
  overflow: hidden;
}

.gw-edge-mode {
  cursor: crosshair;
}

/* ── Empty state ──────────────────────────────────────────── */
.gw-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--sp-3);
  color: var(--fg-muted);
}

.gw-empty-icon {
  opacity: 0.3;
}

.gw-empty-text {
  font-size: var(--text-sm);
  margin: 0;
}

/* ── Loading ──────────────────────────────────────────────── */
.gw-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  background: rgba(5, 5, 10, 0.7);
  color: var(--fg-muted);
  font-size: var(--text-sm);
  z-index: 10;
}

.gw-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: gw-spin 0.8s linear infinite;
}

@keyframes gw-spin {
  to { transform: rotate(360deg); }
}

.gw-spin {
  animation: gw-spin 0.8s linear infinite;
}

/* ── TDA overlay ──────────────────────────────────────────── */
.gw-tda-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

/* ── Transitions ──────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-default);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
