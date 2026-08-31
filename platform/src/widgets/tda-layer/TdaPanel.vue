<template>
  <aside class="os-tda">
    <div class="os-tda-head">
      <span class="os-tda-title">◆ TDA-анализ</span>
      <span class="os-tda-tip">топологический слой графа</span>
    </div>

    <div v-if="!graph || graph.nds.length === 0" class="os-tda-empty">
      <p>Выберите граф в расследованиях, чтобы прогнать топологический анализ.</p>
    </div>

    <template v-else>
      <div class="os-tda-stats">
        <div class="os-stat"><strong>{{ r.nodeCount }}</strong><span>узлы</span></div>
        <div class="os-stat"><strong>{{ r.edgeCount }}</strong><span>связи</span></div>
        <div class="os-stat"><strong>{{ r.h0 }}</strong><span>H0 миров</span></div>
        <div class="os-stat"><strong>{{ r.h1 }}</strong><span>H1 петель</span></div>
        <div class="os-stat"><strong>{{ r.bridges.length }}</strong><span>мосты</span></div>
        <div class="os-stat"><strong>{{ r.cutVertices.length }}</strong><span>шарниры</span></div>
      </div>

      <div class="os-tda-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="os-tda-tab"
          :class="{ 'is-on': active === tab.key }"
          @click="active = tab.key"
        >
          {{ tab.label }}
          <em v-if="tab.count">{{ tab.count }}</em>
        </button>
      </div>
      <div class="os-tda-body">
        <div v-if="active === 'struct'">
          <div class="os-tda-sec">Связные компоненты (H0)</div>
          <button v-for="(c, i) in r.components" :key="c.id" class="os-row" @click="toggleHighlight(c.nodeIds)">
            <span class="os-dot" :style="{ background: colorFor(i) }"></span>
            <span class="os-row-title">Компонент {{ i + 1 }}</span>
            <span class="os-row-meta">{{ c.size }} узлов · {{ c.edgeCount }} связей</span>
            <span class="os-chip os-chip-loop" v-if="c.loopCount > 0">{{ c.loopCount }} петли</span>
          </button>

          <div class="os-tda-sec os-tda-sec-gap">Обнаруженные циклы (H1)</div>
          <div v-if="r.cycles.length === 0" class="os-tda-muted">Циклов нет — граф ацикличен.</div>
          <button v-for="cy in r.cycles" :key="cy.id" class="os-row" @click="toggleHighlight(cy.nodeIds)">
            <span class="os-row-icon">⭮</span>
            <span class="os-row-title">Петля {{ cy.id + 1 }} · {{ cy.length }} узлов</span>
          </button>
        </div>

        <div v-else-if="active === 'clusters'">
          <div class="os-tda-sec">Пространственные кластеры (одиночная связь)</div>
          <button v-for="(cl, i) in r.clusters" :key="cl.id" class="os-row" @click="toggleHighlight(cl.nodeIds)">
            <span class="os-dot" :style="{ background: colorFor(i) }"></span>
            <span class="os-row-title">Кластер {{ i + 1 }}</span>
            <span class="os-row-meta">«{{ cl.representative }}» + {{ cl.size - 1 }}</span>
            <span class="os-chip">{{ cl.size }}</span>
          </button>
</div>
        <div v-else-if="active === 'critical'">
          <div class="os-tda-sec">Критические связи — мосты</div>
          <div v-if="r.bridges.length === 0" class="os-tda-muted">Мостов нет.</div>
          <div v-for="br in r.bridges" :key="br.edgeId" class="os-bridge">
            <span class="os-bridge-line">{{ br.fromLabel }} ↔ {{ br.toLabel }}</span>
            <span class="os-bridge-type">{{ br.label }}</span>
          </div>
          <div class="os-tda-sec os-tda-sec-gap">Шарниры — узлы расщепления</div>
          <div v-if="r.cutVertices.length === 0" class="os-tda-muted">Шарниров нет.</div>
          <button v-for="cv in r.cutVertices" :key="cv.nodeId" class="os-row" @click="toggleHighlight([cv.nodeId])">
            <span class="os-row-icon">✦</span>
            <span class="os-row-title">{{ cv.label }}</span>
            <span class="os-row-meta">→ {{ cv.splitComponents }} частей</span>
          </button>
        </div>

        <div v-else-if="active === 'centrality'">
          <div class="os-tda-sec">Хабы по посредничеству (betweenness)</div>
          <div v-for="(top, i) in topHubs" :key="top.nodeId" class="os-row os-row-plain" @click="toggleHighlight([top.nodeId])">
            <span class="os-rank">{{ i + 1 }}</span>
            <span class="os-row-title">{{ top.label }}</span>
            <span class="os-row-meta">Δ{{ top.betweenness.toFixed(2) }} · k{{ top.kCore }}</span>
          </div>
          <div class="os-tda-sec os-tda-sec-gap">Плотные ядра (k-core)</div>
          <div v-for="(top, i) in topCores" :key="top.nodeId" class="os-row os-row-plain" @click="toggleHighlight([top.nodeId])">
            <span class="os-rank">{{ i + 1 }}</span>
            <span class="os-row-title">{{ top.label }}</span>
            <span class="os-row-meta">k-core {{ top.kCore }} · degree {{ top.degree }}</span>
          </div>
        </div>

        <div v-else-if="active === 'barcode'">
          <div class="os-tda-sec">0-мерный баркод устойчивости</div>
          <div class="os-barcode">
            <div v-for="(bar, i) in r.bars" :key="i" class="os-bar-row">
              <div class="os-bar-track">
                <div class="os-bar-fill" :style="barStyle(bar, i)"></div>
              </div>
              <span class="os-bar-size">{{ bar.size }}</span>
            </div>
          </div>
          <p class="os-tda-muted">
            Каждый бар — кластер; его длина — «жизнь» до слияния с соседом в масштабе пространственной близости.
          </p>
        </div>

        <div v-else-if="active === 'weights'">
          <div class="os-tda-sec">Весовой баркод (TheBigBrother)</div>
          <p class="os-tda-muted">
            Вес ребра — экспертная уверенность платформы (LinkedIn 0.95 … Pastebin 0.3). По мере роста
            порога слабые связи отсекаются, и топология «проявляется»: устойчивые циклы (H1) —
            признак единой личности across платформ.
          </p>
          <div class="os-barcode">
            <div v-for="(bar, i) in wf" :key="i" class="os-bar-row os-bar-row-weights">
              <span class="os-bar-thr">≥{{ bar.threshold.toFixed(2) }}</span>
              <div class="os-bar-track">
                <div class="os-bar-fill" :style="{ width: bar.betti0 ? '100%' : '0%', background: colorFor(i) }"></div>
                <div class="os-bar-fill os-bar-fill-2" :style="{ width: Math.min(100, bar.cycleRank * 22) + '%', background: '#fbbf24' }"></div>
              </div>
              <span class="os-bar-size">β₀ {{ bar.betti0 }} · H₁ {{ bar.cycleRank }}</span>
            </div>
          </div>
          <p v-if="wf.length === 0" class="os-tda-muted">Нет взвешенных рёбер — загрузите демо TheBigBrother.</p>
        </div>

        <p v-if="highlighted.length" class="os-tda-hint">
          Подсвечено {{ highlighted.length }} узлов на графе · <a @click="clear">сброс</a>
        </p>
</div>
    </template>
  </aside>
</template>
      <script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { analyzeTda, colorFor, weightFiltration, type NodeMetric, type PersistenceBar, type TdaResult, type WeightBar } from '@/shared/lib/tda'
import type { GraphData } from '@/shared/api/types'
const props = defineProps<{ graph: GraphData | null; highlightIds?: string[] }>()

const emit = defineEmits<{
  (e: 'highlight', ids: string[]): void
  (e: 'clear'): void
}>()

const active = ref<'struct' | 'clusters' | 'critical' | 'centrality' | 'barcode'>('struct')
const highlighted = ref<string[]>([])

const r = computed<TdaResult | null>(() => {
  if (!props.graph || props.graph.nds.length === 0) return null
  return analyzeTda(
    props.graph.nds.map((n) => ({ id: n.id, label: n.nodeLabel, type: n.nodeType, x: n.x ?? 0, y: n.y ?? 0 })),
    props.graph.rls.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, type: e.type, weight: e.weight != null ? e.weight : null })),
  )
})

const wf = computed<WeightBar[]>(() => {
  if (!props.graph || props.graph.nds.length === 0) return []
  return weightFiltration(
    props.graph.nds.map((n) => ({ id: n.id, label: n.nodeLabel, type: n.nodeType, x: n.x ?? 0, y: n.y ?? 0 })),
    props.graph.rls.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, type: e.type, weight: e.weight != null ? e.weight : null })),
  )
})

const tabs = computed(() => [
  { key: 'struct', label: 'Структура', count: r.value ? r.value.h1 : 0 },
  { key: 'clusters', label: 'Кластеры', count: r.value ? r.value.clusters.length : 0 },
  { key: 'critical', label: 'Критическое', count: r.value ? r.value.bridges.length + r.value.cutVertices.length : 0 },
  { key: 'centrality', label: 'Центральность', count: 0 },
  { key: 'barcode', label: 'Баркод', count: 0 },
  { key: 'weights', label: 'Веса', count: wf.value.length },
])

const topHubs = computed<NodeMetric[]>(() =>
  (r.value?.metrics || []).slice().sort((a, b) => b.betweenness - a.betweenness).slice(0, 8),
)

const topCores = computed<NodeMetric[]>(() =>
  (r.value?.metrics || []).slice().sort((a, b) => b.kCore - a.kCore || b.degree - a.degree).slice(0, 8),
)

function maxDeath(): number {
  const bars = r.value?.bars || []
  let mx = 1
  for (const b of bars) if (b.death != null && b.death > mx) mx = b.death
  return mx
}

function barStyle(bar: PersistenceBar, i: number) {
  const width = bar.death == null ? 100 : Math.max(4, Math.round((bar.death / maxDeath()) * 100))
  return { width: `${width}%`, background: colorFor(i) }
}

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v))
}

function toggleHighlight(ids: string[]) {
  if (highlighted.value.length && arraysEqual(highlighted.value, ids)) {
    highlighted.value = []
    emit('clear')
    return
  }
  highlighted.value = ids
  emit('highlight', ids)
}

function clear() {
  highlighted.value = []
  emit('clear')
}

/* Keep the panel's hint in sync when the 3D stage selects a triangle. */
watch(() => props.highlightIds, (ids) => {
  highlighted.value = ids || []
})
</script>