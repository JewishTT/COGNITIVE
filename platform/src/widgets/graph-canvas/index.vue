<template>
  <div class="os-graph-wrap">
    <template v-if="!sketchId && flowNodes.length === 0">
      <div class="os-graph-empty os-graph-empty-demo">
        <p>Выберите или создайте расследование с графом слева — либо откройте демо-граф для TDA:</p>
        <button class="btn os-btn-demo" @click="loadDemo">▶ Демо: симплициальный комплекс</button>
        <button class="btn os-btn-demo" @click="loadDemoTBB">▶ Демо: TheBigBrother</button>
      </div>
    </template>

    <template v-else>
      <div class="os-graph-toolbar">
        <button class="btn os-btn-demo" @click="loadDemo" v-if="!sketchId" title="Тестовый граф без бэкенда">▶ Демо-граф</button>
        <button class="btn os-btn-demo" @click="loadDemoTBB" v-if="!sketchId" title="Граф из TheBigBrother (взвешенный)">▶ Демо: TheBigBrother</button>
        <input
          v-model="tbbTarget"
          class="os-input os-tbb-input"
          placeholder="ник для TheBigBrother"
          :disabled="!sketchId || tbbBusy"
                    @keyup.enter="runTheBigBrotherHandler"
        />
        <button
          class="btn os-btn-tbb"
          :disabled="!sketchId || tbbBusy || !tbbTarget"
          @click="runTheBigBrotherHandler"
          :title="sketchId ? 'Реальный прогон enricher username_to_socials_thebigbrother (Flowsint/Neo4j)' : 'Сначала создайте граф'"
        >
          {{ tbbBusy ? 'TheBigBrother…' : '🕵 TheBigBrother' }}
        </button>
        <button class="btn" :class="{ 'os-btn-on': edgeMode }" @click="toggleEdgeMode">
          {{ edgeMode ? 'Отмена связи' : 'Связать сущности' }}
        </button>
        <button class="btn" @click="savePositions" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить позиции' }}
        </button>
        <button class="btn os-btn-danger" :disabled="!selectedNode && !selectedEdge" @click="deleteSelected">
          Удалить выбранное
        </button>
        <span class="os-graph-tip" v-if="edgeMode">Выберите две сущности подряд: источник → цель</span>
        <span class="os-graph-tip" v-else>Клик по сущности — выбрать · перетаскивание — переместить</span>
      </div>

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
      set.has(n.id) ? { ...n, data: { ...n.data, highlighted: true } }
        : n.data && n.data.highlighted ? { ...n, data: { ...n.data, highlighted: false } }
          : n,
    )
  },
)

onMounted(loadGraph)

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
    const msg = e instanceof Error ? e.message : 'Неизвестная ошибка'
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
    edgeMode.value && pendingSource.value && pendingSource.value !== selectedNodeId.value ? [pendingSource.value] : [],
  )
  selectedNodeIds.value = Array.from(new Set(nodes))
  emit('selection', selectedNodeIds.value, selectedEdgeId.value ? [selectedEdgeId.value] : [])
}

defineExpose({ applyGraph, loadGraph })

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
  // Позиции батч-сохраняются кнопкой «Сохранить позиции».
}
</script>

<script lang="ts">
import { h, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const OsNode = {
  name: 'OsNode',
  props: ['data', 'selected'],
  setup(props: { data: { label: string; color: string; nodeType: string; highlighted?: boolean }; selected: boolean }) {
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