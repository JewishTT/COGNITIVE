// pages/osint — состояние страницы: сборка вклада canvas / TDA / каталога / палитры.
import { computed, ref } from 'vue'
import { graphApi } from '@/entities/graph/api'
import type { GraphData, Investigation, Sketch } from '@/shared/api/types'

export function useOsintPage() {
  const activeSketchId = ref<string | null>(null)
  const currentGraph = ref<GraphData | null>(null)
  const highlightIds = ref<string[]>([])
  const selectedNodeIds = ref<string[]>([])
  const tbbBusy = ref(false)

  const canvasRef = ref<{ applyGraph: (g: GraphData) => void; loadGraph: () => void } | null>(null)

  const selectedNode = computed(() => {
    const id = selectedNodeIds.value[0]
    if (!id || !currentGraph.value) return null
    return currentGraph.value.nds.find((n) => n.id === id) ?? null
  })

  function onSelect(_inv: Investigation, sk: Sketch) {
    activeSketchId.value = sk.id
    selectedNodeIds.value = []
    highlightIds.value = []
  }

  function onGraph(g: GraphData) {
    currentGraph.value = g
  }

  function onSelection(nodes: string[], _edges: string[]) {
    selectedNodeIds.value = nodes
  }

  function onTbbState(busy: boolean) {
    tbbBusy.value = busy
  }

  function onHighlight(ids: string[]) {
    highlightIds.value = ids
  }

  function onClearHighlight() {
    highlightIds.value = []
  }

  function onEnriched(g: GraphData) {
    currentGraph.value = g
    canvasRef.value?.applyGraph(g)
  }

  async function onDeleteNode(id: string) {
    if (!activeSketchId.value) return
    try {
      await graphApi.deleteNodes(activeSketchId.value, [id])
      selectedNodeIds.value = []
      const g = await graphApi.get(activeSketchId.value)
      onGraph(g)
      canvasRef.value?.applyGraph(g)
    } catch (e) {
      console.error('delete node', e)
    }
  }

  function onAdded() {
    canvasRef.value?.loadGraph()
  }

  function onCloseInspector() {
    selectedNodeIds.value = []
  }

  return {
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
  }
}