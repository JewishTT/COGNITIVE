import { reactive, computed } from 'vue'

interface TdaResult {
  id: string
  graphId: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  config: Record<string, unknown>
  results: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
}

const state = reactive({
  analyses: [] as TdaResult[],
  currentAnalysisId: null as string | null,
})

const analyses = computed(() => state.analyses)
const currentAnalysis = computed(() =>
  state.analyses.find((a) => a.id === state.currentAnalysisId) ?? null,
)

function addAnalysis(analysis: TdaResult) {
  state.analyses.push(analysis)
}

function updateAnalysis(id: string, patch: Partial<TdaResult>) {
  const a = state.analyses.find((x) => x.id === id)
  if (a) Object.assign(a, patch)
}

function removeAnalysis(id: string) {
  state.analyses = state.analyses.filter((a) => a.id !== id)
  if (state.currentAnalysisId === id) state.currentAnalysisId = null
}

function selectAnalysis(id: string | null) {
  state.currentAnalysisId = id
}

export function useTdaStore() {
  return {
    analyses,
    currentAnalysis,
    addAnalysis,
    updateAnalysis,
    removeAnalysis,
    selectAnalysis,
  }
}
