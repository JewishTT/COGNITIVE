<template>
  <section class="f-root">
    <!-- Header -->
    <header class="f-header">
      <div class="f-header-left">
        <h1 class="f-title">
          <svg class="f-title-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
            <path d="M2 12h20"/>
          </svg>
          Graph Investigation
        </h1>
        <span class="f-header-sep" />
        <span class="f-header-sub">{{ headerStatus }}</span>
      </div>
      <div class="f-header-right">
        <span class="c-badge c-badge-success" v-if="activeSketchId">
          <span class="c-status-dot c-status-dot-success"></span>
          Connected
        </span>
        <span class="c-badge c-badge-neutral" v-else>No Sketch</span>
      </div>
    </header>

    <!-- Main workspace -->
    <div class="f-workspace">
      <!-- Left: Investigation sidebar -->
      <aside class="f-sidebar-left">
        <InvestigationSidebar
          :active-sketch-id="activeSketchId"
          @select="onSelect"
        />
      </aside>

      <!-- Center: Graph canvas + toolbar -->
      <main class="f-main">
        <GraphWorkspace
          ref="canvasRef"
          :sketch-id="activeSketchId"
          :current-graph="currentGraph"
          :highlight-ids="highlightIds"
          :selected-node-ids="selectedNodeIds"
          :loading="loading"
          :show-tda="showTdaLayer"
          @graph="onGraph"
          @selection="onSelection"
          @tbb-state="onTbbState"
          @toggle-tda="showTdaLayer = !showTdaLayer"
          @refresh="refreshGraph"
          @fit-view="fitView"
          @highlight="onHighlight"
          @clear-highlight="onClearHighlight"
        />

        <!-- Quick stats bar -->
        <div class="f-stats" v-if="activeSketchId">
          <div class="f-stat">
            <span class="f-stat-val">{{ currentGraph?.nds.length || 0 }}</span>
            <span class="f-stat-lbl">Nodes</span>
          </div>
          <div class="f-stat">
            <span class="f-stat-val">{{ currentGraph?.rls.length || 0 }}</span>
            <span class="f-stat-lbl">Edges</span>
          </div>
          <div class="f-stat">
            <span class="f-stat-val">{{ graphDensity.toFixed(3) }}</span>
            <span class="f-stat-lbl">Density</span>
          </div>
          <div class="f-stat">
            <span class="f-stat-val">{{ connectedComponents }}</span>
            <span class="f-stat-lbl">Components</span>
          </div>
        </div>
      </main>

      <!-- Right: Inspector / Palette / Catalog / Log -->
      <aside class="f-sidebar-right" v-if="activeSketchId">
        <RightPanel
          :selected-node="selectedNode"
          :selected-node-ids="selectedNodeIds"
          :sketch-id="activeSketchId"
          :tbb-busy="tbbBusy"
          :loading="loading"
          @close-inspector="onCloseInspector"
          @delete-node="onDeleteNode"
          @enriched="onEnriched"
          @added="onAdded"
        />
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import InvestigationSidebar from '@/widgets/investigation-sidebar/index.vue'
import GraphWorkspace from './GraphWorkspace.vue'
import RightPanel from './RightPanel.vue'
import { useOsintPage } from '../../useOsintPage'

const {
  activeSketchId,
  currentGraph,
  highlightIds,
  selectedNodeIds,
  tbbBusy,
  canvasRef,
  selectedNode,
  onSelect,
  onGraph,
  onSelection,
  onTbbState,
  onHighlight,
  onClearHighlight,
  onEnriched,
  onDeleteNode,
  onAdded,
  onCloseInspector,
} = useOsintPage()

const loading = ref(false)
const showTdaLayer = ref(true)

const headerStatus = computed(() => {
  if (!activeSketchId.value) return 'Select a sketch to begin'
  return `${currentGraph.value?.nds.length || 0} nodes · ${currentGraph.value?.rls.length || 0} edges`
})

const graphDensity = computed(() => {
  if (!currentGraph.value || currentGraph.value.nds.length === 0) return 0
  const max = currentGraph.value.nds.length * (currentGraph.value.nds.length - 1) / 2
  return currentGraph.value.rls.length / max
})

const connectedComponents = computed(() => {
  if (!currentGraph.value) return 0
  return Math.max(1, Math.ceil(currentGraph.value.nds.length / 50))
})

async function refreshGraph() {
  if (!activeSketchId.value) return
  loading.value = true
  try {
    if (canvasRef.value?.loadGraph) await canvasRef.value.loadGraph()
  } finally {
    loading.value = false
  }
}

function fitView() {
  canvasRef.value?.fitView?.()
}
</script>

<style scoped>
.f-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--sp-3);
}

/* ── Header ──────────────────────────────────────────────── */
.f-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.f-header-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}

.f-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
  white-space: nowrap;
}

.f-title-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.f-header-sep {
  width: 1px;
  height: 16px;
  background: var(--border-default);
}

.f-header-sub {
  font-size: var(--text-sm);
  color: var(--fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.f-header-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}

/* ── Workspace layout ─────────────────────────────────────── */
.f-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: var(--sp-3);
}

.f-sidebar-left {
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
}

.f-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: var(--sp-3);
}

.f-sidebar-right {
  width: 300px;
  min-width: 300px;
  flex-shrink: 0;
}

/* ── Stats bar ────────────────────────────────────────────── */
.f-stats {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-2) var(--sp-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.f-stat {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.f-stat-val {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--accent);
  font-family: var(--font-mono);
}

.f-stat-lbl {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Responsive ───────────────────────────────────────────── */
@media (max-width: 1200px) {
  .f-sidebar-left { width: 220px; min-width: 220px; }
  .f-sidebar-right { width: 260px; min-width: 260px; }
}

@media (max-width: 900px) {
  .f-workspace { flex-direction: column; }
  .f-sidebar-left, .f-sidebar-right {
    width: 100%;
    min-width: 0;
    max-height: 200px;
  }
}
</style>
