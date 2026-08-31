/**
 * aiMock.ts — simulated AI project-manager agent.
 *
 * Stand-in for the real AI backend that will eventually drive the chat. It
 * demonstrates the contract the platform expects from an agent:
 *
 *   - Receives the operator's message (`chat.setUserMessage`).
 *   - Mutates posture while it "thinks" (`startThinking`/`stopThinking`).
 *   - Produces an assistant reply (`chat.receiveAssistant`).
 *   - When a request maps to a project task, creates it (`chat.addTask`) and
 *     then *executes* it — stepping progress, flipping sub-steps, and finally
 *     `completeTask` or `failTask`.
 *
 * A real provider (OpenAI tool-use, a LangGraph/LangChain agent, an MCP
 * client, etc.) replaces `handleMessage` but should call the same mutators,
 * so the UI never knows whether it's talking to a mock or a model.
 *
 * All delays are faked with setTimeout so the UI shows a live, breathing
 * agent rather than instant replies.
 */
import type { ChatApi } from './useChat'
import { makeTask, newId } from './useChat'
import type { ProjectTask, TaskKind } from './types'

const THINK_MS = 700
const STEP_MS = 900

export interface ParsedIntent {
  kind: 'greeting' | 'status' | 'help' | 'task' | 'clarify'
  title: string
  description?: string
  /** The structured task payload (only for task intents). */
  task?: {
    title: string
    description?: string
    kind: TaskKind
    steps: { id: string; label: string }[]
  }
  reply: string
  /** Immediate reply shown if execution fails. */
  failReply?: string
}

const LOWER = (s: string) => s.toLowerCase()

export function parseIntent(raw: string): ParsedIntent {
  const t = LOWER(raw).trim()

  // Greetings / wake-ups
  if (/^(привет|hi|hello|hey|йо|здравствуй|ку\b|$)/.test(raw.trim().toLowerCase())) {
    return {
      kind: 'greeting',
      title: 'Приветствие',
      reply:
        '🤖 **GHOST-7 онлайн.** Я твой ИИ-менеджер проекта — слежу за задачами, запускаю сборки и строю ОСИНТ-графы. ' +
        'Спроси что-нибудь вроде: «запусти регрессию», «создай задачу», «статус проекта» или «помощь».',
    }
  }

  // Status
  if (/статус|status|what.?s.?up|state of the|текущ|состояние|progress|что делаешь/.test(t)) {
    return {
      kind: 'status',
      title: 'Статус проекта',
      reply:
        '📊 **Сводка проекта:**\n- 🌐 Глобус: LIVE (3D-тайлы Google, полёты + спутники + CCTV в эфире)\n' +
        '- 🕸️ ОСИНТ-граф: встроенный модуль платформы (локальное хранилище)\n- 🏭 Фабрика: Postiz на :4007\n- 💳 Коммерция: 6 проектов в пайплайне\n\n_' +
                'Активных задач сейчас в очереди нет. Чем могу заняться — скажи!_',
    }
  }

  // Help
  if (/помощь|help|команд|что умеешь|commands|faq/.test(t)) {
    return {
      kind: 'help',
      title: 'Справка',
      reply:
        '🛠️ **Я умею:**\n- «запусти регрессию» / «run tests» — запустить юнит-тесты\n' +
        '- «сборка» / «build» — собрать платформу (vite build)\n- «создай задачу: …» — добавить задачу в дорожную карту\n' +
        '- «узел в граф» / «add node» — добавить сущность в ОСИНТ-граф\n' +
        '- «перезапусти фабрику» / «restart factory» — docker compose up\n' +
        '- «статус» — сводка проекта\n- «помощь» — это сообщение\n\n' +
        '_Это симуляция. В реальном агенте команды исполняются моделями._',
    }
  }

  if (/тест|tests|регресс|regression|cypress|unit/.test(t)) {
    return {
      kind: 'task',
      title: 'Регрессионный прогон тестов',
      description: 'Запуск unit-тестов платформы и глобуса через node scripts/run-unit-tests.mjs',
      task: {
        title: 'Регрессионный прогон тестов',
        description: 'Запуск unit-тестов платформы и глобуса через node scripts/run-unit-tests.mjs',
        kind: 'test',
        steps: [
          { id: newId('s'), label: 'Сканирую тесты в src/' },
          { id: newId('s'), label: 'Запускаю юнит-тесты (Vue + TDA + камера)' },
          { id: newId('s'), label: 'Сводка прогона и артефакты' },
        ],
      },
      reply: '🏃 **Запускаю регрессионный прогон.** Надо мне вернуть отчёт, как закончу.',
      failReply: '💥 Регрессия упала. Смотри детали в карточке задачи.',
    }
  }

  if (/сборка|build|bundle|compile|vite build|production/.test(t)) {
    return {
      kind: 'task',
      title: 'Сборка платформы (vite build)',
      description: 'Билд production-бандла для platform/ и корневого глобуса.',
      task: {
        title: 'Сборка платформы (vite build)',
        description: 'Билд production-бандла для platform/ и корневого глобуса.',
        kind: 'build',
        steps: [
          { id: newId('s'), label: 'type-check (tsc --noEmit)' },
          { id: newId('s'), label: 'vite build — корневой глобус' },
          { id: newId('s'), label: 'vite build — платформа (:5180)' },
          { id: newId('s'), label: 'Артефакт → dist/' },
        ],
      },
      reply: '🔨 **Собираю production-бандл.** Дам знать, как размеры будут.',
      failReply: '💥 Сбой сборки — проверь логи в карточке.',
    }
  }

  if (/узел|node|sущность|entity|граф|graph/.test(t)) {
    return {
      kind: 'task',
      title: 'Добавить сущность в ОСИНТ-граф',
      description: 'Создать узел (person/org) и связать с существующей сущностью.',
      task: {
        title: 'Добавить сущность в ОСИНТ-граф',
        description: 'Создать узел (person/org) и связать с существующей сущностью.',
        kind: 'osint',
        steps: [
          { id: newId('s'), label: 'POST /sketches/{id}/nodes/add' },
          { id: newId('s'), label: 'POST /sketches/{id}/relations/add' },
          { id: newId('s'), label: 'Ререндер VueFlow + TDA' },
        ],
      },
      reply: '🕸️ **Добавляю сущность в граф.** Укажи тип и подпись — запишу в локальное хранилище ОСИНТ.',
      failReply: '💥 Не удалось добавить узел — проверь локальное хранилище ОСИНТ.',
    }
  }

  if (/фабрик|factory|docker|postiz|restart|deploy|stack/.test(t)) {
    return {
      kind: 'task',
      title: 'Перезапуск стека Фабрики (docker compose up)',
      description: 'docker compose -f platform/factory/docker-compose.yaml up -d',
      task: {
        title: 'Перезапуск стека Фабрики (docker compose up)',
        description: 'docker compose -f platform/factory/docker-compose.yaml up -d',
        kind: 'deploy',
        steps: [
          { id: newId('s'), label: 'docker compose up -d' },
          { id: newId('s'), label: 'Жду healthcheck Postiz (:4007)' },
          { id: newId('s'), label: 'Автологин администратора' },
        ],
      },
      reply: '🐳 **Поднимаю стек Фабрики.** Отчёт придёт, как контейнеры поднимутся.',
      failReply: '💥 Стек не поднялся — проверь docker logs.',
    }
  }

  if (/создай задач|create task|new task|add task|добавь задач/.test(t)) {
    const m = raw.match(/задач(?:у|е)?\b[:\-\s]+(.+?)(?:\s*$)/i)
    const title = m && m[1] ? m[1].trim() : 'Новая задача от оператора'
    return {
      kind: 'task',
      title,
      description: 'Создано вручную из чата оператором.',
      task: {
        title,
        description: 'Создано вручную из чата оператором.',
        kind: 'generic',
        steps: [{ id: newId('s'), label: 'В план добавлена' }],
      },
      reply: `📌 **Задача в дорожную карту:** ${title}.`,
    }
  }

    // Default — clarifying reply
  return {
    kind: 'clarify',
    title: 'Урезервировать',
    reply:
      '🤔 Не уверен, что конкретно имеешь в виду. Может, уточнишь — ' +
      '«запусти регрессию», «создай задачу на …», «перезапусти фабрику»? ' +
      'Напиши «помощь» — посмотрю все команды.',
  }
}

// ---------------------------------------------------------------------------
// The simulated executor — walks a task's steps and reports progress.
// ---------------------------------------------------------------------------
export function executeTask(
  chat: ChatApi,
  task: ProjectTask,
  onDone?: (t: ProjectTask) => void,
): string {
  const kind = task.kind
  chat.updateTask(task.id, { status: 'running', progress: 0 })

  // A small, honest failure rate so the demo never looks fake-perfect.
  const willFail = kind === 'test' && Math.random() < 0.15
  const steps = task.steps.length ? task.steps : [{ id: newId('s'), label: 'Выполняю…' }]

  let i = 0
  const runStep = () => {
    if (i >= steps.length) {
      if (willFail) {
        chat.failTask(
          task.id,
          kind === 'test'
            ? 'Один из юнит-тестов упал: TDA-анализ нестабилен на пустом графе. src/annotations.'
            : `Сбой выполнения задачи ${kind}.`,
        )
      } else {
        chat.completeTask(
          task.id,
          kind === 'test'
            ? '✓ Все юнит-тесты прошли. 47 passed, 0 failed. Артефакт: .gev-cache/test-run.json'
            : kind === 'build'
              ? '✓ Сборка готова → dist/ (глобус: 1.94 МБ, платформа: 612 КБ gzip).'
              : kind === 'osint'
                ? '✓ Сущность создана и связана в локальном графе ОСИНТ. Граф перевизуализирован.'
                : kind === 'deploy'
                  ? '✓ Стек поднялся. Postiz онлайн на :4007, сессия админа активна.'
                  : '✓ Задача выполнена.',
        )
      }
      onDone?.(task)
      return
    }

    const step = steps[i]
    chat.updateTask(task.id, { status: 'running', stepId: step.id, stepStatus: 'running' })
    const stepShare = 100 / Math.max(steps.length, 1)
    const progress = Math.round(((i + 1) * stepShare))
    const isLast = i === steps.length - 1

    setTimeout(() => {
      if (willFail && isLast) {
        chat.updateTask(task.id, { stepId: step.id, stepStatus: 'failed', progress: 95 })
      } else {
        chat.updateTask(task.id, {
          stepId: step.id,
          stepStatus: 'completed',
          stepResult: kind === 'test' ? 'passed' : kind === 'build' ? 'bundled' : 'ok',
          progress,
        })
      }
      i++
      runStep()
    }, STEP_MS)
  }

  runStep()
  return task.id
}

// ---------------------------------------------------------------------------
// Top-level entry: parse a user message, produce a reply + optional task.
// ---------------------------------------------------------------------------
let _throttleTimer: ReturnType<typeof setTimeout> | null = null

export function handleMessage(chat: ChatApi, text: string): void {
  chat.setUserMessage(text)
  if (_throttleTimer) clearTimeout(_throttleTimer)
  _throttleTimer = setTimeout(() => {
    _throttleTimer = null

    const intent = parseIntent(text)
    chat.startThinking()

    setTimeout(() => {
      const aiMsg = chat.receiveAssistant(intent.reply)
      chat.setDelivered(aiMsg.id)

      if (intent.kind === 'task' && intent.task) {
        const task = makeTask({
          title: intent.task.title,
          description: intent.task.description,
          kind: intent.task.kind,
          owner: 'assistant',
          steps: intent.task.steps,
        })
        chat.addTask(task)
        chat.startWorking()
        executeTask(chat, task, () => {
          if (chat.runningTaskCount.value > 0) chat.startWorking()
          else chat.stopWorking()
        })
      } else {
        chat.stopThinking()
      }
    }, THINK_MS)
  }, 0)
}


