<template>
  <div class="os-tda-into">
    <div class="os-palette-head" style="cursor: pointer" @click="open = !open">
      <strong>TDA-слой · симплициальный комплекс</strong>
      <span class="os-side-muted">{{ open ? '▾' : '▸' }}</span>
    </div>

    <div v-if="open">
      <Tda3D v-if="graph && graph.nds.length" :graph="graph" :highlight-ids="highlightIds" @highlight="$emit('highlight', $event)" @clear="$emit('clear')" />
      <div v-else class="os-tda-empty-stage">
        <p class="os-tda-empty-title">Граф не загружен</p>
        <p class="os-tda-empty-sub">Выберите граф слева либо откройте демо — analysis появится здесь.</p>
      </div>
      <TdaPanel :graph="graph" :highlight-ids="highlightIds" @highlight="$emit('highlight', $event)" @clear="$emit('clear')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tda3D from './Tda3D.vue'
import TdaPanel from './TdaPanel.vue'
import type { GraphData } from '@/shared/api/types'

defineProps<{ graph: GraphData | null; highlightIds?: string[] }>()
defineEmits<{ (e: 'highlight', ids: string[]): void; (e: 'clear'): void }>()

const open = ref(true)
</script>