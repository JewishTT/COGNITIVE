<template>
  <div class="os-palette">
    <div class="os-palette-head">
      <strong>Типы сущностей (Neo4j)</strong>
    </div>

    <div v-if="busy" class="os-side-muted">Загрузка типов…</div>

    <details v-for="cat in categories" :key="cat.label" class="os-cat" :open="cat.label === 'Global' || cat.label === 'Identities & Entities'">
      <summary class="os-cat-head">{{ cat.label }}</summary>
      <button
        v-for="t in cat.children"
        :key="t.name"
        class="os-type-btn"
        @click="selectType(t)"
        :class="{ 'is-active': selected?.name === t.name }"
      >
        <span class="os-node-dot os-type-dot" :style="{ background: t.color || '#22d3ee' }"></span>
        <span class="os-type-name">{{ t.name }}</span>
        <span class="os-type-props">{{ t.fields?.length || 0 }} полей</span>
      </button>
    </details>

    <div v-if="selected" class="os-palette-form">
      <h4>{{ selected.name }}</h4>
      <label class="os-f-label" v-for="f in selected.fields || []" :key="f.name">
        <span>{{ f.name }}</span>
        <input
          class="os-input"
          v-model="form[f.name]"
          :placeholder="f.required ? 'обязательно' : 'необязательно'"
        />
      </label>
      <div class="os-modal-actions">
        <span class="os-side-muted">Имя узла опционально</span>
        <button class="btn" :disabled="adding || !sketchId" @click="createNode">{{ adding ? 'Добавляю…' : '＋ Добавить' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { typeApi } from '@/entities/type/api'
import { buildNodeBody, addNodeToSketch } from '@/features/node-create/model'
import type { GraphNode, NodeType, TypeCategory } from '@/shared/api/types'

const props = defineProps<{ sketchId: string | null }>()

const emit = defineEmits<{
  (e: 'added', node: GraphNode): void
}>()

const categories = ref<TypeCategory[]>([])
const busy = ref(false)
const adding = ref(false)
const selected = ref<NodeType | null>(null)
const form = reactive<Record<string, unknown>>({})

watch(
  () => props.sketchId,
  () => {
    selected.value = null
    for (const k of Object.keys(form)) delete form[k]
  },
)

async function load() {
  if (categories.value.length) return
  busy.value = true
  try {
    categories.value = await typeApi.categories()
  } catch (e) {
    console.error(e)
  } finally {
    busy.value = false
  }
}

function selectType(t: NodeType) {
  selected.value = t
  for (const k of Object.keys(form)) delete form[k]
  for (const f of t.fields || []) {
    form[f.name] = f.required ? '' : undefined
  }
}

async function createNode() {
  if (!props.sketchId || !selected.value) return
  const missing = (selected.value.fields || [])
    .filter((f) => f.required && (String(form[f.name] ?? '').trim() === ''))
    .map((f) => f.name)
  if (missing.length) {
    alert(`Заполните обязательные поля: ${missing.join(', ')}`)
    return
  }
  adding.value = true
  try {
    const label = (String(form.nodeLabel || '') || selected.value.name) as string
    const props_: Record<string, unknown> = {}
    for (const key of Object.keys(form)) {
      if (key !== 'nodeLabel' && form[key] != null && form[key] !== '') props_[key] = form[key]
    }
    const body = buildNodeBody(selected.value, { nodeLabel: label, props: props_ }, selected.value.color)
    const node = await addNodeToSketch(props.sketchId, body)
    emit('added', node)
    selected.value = null
    for (const k of Object.keys(form)) delete form[k]
  } catch (e) {
    console.error(e)
    alert(`Не удалось добавить узел: ${e instanceof Error ? e.message : e}`)
  } finally {
    adding.value = false
  }
}

onMounted(load)
</script>