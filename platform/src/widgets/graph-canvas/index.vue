<template>
  <div class="os-graph-wrap">
    <!-- Empty State -->
    <template v-if="!sketchId && flowNodes.length === 0">
      <div class="os-graph-empty os-graph-empty-demo">
        <div class="os-empty-icon"></div>
        <p>Start by creating or selecting a graph</p>

      </div>
    </template>

    <!-- Main Content -->
    <template v-else>
      <!-- Toolbar -->
      <div class="os-graph-toolbar">
        <div class="os-toolbar-left">
          <TdaButton 
            :active="tdaActive" 
            :disabled="!sketchId || flowNodes.length === 0"
            @toggle="toggleTda" 
          />
        </div>

        <div class="os-toolbar-center">
          <input
            v-model="tbbTarget"
            class="os-input os-tbb-input"
            placeholder="Username for TheBigBrother"
            :disabled="!sketchId || tbbBusy"
            @keyup.enter="runTheBigBrotherHandler"
          />
          <button
            class="btn os-btn-tbb"
            :disabled="!sketchId || tbbBusy || !tbbTarget"
            @click="runTheBigBrotherHandler"
            :title="sketchId ? 'Run TheBigBrother enricher' : 'Select a sketch first'"
          >
            {{ tbbBusy ? 'TBB...' : ' TBB' }}
          </button>
        </div>

        <div class="os-toolbar-right">
          <button 
            class="btn" 
            :class="{ 'os-btn-on': edgeMode }" 
            @click="toggleEdgeMode"
            title="Toggle Edge Creation Mode"
          >
            {{ edgeMode ? 'Cancel Edge' : 'Add Edge' }}
          </button>
          <button 
            class="btn" 
            @click="savePositions" 
            :disabled="saving"
            title="Save Node Positions"
          >
            {{ saving ? 'Saving...' : 'Save Layout' }}
          </button>
          <button 
            class="btn os-btn-danger" 
            :disabled="!selectedNode && !selectedEdge" 
            @click="deleteSelected"
            title="Delete Selected"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Hints -->
      <div class="os-graph-hints">
        <span v-if="edgeMode" class="os-hint">
          Click two nodes to create an edge
        </span>
        <span v-else-if="selectedNode" class="os-hint">
          Node selected: {{ selectedNode.nodeLabel }} ({{ selectedNode.nodeType }})
        </span>
        <span v-else-if="selectedEdge" class="os-hint">
          Edge selected: {{ selectedEdge.label }}
        </span>
        <span v-else class="os-hint">
          Click nodes to select | Double-click to add edge | Drag to move
        </span>
      </div>

      <!-- Graph Canvas -->
      <div class="os-graph-canvas" :class="{ 'os-edge-mode': edgeMode }">
        <VueFlow
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :default-viewport="{ zoom: 1 }"
          fit-view-on-init
          :min-zoom="0.2"
          :max-zoom="2.5"
          :delete-key-code="null"
          @node-click="onNodeClick"
          @node-drag-stop="onDragStop"
          @edge-click="onEdgeClick"
          @pane-click="onPaneClick"
          @node-double-click="removeEdgeMode"
        >
          <template #node-osnode="nodeProps">
            <OsNode :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>
          <Background :gap="22" :size="1.4" pattern-color="#1f2937" />
          <Controls position="bottom-left" />
          <MiniMap position="bottom-right" node-color="#22d3ee" mask-color="rgba(10,14,20,0.7)" />
        </VueFlow>
        
        <!-- TDA Overlay -->
        <div v-if="tdaActive" class="os-tda-overlay">
          <div class="os-tda-overlay-header">
            <span class="os-tda-overlay-title">  TDA Analysis</span>
            <button class="os-tda-overlay-close" @click="toggleTda">×</button>
          </div>
          <div class="os-tda-overlay-content">
            <div v-if="tdaAnalyzing" class="os-tda-overlay-loading">
              <span class="os-spinner"></span>
              Analyzing...
            </div>
            <div v-else-if="tdaResult" class="os-tda-overlay-stats">
              <div class="os-tda-overlay-stat">
                <span class="os-tda-overlay-stat-value">{{ tdaResult.h0 || 0 }}</span>
                <span class="os-tda-overlay-stat-label">Components</span>
              </div>
              <div class="os-tda-overlay-stat">
                <span class="os-tda-overlay-stat-value">{{ tdaResult.h1 || 0 }}</span>
                <span class="os-tda-overlay-stat-label">Cycles</span>
              </div>
              <div class="os-tda-overlay-stat">
                <span class="os-tda-overlay-stat-value">{{ tdaResult.bridges?.length || 0 }}</span>
                <span class="os-tda-overlay-stat-label">Bridges</span>
              </div>
            </div>
            <div v-else class="os-tda-overlay-empty">
              Click "Run Analysis" to analyze the graph
            </div>
            <button 
              class="btn os-btn-tda-run" 
              @click="runTdaAnalysis"
              :disabled="tdaAnalyzing || flowNodes.length === 0"
            >
              {{ tdaAnalyzing ? 'Analyzing...' : 'Run Analysis' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Bar -->
      <div v-if="sketchId" class="os-graph-stats">
        <div class="os-stat">
          <span class="os-stat-label">Nodes</span>
          <span class="os-stat-value">{{ flowNodes.length }}</span>
        </div>
        <div class="os-stat">
          <span class="os-stat-label">Edges</span>
          <span class="os-stat-value">{{ flowEdges.length }}</span>
        </div>
        <div class="os-stat">
          <span class="os-stat-label">Selected</span>
          <span class="os-stat-value">{{ selectedNodeIds.length }}</span>
        </div>
        <div v-if="edgeMode" class="os-stat os-stat-warning">
          <span class="os-stat-label">Edge Mode</span>
          <span class="os-stat-value">ON</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { VueFlow, useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { graphApi } from '@/entities/graph/api'
import { graphToFlow } from '@/entities/graph/lib/vueflow'
import { runTheBigBrother } from '@/features/enricher-run/model'
import { analyzeTda, type TdaResult, type TdaNode, type TdaEdge } from '@/shared/lib/tda'
import type { GraphData, GraphEdge, GraphNode } from '@/shared/api/types'
import TdaButton from './components/TdaButton.vue'

const props = defineProps<{ sketchId: string | null; highlightIds?: string[] }>()

const emit = defineEmits<{
  (e: 'graph', g: GraphData): void
  (e: 'selection', nodes: string[], edges: string[]): void
  (e: 'tbb-state', busy: boolean): void
}>()

// State
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
const edgeMode = ref(false)
const saving = ref(false)
const tbbBusy = ref(false)
const tbbTarget = ref('')
const selectedNodeId = ref<string | null>(null)
const selectedEdgeId = ref<string | null>(null)
const selectedNodeIds = ref<string[]>([])

// TDA State
const tdaActive = ref(false)
const tdaAnalyzing = ref(false)
const tdaResult = ref<TdaResult | null>(null)

const { fitView } = useVueFlow()

// Computed
const selectedNode = computed<GraphNode | null>(() => {
  const id = selectedNodeId.value
  if (!id) return null
  const graph = { nds: flowNodes.value.map(n => ({
    id: n.id,
    nodeLabel: (n.data as any)?.label || n.id,
    nodeType: (n.data as any)?.nodeType || 'unknown',
    nodeColor: (n.data as any)?.color || '#22d3ee',
  } as GraphNode)), rls: [] }
  return graph.nds.find(n => n.id === id) ?? null
})

const selectedEdge = computed<GraphEdge | null>(() => {
  const id = selectedEdgeId.value
  if (!id) return null
  return flowEdges.value.find(e => e.id === id) as unknown as GraphEdge ?? null
})

// Methods
function applyGraph(g: GraphData) {
  const flow = graphToFlow(g, props.highlightIds || [])
  flowNodes.value = flow.nds
  flowEdges.value = flow.rls
  emit('graph', g)
  requestAnimationFrame(() => fitView({ padding: 0.25 }))
}

async function loadGraph() {
  if (!props.sketchId) {
    flowNodes.value = []
    flowEdges.value = []
    emit('graph', { nds: [], rls: [] })
    return
  }
  try {
    applyGraph(await graphApi.get(props.sketchId))
  } catch (e) {
    console.error('load graph', e)
  }
}

async function runTheBigBrotherHandler() {
  const target = (tbbTarget.value || '').trim()
  if (!target || !props.sketchId || tbbBusy.value) return
  tbbBusy.value = true
  emit('tbb-state', true)
  try {
    const g = await runTheBigBrother(target, props.sketchId)
    applyGraph(g)
  } catch (e) {
    console.error(e)
  } finally {
    tbbBusy.value = false
    emit('tbb-state', false)
  }
}

function toggleEdgeMode() {
  edgeMode.value = !edgeMode.value
  selectedNodeId.value = null
  emitSelection()
}

function removeEdgeMode() {
  edgeMode.value = false
  selectedNodeId.value = null
  emitSelection()
}

const pendingSource = computed(() => (edgeMode.value ? selectedNodeId.value : null))

async function onNodeClick({ node }: { node: Node }) {
  if (!edgeMode.value) {
    if (selectedNodeId.value === node.id) {
      selectedNodeId.value = null
      selectedEdgeId.value = null
      emitSelection()
      return
    }
    selectedNodeId.value = node.id
    selectedEdgeId.value = null
    emitSelection()
    return
  }
  
  if (!selectedNodeId.value) {
    selectedNodeId.value = node.id
    emitSelection()
    return
  }
  
  if (selectedNodeId.value === node.id) {
    selectedNodeId.value = null
    emitSelection()
    return
  }
  
  await createEdge(selectedNodeId.value, node.id)
  selectedNodeId.value = null
  edgeMode.value = false
  emitSelection()
}

function onEdgeClick({ edge }: { edge: Edge }) {
  if (edgeMode.value) return
  selectedEdgeId.value = edge.id
  selectedNodeId.value = null
  emitSelection()
}

function onPaneClick() {
  selectedNodeId.value = null
  selectedEdgeId.value = null
  emitSelection()
}

function emitSelection() {
  const nodes = (selectedNodeId.value ? [selectedNodeId.value] : []).concat(
    edgeMode.value && pendingSource.value && pendingSource.value !== selectedNodeId.value 
      ? [pendingSource.value] 
      : [],
  )
  selectedNodeIds.value = Array.from(new Set(nodes))
  emit('selection', selectedNodeIds.value, selectedEdgeId.value ? [selectedEdgeId.value] : [])
}

async function createEdge(source: string, target: string) {
  if (!props.sketchId) return
  try {
    await graphApi.addEdge(props.sketchId, source, target, 'RELATED_TO')
    await loadGraph()
  } catch (e) {
    console.error(e)
  }
}

async function savePositions() {
  if (!props.sketchId) return
  saving.value = true
  try {
    const positions = flowNodes.value
      .filter((n) => n.position != null)
      .map((n) => ({ nodeId: n.id, x: n.position.x, y: n.position.y }))
    await graphApi.updatePositions(props.sketchId, positions)
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function deleteSelected() {
  if (!props.sketchId) return
  try {
    if (selectedNodeId.value) {
      await graphApi.deleteNodes(props.sketchId, [selectedNodeId.value])
    } else if (selectedEdgeId.value) {
      await graphApi.deleteEdges(props.sketchId, [selectedEdgeId.value])
    }
    selectedNodeId.value = null
    selectedEdgeId.value = null
    emitSelection()
    await loadGraph()
  } catch (e) {
    console.error(e)
  }
}

function onDragStop() {
  // Auto-save positions after drag
}

// TDA Methods
function toggleTda() {
  tdaActive.value = !tdaActive.value
  if (!tdaActive.value) {
    tdaResult.value = null
  }
}

async function runTdaAnalysis() {
  if (flowNodes.value.length === 0) return
  
  tdaAnalyzing.value = true
  try {
    const nodes: TdaNode[] = flowNodes.value.map(n => ({
      id: n.id,
      label: (n.data as any)?.label || n.id,
      type: (n.data as any)?.nodeType || 'unknown',
      x: n.position?.x || 0,
      y: n.position?.y || 0
    }))
    
    const edges: TdaEdge[] = flowEdges.value.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.data as any)?.label || ''
    }))
    
    tdaResult.value = analyzeTda(nodes, edges, { mode: 'flag' })
  } catch (error) {
    console.error('TDA Analysis Error:', error)
  } finally {
    tdaAnalyzing.value = false
  }
}

// Expose methods
defineExpose({ applyGraph, loadGraph, fitView })

// Watchers
watch(
  () => props.sketchId,
  (v) => {
    selectedNodeId.value = null
    selectedEdgeId.value = null
    emitSelection()
    if (v) loadGraph()
  },
)

watch(
  () => props.highlightIds,
  (ids) => {
    const set = new Set(ids || [])
    flowNodes.value = flowNodes.value.map((n) =>
      set.has(n.id) 
        ? { ...n, data: { ...n.data, highlighted: true } } 
        : n.data && (n.data as any).highlighted 
          ? { ...n, data: { ...n.data, highlighted: false } } 
          : n,
    )
  },
)

// Initialize
onMounted(loadGraph)
</script>

<script lang="ts">
import { h, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const OsNode = {
  name: 'OsNode',
  props: ['data', 'selected'],
  setup(props: { 
    data: { 
      label: string; 
      color: string; 
      nodeType: string; 
      highlighted?: boolean 
    }; 
    selected: boolean 
  }) {
    const style = computed(() => ({
      borderColor: props.data.highlighted ? '#fde047' : props.data.color,
      boxShadow: props.data.highlighted
        ? '0 0 0 2px #fde047, 0 0 14px rgba(253,224,71,0.55)'
        : props.selected
          ? `0 0 0 2px ${props.data.color}`
          : 'none',
      transform: props.data.highlighted ? 'scale(1.06)' : 'none',
    }))
    return () =>
      h('div', { class: 'os-node', style: style.value }, [
        h(Handle, { type: 'target', position: Position.Left }),
        h(Handle, { type: 'source', position: Position.Right }),
        h('span', { class: 'os-node-dot', style: { background: props.data.color } }),
        h('span', { class: 'os-node-label' }, props.data.label),
        h('span', { class: 'os-node-type' }, props.data.nodeType),
      ])
  },
}
</script>

<style scoped>
/* Graph Container */
.os-graph-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-primary);
}

/* Empty State */
.os-graph-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.os-empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.os-empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.os-btn-demo {
  padding: 10px 20px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.os-btn-demo:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

/* Toolbar */
.os-graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  gap: 12px;
  flex-wrap: wrap;
}

.os-toolbar-left,
.os-toolbar-center,
.os-toolbar-right {
  display: flex;
  gap: 6px;
}

.os-tbb-input {
  width: 180px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.85rem;
}

.os-tbb-input:focus {
  outline: none;
  border-color: var(--accent);
}

.os-btn-tbb {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.os-btn-tbb:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.os-btn-tbb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.btn.os-btn-on {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.btn.os-btn-danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.btn.os-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Hints */
.os-graph-hints {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

.os-hint {
  display: inline-block;
}

/* Canvas */
.os-graph-canvas {
  flex: 1;
  min-height: 0;
}

.os-graph-canvas.os-edge-mode {
  cursor: crosshair;
}

/* Stats Bar */
.os-graph-stats {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

.os-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.os-stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.os-stat-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.os-stat.os-stat-warning .os-stat-value {
  color: #f59e0b;
}

/* Node Component Styles */
:deep(..vue-flow) {
  background: var(--bg-primary);
}

:deep(..vue-flow__node) {
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(..vue-flow__node:active) {
  filter: brightness(1.2);
}

:deep(..vue-flow__edge) {
  cursor: pointer;
}

/* OsNode Component */
:deep(..os-node) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

:deep(..os-node-dot) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(..os-node-label) {
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

:deep(..os-node-type) {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 1200px) {
  .os-graph-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .os-toolbar-left,
  .os-toolbar-center,
  .os-toolbar-right {
    justify-content: center;
  }
  
  .os-tbb-input {
    width: 140px;
  }
}

@media (max-width: 900px) {
  .os-graph-stats {
    justify-content: center;
    gap: 12px;
  }
  
  .os-stat {
    flex-direction: column;
    align-items: center;
  }
  
  .os-stat-label {
    font-size: 0.6rem;
  }
  
  .os-stat-value {
    font-size: 0.8rem;
  }
}

/* TDA Overlay */
.os-tda-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 240px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  overflow: hidden;
}

.os-tda-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.os-tda-overlay-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.os-tda-overlay-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.os-tda-overlay-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.os-tda-overlay-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.os-tda-overlay-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.os-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.os-tda-overlay-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.os-tda-overlay-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  text-align: center;
}

.os-tda-overlay-stat-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--accent);
}

.os-tda-overlay-stat-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.os-tda-overlay-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.os-btn-tda-run {
  width: 100%;
  padding: 8px 16px;
  border-radius: 6px;
  background: var(--accent);
  border: 1px solid var(--accent);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  font-weight: 500;
}

.os-btn-tda-run:hover:not(:disabled) {
  opacity: 0.9;
}

.os-btn-tda-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
