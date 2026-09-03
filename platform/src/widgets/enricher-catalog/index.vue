<template>
  <div class="os-catalog">
    <div class="os-palette-head">
      <strong>Энричеры (Flowsint)</strong>
      <span class="os-side-muted">{{ enrichers.length }}</span>
    </div>

    <div v-if="busy" class="os-side-muted">Загрузка registry…</div>

    <div class="os-cat-filter">
      <button
        v-for="c in ['', ...categories]"
        :key="c"
        class="os-chip"
        :class="{ 'os-chip-on': filter === c }"
        @click="filter = c"
      >
        {{ c || 'Все' }}
      </button>
    </div>

    <div class="os-enr-list">
      <div
        v-for="e in filtered"
        :key="e.class_name"
        class="os-enr"
        :class="{ 'os-enr-busy': running === e.name }"
      >
        <div class="os-enr-head">
          <span class="os-enr-icon"><UiIcon :name="e.icon || 'puzzle'" :size="16" /></span>
          <div class="os-enr-titles">
            <div class="os-enr-name">{{ e.name }}</div>
            <div class="os-enr-mod">{{ e.module }}</div>
          </div>
        </div>
        <p class="os-enr-desc">{{ e.description }}</p>
        <div class="os-enr-meta">
          <span v-for="o in e.outputs || []" :key="o" class="os-chip">→ {{ o }}</span>
        </div>
        <div class="os-enr-actions">
          <button
            class="btn os-btn-tbb"
            :disabled="!sketchId || nodeIds.length === 0 || running !== '' || disabled"
            @click="launch(e)"
          >
            {{ running === e.name ? 'Запущен…' : nodeIds.length ? `Запустить на ${nodeIds.length} узел(ах)` : 'Запустить' }}
          </button>
          <em class="os-enr-params">{{ (e.required_params || []).join(', ') }}</em>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { enricherApi } from '@/entities/enricher/api'
import { runEnricher } from '@/features/enricher-run/model'
import type { Enricher, GraphData } from '@/shared/api/types'

const props = defineProps<{
  sketchId: string | null
  nodeIds: string[]
  disabled: boolean
}>()

const emit = defineEmits<{
  (e: 'enriched', g: GraphData): void
}>()

const enrichers = ref<Enricher[]>([])
const busy = ref(false)
const running = ref('')
const filter = ref('')

const categories = computed(() => Array.from(new Set(enrichers.value.map((e) => e.category).filter(Boolean))))
const filtered = computed(() =>
  filter.value ? enrichers.value.filter((e) => e.category === filter.value) : enrichers.value,
)

async function load() {
  busy.value = true
  try {
    const result = await enricherApi.list()
    enrichers.value = result.enrichers || []
  } catch (e) {
    console.error(e)
  } finally {
    busy.value = false
  }
}

async function launch(e: Enricher) {
  if (!props.sketchId || props.nodeIds.length === 0 || running.value) return
  running.value = e.name
  try {
    const g = await runEnricher(e.name, props.nodeIds, props.sketchId)
    emit('enriched', g)
  } catch (err) {
    console.error(err)
    alert(`Ошибка энричера ${e.name}: ${err instanceof Error ? err.message : err}`)
  } finally {
    running.value = ''
  }
}

onMounted(load)
</script>