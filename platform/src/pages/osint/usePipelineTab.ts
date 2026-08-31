// pages/osint — состояние таба «Пайплайн»: каскад этапов первичного сбора,
// статусы инструментов, запуск/остановка, живой лог и SSE-подписка.
import { onUnmounted, reactive, ref } from 'vue'
import { pipelineApi } from '@/entities/pipeline/api'
import type {
  PipelineEvent,
  PipelineRun,
  PipelineStatus,
  PipelineTool,
} from '@/entities/pipeline/api'

export type StageKind = 'collect' | 'extract' | 'store'

interface StageVis {
  kind: StageKind
  label: string
  state: 'idle' | 'active' | 'done' | 'error' | 'skipped'
  detail: string
}

const TYPE_OPTIONS = [
  { value: 'domain', label: 'Домен' },
  { value: 'ip', label: 'IP-адрес' },
  { value: 'email', label: 'E-mail' },
  { value: 'username', label: 'Username' },
  { value: 'phone', label: 'Телефон' },
  { value: 'company', label: 'Компания' },
]

const BASE_EVENTS = '/pipeline/runs/'

const StageInfo: Record<StageKind, { label: string; detail: string }> = {
  collect: { label: 'Сбор', detail: 'BBOT · theHarvester · sherlock · maigret · snscrape · TGSpyder · SearXNG' },
  extract: { label: 'Извлечение', detail: 'regex · spaCy NER · exiftool' },
  store: { label: 'Neo4j', detail: 'живой лог и SSE-подписка.' },
}

function normalizeKind(name: string): StageKind | null {
  if (name === 'collect' || name.startsWith('collect')) return 'collect'
  if (name === 'extract' || name.startsWith('extract')) return 'extract'
  if (name === 'store' || name.startsWith('store')) return 'store'
  return null
}

function order(kind: StageKind): number {
  return { collect: 0, extract: 1, store: 2 }[kind]
}

interface StageLike {
  name: string
  label: string
  nodes?: number
  edges?: number
  emails?: number
  phones?: number
  persons?: number
  sources?: number
  sketchId?: string
}

function stageDetail(run: { status?: string }, s: StageLike): string {
  if (s.nodes !== undefined || s.edges !== undefined)
    return `${s.nodes ?? 0} узлов · ${s.edges ?? 0} рёбер`
  if (s.emails !== undefined)
    return `email ${s.emails} · phone ${s.phones ?? 0} · person ${s.persons ?? 0}`
  if (s.sources !== undefined) return `источников: ${s.sources}`
  return s.sketchId ? `sketch ${s.sketchId}` : ''
}

export function usePipelineTab() {
  const loadingStatus = ref(false)
  const status = ref<PipelineStatus | null>(null)
  const tools = ref<PipelineTool[]>([])
  const installing = reactive<Record<string, boolean>>({})
  const busy = ref(false)
  const target = ref('')
  const type = ref('username')
  const runs = ref<PipelineRun[]>([])
  const activeRun = ref<PipelineRun | null>(null)
  const currentRunId = ref<string | null>(null)
  const liveLog = ref<PipelineEvent[]>([])
  const stages = ref<StageVis[]>([])
  const runError = ref('')
  let eventSource: EventSource | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refreshStatus() {
    loadingStatus.value = true
    try {
      status.value = await pipelineApi.status()
      tools.value = status.value?.tools ?? []
    } catch {
      /* сервис недоступен — статус остаётся null */
    } finally {
      loadingStatus.value = false
    }
  }

  function initialStages(): StageVis[] {
    return Object.entries(StageInfo).map(([kind, info]) => ({
      kind: kind as StageKind,
      label: info.label,
      state: 'idle' as const,
      detail: info.detail,
    }))
  }

  function resetStages(run: PipelineRun | null) {
    if (!run) {
      stages.value = initialStages()
      return
    }
    const map: StageVis[] = []
    for (const s of run.stages) {
      const kind = normalizeKind(s.name)
      if (!kind) continue
      const hasErrorDetail = s.name === 'store' && run.status === 'error'
      map.push({
        kind,
        label: s.label,
        state: hasErrorDetail ? 'error' : 'done',
        detail: stageDetail(run, s),
      })
    }
    for (const kind of ['collect', 'extract', 'store'] as StageKind[]) {
      if (!map.some((m) => m.kind === kind)) {
        map.push({ kind, label: StageInfo[kind].label, state: 'idle', detail: '' })
      }
    }
    map.sort((a, b) => order(a.kind) - order(b.kind))
    stages.value = map
  }

  async function launch(sync = false) {
    if (!target.value.trim()) return
    busy.value = true
    runError.value = ''
    liveLog.value = []
    stages.value = initialStages().map((s) => ({
      ...s,
      state: s.kind === 'collect' ? 'active' : 'idle',
    }))
    try {
      const res = await pipelineApi.launch(target.value.trim(), type.value, sync)
      if (sync) {
        await refreshRuns()
        return
      }
      if (res?.id) {
        currentRunId.value = res.id
        activeRun.value = null
        subscribeLiveLog(res.id)
      }
    } catch (e: any) {
      runError.value = e?.message || String(e)
    } finally {
      busy.value = false
    }
  }

  async function stop(id: string) {
    if (!id) return
    try {
      await pipelineApi.run(id).catch(() => null)
    } finally {
      stopStream()
      activeRun.value = null
      currentRunId.value = null
    }
  }

  function subscribeLiveLog(runId: string) {
    if (eventSource) eventSource.close()
    if (pollTimer) clearInterval(pollTimer)
    liveLog.value = []

    const url = `${BASE_EVENTS}${runId}/events`
    eventSource = new EventSource(url)
    eventSource.onmessage = (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data)
        liveLog.value.push(evt)
        reflectEvent(evt)
      } catch {}
    }
    eventSource.onerror = () => {
      pollTimer = setInterval(async () => {
        const r = await pipelineApi.run(runId).catch(() => null)
        if (r) {
          activeRun.value = r
          resetStages(r)
          busy.value = false
          currentRunId.value = null
        }
      }, 3000)
    }
  }

  function reflectEvent(evt: PipelineEvent) {
    const kind = normalizeKind(evt.tool || '')
    const st = kind ? stages.value.find((s) => s.kind === kind) : undefined
    if (!st) return
    if (evt.level === 'stage') st.state = 'active'
    if (evt.level === 'stage_done') {
      st.state = 'done'
      st.detail = evt.text || st.detail
    }
    if (evt.level === 'error') st.state = 'error'
  }

  async function syncFromRun(id: string) {
    const r = await pipelineApi.run(id).catch(() => null)
    if (r) {
      activeRun.value = r
      resetStages(r)
    }
  }

  async function refreshRuns() {
    runs.value = await pipelineApi.runs().catch(() => [])
  }

  async function openRun(id: string) {
    stopStream()
    const r = await pipelineApi.run(id).catch(() => null)
    if (r) {
      activeRun.value = r
      resetStages(r)
      subscribeLiveLog(r.id || id)
    }
  }

  function stopStream() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function install(name: string) {
    installing[name] = true
    runError.value = ''
    try {
      const res = await pipelineApi.install(name)
      if (!res?.ok) {
        runError.value = res?.msg || 'Ошибка установки'
      }
      await refreshStatus()
    } catch (e: any) {
      runError.value = e?.message || String(e)
    } finally {
      delete installing[name]
    }
  }

  onUnmounted(stopStream)

  return {
    TYPE_OPTIONS,
    loadingStatus,
    status,
    tools,
    installing,
    busy,
    target,
    type,
    runs,
    activeRun,
    currentRunId,
    liveLog,
    stages,
    refreshStatus,
    refreshRuns,
    launch,
    openRun,
    stopStream,
    install,
    stop,
    resetStages,
    runError,
  }
}
