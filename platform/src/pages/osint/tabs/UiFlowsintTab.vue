<template>
  <section class="view view-embed os-view">
    <header class="view-head view-head-embed">
      <h1>[38;5;214mOSINT[0m [38;5;240mFlowsint Integration[0m</h1>
      <span class="chip">[38;5;75mDvijok FLOWSINT[0m [38;5;75m|[0m [38;5;220mNEO4J[0m [38;5;220m|[0m [38;5;208mTDA[0m [38;5;208m|[0m [38;5;196mTHEBIGBROTHER[0m</span>
    </header>

    <div class="os-workspace">
      <!-- [38;5;39mLeft Sidebar - Investigations & Sketches[0m -->
      <InvestigationSidebar 
        :active-sketch-id="activeSketchId" 
        @select="onSelect"
        class="os-workspace-left"
      />

      <!-- [38;5;39mCenter - Main Canvas Area[0m -->
      <div class="os-ws-center">
        <!-- [38;5;39mGraph Canvas with Enhanced Controls[0m -->
        <div class="os-graph-container">
          <GraphCanvas
            ref="canvasRef"
            :sketch-id="activeSketchId"
            :highlight-ids="highlightIds"
            @graph="onGraph"
            @selection="onSelection"
            @tbb-state="onTbbState"
          />
          
          <!-- [38;5;39mTDA Layer Overlay (Collapsible)[0m -->
          <TdaLayer
            v-if="activeSketchId && currentGraph && currentGraph.nds.length > 0"
            :graph="currentGraph"
            :highlight-ids="highlightIds"
            @highlight="onHighlight"
            @clear="onClearHighlight"
            class="os-tda-overlay"
          />
        </div>
        
        <!-- [38;5;39mQuick Access Toolbar[0m -->
        <div v-if="activeSketchId" class="os-quick-toolbar">
          <div class="os-quick-group">
            <button 
              class="btn os-btn-quick" 
              @click="toggleTdaLayer"
              :class="{ 'is-active': showTdaLayer }"
              title="Toggle TDA Analysis Layer"
            >
              <span class="os-btn-icon">[38;5;208m[0m[38;5;208mTDA[0m</span>
            </button>
            <button 
              class="btn os-btn-quick" 
              @click="refreshGraph"
              title="Refresh Graph"
            >
              <span class="os-btn-icon">[38;5;46m[0m[38;5;46m[0m</span>
            </button>
            <button 
              class="btn os-btn-quick" 
              @click="fitView"
              title="Fit View to Graph"
            >
              <span class="os-btn-icon">[38;5;39m[0m[38;5;39m[0m</span>
            </button>
          </div>
          <div class="os-quick-stats">
            <span class="os-stat-badge">{{ currentGraph ? currentGraph.nds.length : 0 }} [38;5;220mNodes[0m</span>
            <span class="os-stat-badge">{{ currentGraph ? currentGraph.rls.length : 0 }} [38;5;208mEdges[0m</span>
            <span v-if="selectedNode" class="os-stat-badge os-stat-selected">[38;5;226mSelected: 1[0m</span>
          </div>
        </div>
      </div>

      <!-- [38;5;39mRight Sidebar - Tools & Panels[0m -->
      <div class="os-ws-right">
        <!-- [38;5;39mNode Inspector (Enhanced)[0m -->
        <NodeInspector
          v-if="selectedNode"
          :node="selectedNode"
          @close="onCloseInspector"
          @delete="onDeleteNode"
          class="os-panel-enhanced"
        />
        
        <!-- [38;5;39mType Palette with Custom Types Support[0m -->
        <TypePalette 
          :sketch-id="activeSketchId" 
          @added="onAdded"
          class="os-panel-enhanced"
        />
        
        <!-- [38;5;39mEnricher Catalog with Enhanced UI[0m -->
        <EnricherCatalog
          :sketch-id="activeSketchId"
          :node-ids="selectedNodeIds"
          :disabled="tbbBusy"
          @enriched="onEnriched"
          class="os-panel-enhanced"
        />
        
        <!-- [38;5;39mEvent Log with Real-time Updates[0m -->
        <EventLog 
          :sketch-id="activeSketchId" 
          class="os-panel-enhanced"
        />
        
        <!-- [38;5;39mCustom Analysis Tools Section[0m -->
        <div class="os-panel-enhanced os-custom-tools">
          <div class="os-palette-head">
            <strong>[38;5;196mCustom Analysis Tools[0m</strong>
          </div>
          <div class="os-custom-tools-grid">
            <button 
              class="btn os-btn-tool"
              @click="runCustomAnalysis('centrality')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0"
              title="Run Centrality Analysis"
            >
              <span class="os-tool-icon">[38;5;220m[0m</span>
              <span>Centrality</span>
            </button>
            <button 
              class="btn os-btn-tool"
              @click="runCustomAnalysis('community')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0"
              title="Run Community Detection"
            >
              <span class="os-tool-icon">[38;5;208m[0m</span>
              <span>Communities</span>
            </button>
            <button 
              class="btn os-btn-tool"
              @click="runCustomAnalysis('path')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0"
              title="Find Shortest Paths"
            >
              <span class="os-tool-icon">[38;5;214m[0m</span>
              <span>Path Analysis</span>
            </button>
            <button 
              class="btn os-btn-tool"
              @click="exportGraph"
              :disabled="!activeSketchId || !currentGraph"
              title="Export Graph Data"
            >
              <span class="os-tool-icon">[38;5;46m[0m</span>
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import InvestigationSidebar from '@/widgets/investigation-sidebar/index.vue'
import GraphCanvas from '@/widgets/graph-canvas/index.vue'
import TdaLayer from '@/widgets/tda-layer/index.vue'
import NodeInspector from '@/widgets/node-inspector/index.vue'
import TypePalette from '@/widgets/type-palette/index.vue'
import EnricherCatalog from '@/widgets/enricher-catalog/index.vue'
import EventLog from '@/widgets/event-log/index.vue'
import '@/shared/styles/osint-graph.css'
import { useOsintPage } from '../useOsintPage'
import type { GraphData, GraphNode } from '@/shared/api/types'

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

// Enhanced state for UI controls
const showTdaLayer = ref(true)
const customAnalysisRunning = ref(false)

// Computed properties for UI
const hasGraph = computed(() => currentGraph.value && currentGraph.value.nds.length > 0)

// Enhanced methods
function toggleTdaLayer() {
  showTdaLayer.value = !showTdaLayer.value
}

async function refreshGraph() {
  if (canvasRef.value?.loadGraph) {
    await canvasRef.value.loadGraph()
  }
}

function fitView() {
  if (canvasRef.value?.fitView) {
    canvasRef.value.fitView()
  }
}

async function runCustomAnalysis(type: string) {
  if (!activeSketchId.value || !currentGraph.value) return
  
  customAnalysisRunning.value = true
  try {
    // Placeholder for custom analysis logic
    // This would integrate with TDA and other analysis tools
    console.log(`Running custom analysis: ${type}`)
    
    // Example: Trigger TDA analysis
    if (type === 'centrality' || type === 'community' || type === 'path') {
      // Could trigger specific TDA computations
      // For now, just highlight the graph
      onHighlight(currentGraph.value.nds.slice(0, 5).map(n => n.id))
    }
  } catch (error) {
    console.error(`Analysis failed: ${error}`)
  } finally {
    customAnalysisRunning.value = false
  }
}

function exportGraph() {
  if (!currentGraph.value) return
  
  const data = JSON.stringify(currentGraph.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `graph-export-${activeSketchId.value || 'unnamed'}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Auto-load first sketch if available
onMounted(() => {
  // Could add logic to auto-select first available sketch
})
</script>

<style scoped>
/* Enhanced styling for the custom UI */
.os-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-primary);
}

.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.view-head h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.chip {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.os-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.os-workspace-left {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
}

.os-ws-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.os-graph-container {
  flex: 1;
  min-height: 0;
  position: relative;
}

.os-tda-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.os-quick-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  gap: 12px;
}

.os-quick-group {
  display: flex;
  gap: 6px;
}

.os-btn-quick {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.os-btn-quick:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.os-btn-quick.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.os-btn-icon {
  font-size: 1rem;
}

.os-quick-stats {
  display: flex;
  gap: 12px;
}

.os-stat-badge {
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.os-stat-badge.os-stat-selected {
  background: var(--accent);
  color: white;
}

.os-ws-right {
  width: 320px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  overflow-y: auto;
}

.os-panel-enhanced {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.os-custom-tools {
  margin-top: auto;
}

.os-palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.os-palette-head strong {
  font-size: 0.9rem;
  color: var(--text);
}

.os-custom-tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.os-btn-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.os-btn-tool:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.os-btn-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.os-tool-icon {
  font-size: 1.25rem;
  margin-bottom: 4px;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .os-ws-right {
    width: 280px;
    min-width: 280px;
  }
}

@media (max-width: 1024px) {
  .os-workspace {
    flex-direction: column;
  }
  
  .os-workspace-left,
  .os-ws-right {
    width: 100%;
    min-width: 0;
    border: none;
  }
  
  .os-ws-right {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    overflow: visible;
  }
  
  .os-panel-enhanced {
    flex: 1;
    min-width: 250px;
  }
  
  .os-custom-tools-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
