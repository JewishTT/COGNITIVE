/**
 * types.ts — domain types for the AI command-center chat.
 *
 * The chat is built around two first-class citizens:
 *   1. Conversations — text messages between the human operator and the AI
 *      project-manager agent.
 *   2. Project tasks — discrete units of work the AI creates and executes on
 *      behalf of the operator (build a layer, run regression, add a node to a
 *      graph, spin up a docker stack, etc.).
 *
 * Tasks live inline in the message stream so the operator always sees what the
 * AI is doing, but the task store is also projected separately so the shell can
 * render a global "active missions" rail or dock.
 */

export type ChatRole = 'user' | 'assistant' | 'system'

/** Life-cycle status of an AI message in flight. */
export type MessageStatus = 'sending' | 'delivering' | 'done'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export type TaskKind =
  | 'generic'        // free-form operator task
  | 'test'           // regression / unit test run
  | 'build'          // vite build / bundle
  | 'osint'          // graph operation
  | 'deploy'         // docker / factory stack
  | 'shell'          // platform shell command
  | 'voice'          // voice model / audio

export interface ChatMessage {
  id: string
  role: ChatRole
  /** Markdown-ish text content. May embed structured payloads via `payload`. */
  content: string
  status: MessageStatus
  createdAt: number
  /** Optional structured payload — e.g. a created task echoed into the stream. */
  payload?: MessagePayload
}

export type MessagePayload =
  | { type: 'task_created'; task: ProjectTask }
  | { type: 'task_update'; taskId: string; status: TaskStatus; progress?: number; stepId?: string }
  | { type: 'task_completed'; taskId: string; result?: string }
  | { type: 'task_failed'; taskId: string; error: string }

export interface TaskStep {
  id: string
  label: string
  status: TaskStatus
  result?: string
  /** ISO timestamp when this step changed state. */
  updatedAt: number
}

export interface ProjectTask {
  id: string
  /** Human-readable title shown in the card header. */
  title: string
  /** Optional longer description / rationale. */
  description?: string
  kind: TaskKind
  status: TaskStatus
  /** 0–100. */
  progress: number
  steps: TaskStep[]
  /** Final output, log tail, or result summary. */
  result?: string
  error?: string
  /** Who/what created the task (human operator or the AI). */
  owner: 'user' | 'assistant'
  createdAt: number
  startedAt?: number
  completedAt?: number
}

/** The AI agent's current operational posture. */
export type AiPosture = 'idle' | 'online' | 'thinking' | 'working'

export interface ChatState {
  messages: ChatMessage[]
  tasks: ProjectTask[]
  posture: AiPosture
  /** Last error surfaced to the operator (cleared on next successful action). */
  lastError?: string
}
