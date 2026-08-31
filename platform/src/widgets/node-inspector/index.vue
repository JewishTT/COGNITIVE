<template>
  <div class="os-inspector" v-if="node">
    <div class="os-inspector-head">
      <strong>{{ node.nodeLabel }}</strong>
      <button class="os-ico-btn" title="Очистить выделение" @click="$emit('close')">✕</button>
    </div>
    <div class="os-inspector-meta">
      <span class="os-chip os-chip-type">{{ node.nodeType }}</span>
      <span class="os-chip">{{ node.id.slice(0, 14) }}…</span>
    </div>
    <button class="btn os-btn-danger" style="width: 100%" @click="$emit('delete', node.id)">Удалить узел</button>
    <div class="os-inspector-props">
      <div v-for="(v, k) in node.nodeProperties || {}" :key="k" class="os-prop">
        <span class="os-prop-k">{{ k }}</span>
        <span class="os-prop-v">{{ String(v) }}</span>
      </div>
    </div>
  </div>
  <div class="os-inspector os-inspector-empty" v-else>
    <div class="os-side-muted">Ничего не выбрано. Кликните по сущности в графе, чтобы увидеть свойства.</div>
  </div>
</template>

<script setup lang="ts">
import type { GraphNode } from '@/shared/api/types'

defineProps<{ node: GraphNode | null }>()
defineEmits<{ (e: 'close'): void; (e: 'delete', id: string): void }>()
</script>