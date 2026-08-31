/**
 * Chat module barrel — public surface for the AI command-center chat.
 *
 * A real AI backend swaps into `handleMessage` (same mutator contract), so the
 * shell only ever imports from here.
 */
export { useChat, makeTask, newId } from './useChat'
export { chat, seedWelcome, resetChat } from './chatStore'
export { handleMessage, parseIntent, executeTask, type ParsedIntent } from './aiMock'
export type {
  ChatMessage,
  ProjectTask,
  TaskStep,
  TaskStatus,
  TaskKind,
  ChatRole,
  AiPosture,
  MessageStatus,
  MessagePayload,
  ChatState,
} from './types'
