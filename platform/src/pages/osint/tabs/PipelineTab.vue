<template>
  <section class="pipe-view">
    <header class="pipe-head">
      <h1>Пайплайн · 0-слой</h1>
      <span class="pipe-head-right">
        <span v-if="loadingStatus" class="muted">проверка…</span>
        <span class="chip" :class="{ ok: status?.engine, bad: !status?.engine && !loadingStatus }">
          ДВИЖОК {{ status?.engine ? 'ONLINE' : 'OFFLINE' }}
        </span>
        <span class="chip">ПОРТ 5181</span>
      </span>
    </header>

    <div class="pipe-grid">
      <!-- Левая колонка: запуск + каскад -->
      <div class="pipe-col">
        <section class="panel">
          <h3 class="panel-title">Запуск сбора</h3>
          <form class="launch-form" @submit.prevent="onLaunch(false)">
            <label class="field">
              <span class="field-label">Цель (домен / IP / email / username / телефон)</span>
              <input v-model="target" class="input" placeholder="напр. example.com" autocomplete="off" />
            </label>
            <label class="field">
              <span class="field-label">Тип цели</span>
              <select v-model="type" class="input select">
                <option v-for="o in TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <div class="launch-actions">
              <button class="btn btn-primary" type="submit" :disabled="busy || !target.trim()">
                {{ busy ? 'Идёт сбор…' : 'Запустить пайплайн' }}
              </button>
              <button class="btn" type="button" :disabled="busy" @click="onLaunch(true)">Синхронно</button>
              <button v-if="busy" class="btn btn-stop" type="button" @click="onStop">Остановить</button>
            </div>
            <p v-if="runError" class="err">{{ runError }}</p>
          </form>
        </section>

        <section class="panel">
          <h3 class="panel-title">Каскад этапов</h3>
          <ol class="cascade">
            <li
              v-for="s in stages"
              :key="s.kind"
              class="cascade-step"
              :class="`cs-${s.state}`"
            >
              <span class="cs-dot" :class="`dot-${s.state}`"></span>
              <span class="cs-body">
                <span class="cs-label">{{ s.label }}</span>
                <span v-if="s.detail" class="cs-detail">{{ s.detail }}</span>
              </span>
            </li>
          </ol>

          <div class="layers">
            <div class="layers-title">Слои графа (Neo4j)</div>
            <div v-for="l in layers" :key="l.n" class="layer-row">
              <span class="layer-chip" :style="{ background: l.color }"></span>
              <span class="layer-name">{{ l.label }}</span>
              <span class="layer-example">{{ l.example }}</span>
            </div>
          </div>

          <p v-if="activeRun" class="run-meta">
            #{{ activeRun.target }} · {{ statusText(activeRun.status) }}
            <template v-if="activeRun.error"> — <span class="err">{{ activeRun.error }}</span></template>
          </p>
        </section>
      </div>

      <!-- Средняя колонка: лог -->
      <div class="pipe-col">
        <section class="panel log-panel">
          <h3 class="panel-title">Живой лог</h3>
          <div class="log-body">
            <div v-if="liveLog.length === 0" class="log-empty">— события появятся после запуска —</div>
            <div v-for="(e, i) in liveLog" :key="i" class="log-line">
              <span class="log-ts">{{ fmtTs(e.ts) }}</span>
              <span class="log-level" :class="`lv-${e.level}`">{{ e.level }}</span>
              <span class="log-tool">{{ e.tool }}</span>
              <span class="log-text">{{ e.text }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Правая колонка: инструменты + запуски -->
      <div class="pipe-col">
        <section class="panel">
          <h3 class="panel-title">Инструменты</h3>
          <p class="muted small" style="margin-top:0">
            Обнаружение и авто-установка в venv (pip). <code>sys.getsizeof</code>-честная детекция.
            Если инструмент недоступен — формируется открыто синтетический результат.
          </p>
          <ul class="tool-list">
            <li v-for="t in tools" :key="t.name" class="tool-row">
              <span class="tool-dot" :class="t.available ? 'ok' : 'bad'"></span>
              <span class="tool-name" :title="t.description">{{ t.label || t.name }}</span>
              <span class="tool-group">{{ groupLabel(t) }}</span>
              <button
                v-if="!t.available"
                class="btn btn-mini"
                :disabled="installing[t.name]"
                @click="install(t.name)"
              >
                {{ installing[t.name] ? '…' : 'Установить' }}
              </button>
              <span v-else class="tool-avail">есть</span>
            </li>
          </ul>
        </section>

        <section class="panel">
          <h3 class="panel-title">Запуски</h3>
          <button class="btn btn-mini" @click="refreshRuns">Обновить</button>
          <ul class="run-list">
            <li v-for="r in runs" :key="r.id" class="run-row" :class="`rr-${r.status}`" @click="openRun(r.id)">
              <span class="run-dot" :class="`dot-${r.status}`"></span>
              <span class="run-target">{{ r.target }} <i>({{ typeLabel(r.type) }})</i></span>
              <span class="run-status">{{ statusText(r.status) }}</span>
            </li>
            <li v-if="runs.length === 0" class="muted small">ещё нет запусков</li>
          </ul>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { usePipelineTab } from '../usePipelineTab'

const {
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
  liveLog,
  stages,
  refreshStatus,
  refreshRuns,
  launch,
  openRun,
  install,
  stop,
  resetStages,
  runError,
} = usePipelineTab()

async function onLaunch(sync: boolean) {
  try {
    await launch(sync)
  } catch (e) {
    console.error('launch', e)
  }
}

async function onStop() {
  if (!activeRun.value?.id) return
  try {
    await stop(activeRun.value.id)
  } catch (e) {
    console.error('stop', e)
  }
}

function statusText(s: string): string {
  return { queued: 'в очереди', running: 'выполняется', done: 'готово', error: 'ошибка', cancelled: 'остановлен' }[s] ?? s
}
function typeLabel(v: string): string {
  return TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v
}
function groupLabel(t: { kind: string; label?: string }): string {
  if (t.kind === 'collection') return 'сбор'
  if (t.kind === 'extraction') return 'извлечение'
  return ''
}
function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

onMounted(async () => {
  await refreshStatus()
  await refreshRuns()
  resetStages(null)
})
</script>

<style scoped>
.pipe-view { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 18px; gap: 14px; }
.pipe-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.pipe-head h1 { margin: 0; font-size: 18px; }
.pipe-head-right { display: flex; align-items: center; gap: 8px; }
.chip { font-size: 10px; letter-spacing: .04em; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.chip.ok { color: var(--accent); border-color: var(--accent); background: rgba(52,211,153,.08); }
.chip.bad { color: var(--danger); border-color: var(--danger); }

.pipe-grid { display: grid; grid-template-columns: 340px 1fr 340px; gap: 14px; flex: 1; min-height: 0; }
.pipe-col { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
@media (max-width: 1200px) { .pipe-grid { grid-template-columns: 1fr 1fr; } }

.panel { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
.panel-title { margin: 0 0 12px; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.field-label { font-size: 11px; color: var(--muted); }
.input { background: var(--bg-2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text); }
.select { appearance: auto; }
.launch-actions { display: flex; gap: 8px; }
.btn-primary { background: rgba(34,211,238,.14); border-color: var(--accent); color: var(--accent); }
.btn-stop { background: rgba(248,113,113,.12); border-color: var(--danger); color: var(--danger); }
.err { color: var(--danger); font-size: 12px; }

.cascade { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.cascade-step { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-2); }
.cs-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.cs-body { display: flex; flex-direction: column; }
.cs-label { font-size: 13px; }
.cs-detail { font-size: 11px; color: var(--muted); }
.cs-idle .cs-dot { background: var(--border); }
.cs-active .cs-dot { background: var(--accent); box-shadow: 0 0 0 3px rgba(34,211,238,.2); }
.cs-active { border-color: var(--accent); }
.cs-done .cs-dot { background: var(--success, #34d399); }
.cs-error .cs-dot { background: var(--danger); }
.cs-error { border-color: var(--danger); }
.run-meta { font-size: 12px; color: var(--muted); margin: 12px 0 0; }

.log-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.log-body { flex: 1; overflow: auto; min-height: 200px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
.log-empty { color: var(--muted); }
.log-line { display: flex; gap: 8px; }
.log-ts { color: var(--muted); }
.log-level { font-weight: 600; }
.lv-stage-start { color: var(--accent); }
.lv-stage { color: var(--accent); }
.lv-stage-done { color: var(--success, #34d399); }
.lv-tool { color: #e5b86b; }
.lv-error { color: var(--danger); }
.log-tool { color: #e5b86b; }
.log-text { color: var(--text); }

.tool-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow: auto; }
.tool-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: var(--bg-2); }
.tool-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.tool-dot.ok { background: var(--success, #34d399); }
.tool-dot.bad { background: var(--danger); }
.tool-name { flex: 1; font-size: 12px; }
.tool-group { font-size: 10px; color: var(--muted); text-transform: uppercase; }
.tool-avail { font-size: 11px; color: var(--success, #34d399); }
.btn-mini { font-size: 11px; padding: 2px 8px; }
.small { font-size: 11px; }

.run-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow: auto; }
.run-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: var(--bg-2); cursor: pointer; }
.run-row:hover { border-color: var(--accent); }
.run-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot-queued { background: var(--border); }
.dot-running { background: var(--accent); }
.dot-done { background: var(--success, #34d399); }
.dot-error { background: var(--danger); }
.dot-cancelled { background: #f59e0b; }
.run-target { flex: 1; font-size: 12px; }
.run-status { font-size: 11px; color: var(--muted); }
</style>
