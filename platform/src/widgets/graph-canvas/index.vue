<template>
  <div class="os-graph-wrap">
    <!-- Empty State -->
    <template v-if="!sketchId && flowNodes.length === 0">
      <div class="os-graph-empty os-graph-empty-demo">
        <div class="os-empty-icon">[38;5;214m[0m</div>
        <p>[38;5;240mStart by creating or selecting a graph[0m</p>
        <div class="os-empty-actions">
          <button class="btn os-btn-demo" @click="loadDemo">
            [38;5;220m[0m Demo: Simplicial Complex
          </button>
          <button class="btn os-btn-demo" @click="loadDemoTBB">
            [38;5;220m[0m Demo: TheBigBrother
          </button>
        </div>
      </div>
    </template>

    <!-- Main Content -->
    <template v-else>
      <!-- Toolbar -->
      <div class="os-graph-toolbar">
        <div class="os-toolbar-left">
          <button 
            class="btn os-btn-demo" 
            @click="loadDemo" 
            v-if="!sketchId" 
            title="Load Demo Graph"
          >
            [38;5;220m[0m Demo Graph
          </button>
          <button 
            class="btn os-btn-demo" 
            @click="loadDemoTBB" 
            v-if="!sketchId" 
            title="Load TheBigBrother Demo"
          >
            [38;5;220m[0m Demo: TBB
          </button>
        </div>

        <div class="os-toolbar-center">
          <input
            v-model="tbbTarget"
            class="os-input os-tbb-input"
            placeholder="[38;5;240mUsername for TheBigBrother[0m"
            :disabled="!sketchId || tbbBusy"
            @keyup.enter="runTheBigBrotherHandler"
          />
          <button
            class="btn os-btn-tbb"
            :disabled="!sketchId || tbbBusy || !tbbTarget"
            @click="runTheBigBrotherHandler"
            :title="sketchId ? 'Run TheBigBrother enricher' : 'Select a sketch first'"
          >
            {{ tbbBusy ? '[38;5;220mTBB...' : '[38;5;220m[0m TBB' }}
          </button>
        </div>

        <div class="os-toolbar-right">
          <button 
            class="btn" 
            :class="{ 'os-btn-on': edgeMode }" 
            @click="toggleEdgeMode"
            title="Toggle Edge Creation Mode"
          >
            {{ edgeMode ? '[38;5;196mCancel Edge[0m' : '[38;5;220mAdd Edge[0m' }}
          </button>
          <button 
            class="btn" 
            @click="savePositions" 
            :disabled="saving"
            title="Save Node Positions"
          >
            {{ saving ? '[38;5;220mSaving...' : '[38;5;220mSave Layout' }}
          </button>
          <button 
            class="btn os-btn-danger" 
            :disabled="!selectedNode && !selectedEdge" 
            @click="deleteSelected"
            title="Delete Selected"
          >
            [38;5;196mDelete[0m
          </button>
        </div>
      </div>

      <!-- Hints -->
      <div class="os-graph-hints">
        <span v-if="edgeMode" class="os-hint">
          [38;5;240mClick two nodes to create an edge[0m
        </span>
        <span v-else-if="selectedNode" class="os-hint">
          [38;5;240mNode selected: {{ selectedNode.nodeLabel }} ({{ selectedNode.nodeType }})[0m
        </span>
        <span v-else-if="selectedEdge" class="os-hint">
          [38;5;240mEdge selected: {{ selectedEdge.label }}[0m
        </span>
        <span v-else class="os-hint">
          [38;5;240mClick nodes to select [38;5;240m|[0m Double-click to add edge [38;5;240m|[0m Drag to move[0m
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
import { demoGraph, theBigBrotherDemo } from '@/entities/graph/lib/mock'
import { runTheBigBrother } from '@/features/enricher-run/model'
import type { GraphData, GraphEdge, GraphNode } from '@/shared/api/types'

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

function loadDemo() {
  selectedNodeId.value = null
  selectedEdgeId.value = null
  emitSelection()
  applyGraph(demoGraph())
}

function loadDemoTBB() {
  selectedNodeId.value = null
  selectedEdgeId.value = null
  emitSelection()
  applyGraph(theBigBrotherDemo())
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
    const msg = e instanceof Error ? e.message : 'Unknown error'
    alert(`TheBigBrother: ${msg}`)
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
</style>
