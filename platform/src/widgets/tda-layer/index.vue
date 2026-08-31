<template>
  <div class="os-tda-container" :class="{ 'os-tda-expanded': expanded }">
    <!-- Header with Toggle -->
    <div 
      class="os-tda-header" 
      @click="toggleExpanded"
      :title="expanded ? 'Collapse TDA Layer' : 'Expand TDA Layer'"
    >
      <div class="os-tda-header-content">
        <span class="os-tda-title">
          <span class="os-tda-icon">[38;5;208m[0m</span>
          TDA-[38;5;220m[0m[38;5;220mLayer[0m
        </span>
        <span class="os-tda-subtitle">[38;5;240mSimplicial Complex Analysis[0m</span>
      </div>
      <span class="os-tda-toggle">
        {{ expanded ? '[38;5;220m[0m[38;5;220m[0m' : '[38;5;220m[0m[38;5;220m[0m' }}
      </span>
    </div>

    <!-- Main Content Area -->
    <div v-if="expanded" class="os-tda-content">
      <!-- Stats Overview -->
      <div v-if="graph && graph.nds.length > 0" class="os-tda-stats">
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;220m{{ tdaResult?.nodeCount || graph.nds.length }}[0m</span>
          <span class="os-tda-stat-label">Nodes</span>
        </div>
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;208m{{ tdaResult?.edgeCount || graph.rls.length }}[0m</span>
          <span class="os-tda-stat-label">Edges</span>
        </div>
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;196m{{ tdaResult?.h0 || 0 }}[0m</span>
          <span class="os-tda-stat-label">H0 (Components)</span>
        </div>
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;214m{{ tdaResult?.h1 || 0 }}[0m</span>
          <span class="os-tda-stat-label">H1 (Cycles)</span>
        </div>
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;202m{{ tdaResult?.bridges?.length || 0 }}[0m</span>
          <span class="os-tda-stat-label">Bridges</span>
        </div>
        <div class="os-tda-stat">
          <span class="os-tda-stat-value">[38;5;196m{{ tdaResult?.cutVertices?.length || 0 }}[0m</span>
          <span class="os-tda-stat-label">Cut Vertices</span>
        </div>
      </div>

      <!-- 3D Visualization -->
      <div v-if="graph && graph.nds.length > 0" class="os-tda-visualization">
        <Tda3D 
          :graph="graph" 
          :highlight-ids="highlightIds"
          @highlight="$emit('highlight', $event)"
          @clear="$emit('clear')"
        />
      </div>
      <div v-else class="os-tda-empty">
        <div class="os-tda-empty-icon">[38;5;240m[0m</div>
        <p class="os-tda-empty-text">[38;5;240mNo graph data available[0m</p>
        <p class="os-tda-empty-hint">[38;5;240mLoad a sketch to enable TDA analysis[0m</p>
      </div>

      <!-- Analysis Controls -->
      <div class="os-tda-controls">
        <div class="os-tda-controls-group">
          <button 
            class="btn os-btn-tda" 
            @click="runTdaAnalysis"
            :disabled="!graph || graph.nds.length === 0 || analyzing"
          >
            <span v-if="!analyzing">[38;5;46m[0m Run Full Analysis</span>
            <span v-else>[38;5;220m[0m Analyzing...</span>
          </button>
          <button 
            class="btn os-btn-tda" 
            @click="clearHighlights"
            :disabled="highlightIds.length === 0"
          >
            Clear Highlights
          </button>
        </div>
        <div class="os-tda-controls-group">
          <select v-model="analysisMode" class="os-select-tda" :disabled="analyzing">
            <option value="flag">Flag Complex</option>
            <option value="dowker">Dowker Complex</option>
          </select>
        </div>
      </div>

      <!-- Detailed Results Panel -->
      <TdaPanel 
        v-if="tdaResult && graph && graph.nds.length > 0"
        :graph="graph"
        :result="tdaResult"
        :highlight-ids="highlightIds"
        @highlight="$emit('highlight', $event)"
        @clear="$emit('clear')"
        class="os-tda-panel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Tda3D from './Tda3D.vue'
import TdaPanel from './TdaPanel.vue'
import { analyzeTda, type TdaResult, type TdaNode, type TdaEdge } from '@/shared/lib/tda'
import type { GraphData } from '@/shared/api/types'

const props = defineProps<{ graph: GraphData | null; highlightIds?: string[] }>()

const emit = defineEmits<{ 
  (e: 'highlight', ids: string[]): void 
  (e: 'clear'): void 
}>()

// State
const expanded = ref(true)
const analyzing = ref(false)
const analysisMode = ref<'flag' | 'dowker'>('flag')
const tdaResult = ref<TdaResult | null>(null)

// Toggle expansion
function toggleExpanded() {
  expanded.value = !expanded.value
}

// Run TDA analysis
async function runTdaAnalysis() {
  if (!props.graph || props.graph.nds.length === 0) return
  
  analyzing.value = true
  try {
    const nodes: TdaNode[] = props.graph.nds.map(n => ({
      id: n.id,
      label: n.nodeLabel,
      type: n.nodeType,
      x: n.x || 0,
      y: n.y || 0
    }))
    
    const edges: TdaEdge[] = props.graph.rls.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label
    }))
    
    tdaResult.value = analyzeTda(nodes, edges, { mode: analysisMode.value })
    
    // Auto-highlight first component if available
    if (tdaResult.value.components && tdaResult.value.components.length > 0) {
      emit('highlight', tdaResult.value.components[0].nodeIds)
    }
  } catch (error) {
    console.error('TDA Analysis Error:', error)
  } finally {
    analyzing.value = false
  }
}

// Clear highlights
function clearHighlights() {
  emit('clear')
}

// Watch for graph changes
watch(
  () => props.graph,
  (newGraph) => {
    if (newGraph && newGraph.nds.length > 0) {
      // Auto-run basic analysis when graph loads
      runTdaAnalysis()
    } else {
      tdaResult.value = null
    }
  },
  { immediate: true }
)

// Watch for highlight changes
watch(
  () => props.highlightIds,
  (newHighlights) => {
    if (newHighlights && newHighlights.length > 0) {
      // Could auto-scroll to highlighted elements
    }
  }
)

// Computed properties
const hasData = computed(() => props.graph && props.graph.nds.length > 0)
</script>

<style scoped>
/* TDA Container */
.os-tda-container {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  overflow: hidden;
  transition: all 0.3s ease;
}

.os-tda-container.os-tda-expanded {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* Header */
.os-tda-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.os-tda-header:hover {
  background: var(--bg-hover);
}

.os-tda-header-content {
  display: flex;
  flex-direction: column;
}

.os-tda-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.os-tda-icon {
  font-size: 1.1rem;
}

.os-tda-subtitle {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.os-tda-toggle {
  font-size: 0.9rem;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.os-tda-container.os-tda-expanded .os-tda-toggle {
  transform: rotate(180deg);
}

/* Content Area */
.os-tda-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Stats Overview */
.os-tda-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.os-tda-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  text-align: center;
}

.os-tda-stat-value {
  font-size: 1.1rem;
  font-weight: 600;
}

.os-tda-stat-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Visualization */
.os-tda-visualization {
  height: 300px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-tertiary);
  overflow: hidden;
}

/* Empty State */
.os-tda-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}

.os-tda-empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.os-tda-empty-text {
  font-size: 1rem;
  margin: 0 0 8px 0;
}

.os-tda-empty-hint {
  font-size: 0.8rem;
  opacity: 0.7;
}

/* Controls */
.os-tda-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.os-tda-controls-group {
  display: flex;
  gap: 8px;
}

.os-btn-tda {
  padding: 8px 16px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.os-btn-tda:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.os-btn-tda:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.os-select-tda {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}

.os-select-tda:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Panel */
.os-tda-panel {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

/* Responsive */
@media (max-width: 1200px) {
  .os-tda-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .os-tda-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .os-tda-visualization {
    height: 200px;
  }
}
</style>
