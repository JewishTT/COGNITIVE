import { reactive, computed } from 'vue'

interface GraphNode {
  id: string
  name: string
  type: string
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
}

interface Graph {
  id: string
  name: string
  description?: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: string
}

const state = reactive({
  graphs: [] as Graph[],
  selectedGraphId: null as string | null,
})

const graphs = computed(() => state.graphs)
const selectedGraph = computed(() =>
  state.graphs.find((g) => g.id === state.selectedGraphId) ?? null,
)

function selectGraph(id: string | null) {
  state.selectedGraphId = id
}

function addGraph(graph: Graph) {
  state.graphs.push(graph)
}

function removeGraph(id: string) {
  state.graphs = state.graphs.filter((g) => g.id !== id)
  if (state.selectedGraphId === id) state.selectedGraphId = null
}

export function useGraphStore() {
  return {
    graphs,
    selectedGraph,
    selectGraph,
    addGraph,
    removeGraph,
  }
}
