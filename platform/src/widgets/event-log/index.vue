<template>
  <div class="os-eventlog">
    <div class="os-palette-head">
      <strong>Лог движка</strong>
      <span class="os-side-muted" :class="{ 'os-live': live }">{{ live ? '● LIVE' : (sketchId ? 'оффлайн' : 'нет графа') }}</span>
    </div>
    <div class="os-eventlog-body">
      <div v-for="(el, i) in entries" :key="i" class="os-ev" :class="'os-ev-' + (el.typeKey || 'log')">
        <span class="os-ev-t">{{ el.time }}</span>
        <span class="os-ev-msg" v-html="el.html"></span>
      </div>
      <div v-if="entries.length === 0" class="os-side-muted">Пока пусто — запустите энричер.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw, onBeforeUnmount, ref, watch } from 'vue'
import { eventApi } from '@/entities/event/api'
import type { EventLogEntry } from '@/shared/api/types'

const props = defineProps<{ sketchId: string | null }>()

const entries = ref<EventLogEntry[]>([])
const live = ref(false)
let unsub: (() => void) | null = null

function fmt(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString().replace(/:\d\d /, ' ')
}

function decorate(el: EventLogEntry) {
  return {
    ...el,
    time: fmt(el.created_at),
  }
}

async function loadHistory() {
  if (!props.sketchId) return
  try {
    entries.value = (await eventApi.logs(props.sketchId, 50)).map(decorate)
  } catch (e) {
    console.error(e)
  }
}

function subscribe() {
  if (!props.sketchId || unsub) return
  live.value = true
  unsub = eventApi.stream(props.sketchId, (msg) => {
    const ev =
      msg.payload?.event === 'log'
        ? { created_at: new Date().toISOString(), type: 'log', payload: { message: String(msg.data ?? '') } }
        : {
            created_at: new Date().toISOString(),
            type: 'event',
            payload: { message: `${msg.payload?.event}${msg.data ? ' · ' + String(msg.data) : ''}` },
          }
    entries.value = [...entries.value, markRaw(decorate(ev))].slice(-200)
  })
}

watch(
  () => props.sketchId,
  () => {
    if (unsub) {
      unsub()
      unsub = null
    }
    live.value = false
    entries.value = []
    loadHistory()
    subscribe()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (unsub) unsub()
})
</script>