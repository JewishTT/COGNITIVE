/**
 * useChat.ts — reactive project-command chat store.
 *
 * A plain Vue 3 composable (no external deps) holding:
 *   - `messages`    the conversation transcript
 *   - `tasks`       every project task the AI has created or the operator has
 *                   asked it to run
 *   - `posture`     the AI agent's current posture (idle / online / thinking /
 *                   working)
 *
 * Everything is plain `reactive` state, so the UI updates automatically. A real
 * AI backend (LLM agent, OpenAI Realtime, a future /agent HTTP stream, etc.)
 * just needs to call these same mutators — `sendMessage`, `addTask`,
 * `updateTask`, `completeTask`, `failTask` — and the UI follows for free.
 */
import { reactive, computed } from 'vue'
import type {
  ChatMessage,
  ProjectTask,
  TaskStatus,
  ChatRole,
  AiPosture,
  MessagePayload,
  TaskKind,
} from './types'

let _seq = 0
function nextId(prefix: string): string {
  _seq = (_seq + 1) | 0
  return `${prefix}_${Date.now().toString(36)}_${_seq}`
}

/** Alias used by the mock agent and the public chat API. */
export const newId = nextId

/** Create a brand-new task object in the `pending` state. */
export function makeTask(input: {
  title: string
  description?: string
  kind?: TaskKind
  steps?: { id: string; label: string }[]
  owner?: 'user' | 'assistant'
}): ProjectTask {
  return {
    id: nextId('t'),
    title: input.title,
    description: input.description,
    kind: input.kind ?? 'generic',
    status: 'pending',
    progress: 0,
    steps: (input.steps ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending' as TaskStatus,
      updatedAt: Date.now(),
    })),
    owner: input.owner ?? 'assistant',
    createdAt: Date.now(),
  }
}

function now(): number {
  return Date.now()
}

export const useChat = () => {
  const state = reactive<{
    messages: ChatMessage[]
    tasks: ProjectTask[]
    posture: AiPosture
    lastError?: string
  }>({
    messages: [],
    tasks: [],
    posture: 'online',
    lastError: undefined,
  })

  // ---- posture -----------------------------------------------------------
  const setPosture = (p: AiPosture) => {
    state.posture = p
  }

  // ---- messages ----------------------------------------------------------
  const sendMessage = (
    role: ChatRole,
    content: string,
    payload?: MessagePayload,
  ): ChatMessage => {
    const msg: ChatMessage = {
      id: nextId('m'),
      role,
      content,
      status: role === 'user' ? 'done' : 'delivering',
      createdAt: now(),
      payload,
    }
    state.messages.push(msg)
    return msg
  }

  const setUserMessage = (content: string): ChatMessage => sendMessage('user', content)
  const receiveAssistant = (content: string): ChatMessage => sendMessage('assistant', content)

  const setDelivered = (id: string) => {
    const m = state.messages.find((x) => x.id === id)
    if (m) m.status = 'done'
  }

  // ---- tasks -------------------------------------------------------------
  /** Persist a task and echo its creation into the chat stream. */
  const addTask = (task: ProjectTask): ProjectTask => {
    state.tasks.push(task)
    const echoed = state.messages.some(
      (x) => x.payload?.type === 'task_created' && (x.payload as any).task.id === task.id,
    )
    if (!echoed) {
      const msg = sendMessage(
        'assistant',
        task.description ? `**Задача:** ${task.title}\n_${task.description}_` : `**Задача:** ${task.title}`,
        { type: 'task_created', task },
      )
      setDelivered(msg.id)
    }
    return task
  }

  const updateTask = (
    id: string,
    patch: {
      status?: TaskStatus
      progress?: number
      stepId?: string
      stepStatus?: TaskStatus
      stepResult?: string
      result?: string
      error?: string
    },
  ): ProjectTask | undefined => {
    const t = state.tasks.find((x) => x.id === id)
    if (!t) return undefined

    if (patch.status) {
      t.status = patch.status
      if (patch.status === 'running' && !t.startedAt) t.startedAt = now()
      if ((patch.status === 'completed' || patch.status === 'failed') && !t.completedAt)
        t.completedAt = now()
    }
    if (patch.progress != null) t.progress = patch.progress
    if (patch.result != null) t.result = patch.result
    if (patch.error != null) t.error = patch.error

    if (patch.stepId && patch.stepStatus) {
      const step = t.steps.find((s) => s.id === patch.stepId)
      if (step) {
        step.status = patch.stepStatus
        if (patch.stepResult != null) step.result = patch.stepResult
        step.updatedAt = now()
      }
    }
    return t
  }

  const completeTask = (id: string, result?: string): ProjectTask | undefined =>
    updateTask(id, { status: 'completed', progress: 100, result })

  const failTask = (id: string, error: string): ProjectTask | undefined =>
    updateTask(id, { status: 'failed', error })

  const findTask = (id: string): ProjectTask | undefined => state.tasks.find((x) => x.id === id)

  const clearAll = () => {
    state.messages = []
    state.tasks = []
    state.posture = 'online'
    state.lastError = undefined
    _seq = 0
  }

  // ---- projections -------------------------------------------------------
  const activeTasks = computed(() =>
    state.tasks.filter((t) => t.status === 'running' || t.status === 'pending'),
  )
  const completedTasks = computed(() =>
    state.tasks.filter((t) => t.status === 'completed' || t.status === 'failed'),
  )
  const runningTaskCount = computed(() => state.tasks.filter((t) => t.status === 'running').length)
  const hasUnreadMention = { value: false }

  return {
    state,
    // posture
    posture: computed(() => state.posture),
    setPosture,
    // messages
    messages: computed(() => state.messages),
    sendMessage,
    setUserMessage,
    receiveAssistant,
    setDelivered,
    // tasks
    addTask,
    updateTask,
    completeTask,
    failTask,
    findTask,
    clearAll,
    tasks: computed(() => state.tasks),
    activeTasks,
    completedTasks,
    runningTaskCount,
    hasUnreadMention,
  }
}

export type ChatApi = ReturnType<typeof useChat>
export { nextId }

