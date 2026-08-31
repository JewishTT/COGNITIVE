<template>
  <div class="os-tda-results">
    <!-- Tabs Navigation -->
    <div class="os-tda-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="os-tda-tab"
        :class="{ 'is-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="os-tab-icon">{{ tab.icon }}</span>
        <span class="os-tab-label">{{ tab.label }}</span>
        <span v-if="tab.count > 0" class="os-tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="os-tda-tab-content">
      <!-- Components Tab -->
      <div v-if="activeTab === 'components'" class="os-tda-section">
        <div class="os-tda-section-header">
          <h4>[38;5;220mConnected Components (H0)[0m</h4>
          <span class="os-tda-section-count">{{ result.components?.length || 0 }}</span>
        </div>
        
        <div v-if="result.components && result.components.length > 0" class="os-tda-list">
          <div
            v-for="(component, index) in result.components"
            :key="component.id"
            class="os-tda-item"
            :class="{ 'is-highlighted': isHighlighted(component.nodeIds) }"
            @click="toggleHighlight(component.nodeIds)"
          >
            <div class="os-tda-item-header">
              <span class="os-tda-item-icon" :style="{ background: getColor(index) }"></span>
              <div class="os-tda-item-info">
                <span class="os-tda-item-title">Component {{ index + 1 }}</span>
                <span class="os-tda-item-meta">
                  {{ component.size }} nodes [38;5;240m|[0m {{ component.edgeCount }} edges
                </span>
              </div>
            </div>
            <div class="os-tda-item-details">
              <span v-if="component.isTree" class="os-tda-badge os-tda-badge-tree">Tree</span>
              <span v-if="component.loopCount > 0" class="os-tda-badge os-tda-badge-loop">
                {{ component.loopCount }} cycles
              </span>
              <span v-else class="os-tda-badge os-tda-badge-acyclic">Acyclic</span>
            </div>
          </div>
        </div>
        <div v-else class="os-tda-empty-state">
          <p>[38;5;240mNo connected components found[0m</p>
        </div>
      </div>

      <!-- Cycles Tab -->
      <div v-if="activeTab === 'cycles'" class="os-tda-section">
        <div class="os-tda-section-header">
          <h4>[38;5;214mCycles (H1)[0m</h4>
          <span class="os-tda-section-count">{{ result.cycles?.length || 0 }}</span>
        </div>
        
        <div v-if="result.cycles && result.cycles.length > 0" class="os-tda-list">
          <div
            v-for="(cycle, index) in result.cycles"
            :key="cycle.id"
            class="os-tda-item"
            :class="{ 'is-highlighted': isHighlighted(cycle.nodeIds) }"
            @click="toggleHighlight(cycle.nodeIds)"
          >
            <div class="os-tda-item-header">
              <span class="os-tda-item-icon">[38;5;214m[0m</span>
              <div class="os-tda-item-info">
                <span class="os-tda-item-title">Cycle {{ index + 1 }}</span>
                <span class="os-tda-item-meta">
                  {{ cycle.length }} nodes [38;5;240m|[0m {{ cycle.filled ? 'Filled' : 'Hollow' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="os-tda-empty-state">
          <p>[38;5;240mNo cycles found [38;5;240m|[0m Graph is a forest or tree[0m</p>
        </div>
      </div>

      <!-- Critical Tab -->
      <div v-if="activeTab === 'critical'" class="os-tda-section">
        <div class="os-tda-subsection">
          <div class="os-tda-section-header">
            <h4>[38;5;196mBridges[0m</h4>
            <span class="os-tda-section-count">{{ result.bridges?.length || 0 }}</span>
          </div>
          
          <div v-if="result.bridges && result.bridges.length > 0" class="os-tda-list">
            <div
              v-for="(bridge, index) in result.bridges"
              :key="bridge.edgeId"
              class="os-tda-item"
              @click="toggleHighlight([bridge.source, bridge.target])"
            >
              <div class="os-tda-item-header">
                <span class="os-tda-item-icon">[38;5;196m[0m</span>
                <div class="os-tda-item-info">
                  <span class="os-tda-item-title">{{ bridge.fromLabel }} [38;5;240m[0m[38;5;240m[0m[38;5;240m[0m {{ bridge.toLabel }}</span>
                  <span class="os-tda-item-meta">{{ bridge.label }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="os-tda-empty-state">
            <p>[38;5;240mNo bridges found [38;5;240m|[0m Graph has no critical connections[0m</p>
          </div>
        </div>

        <div class="os-tda-subsection">
          <div class="os-tda-section-header">
            <h4>[38;5;196mCut Vertices (Articulation Points)[0m</h4>
            <span class="os-tda-section-count">{{ result.cutVertices?.length || 0 }}</span>
          </div>
          
          <div v-if="result.cutVertices && result.cutVertices.length > 0" class="os-tda-list">
            <div
              v-for="(vertex, index) in result.cutVertices"
              :key="vertex.nodeId"
              class="os-tda-item"
              @click="toggleHighlight([vertex.nodeId])"
            >
              <div class="os-tda-item-header">
                <span class="os-tda-item-icon">[38;5;196m[0m</span>
                <div class="os-tda-item-info">
                  <span class="os-tda-item-title">{{ vertex.label }}</span>
                  <span class="os-tda-item-meta">
                    Splits into {{ vertex.splitComponents }} components when removed
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="os-tda-empty-state">
            <p>[38;5;240mNo cut vertices found [38;5;240m|[0m Graph is biconnected[0m</p>
          </div>
        </div>
      </div>

      <!-- Centrality Tab -->
      <div v-if="activeTab === 'centrality'" class="os-tda-section">
        <div class="os-tda-subsection">
          <div class="os-tda-section-header">
            <h4>[38;5;220mBetweenness Centrality[0m</h4>
            <span class="os-tda-section-count">{{ topBetweenness.length }}</span>
          </div>
          
          <div v-if="topBetweenness.length > 0" class="os-tda-list">
            <div
              v-for="(node, index) in topBetweenness"
              :key="node.nodeId"
              class="os-tda-item"
              @click="toggleHighlight([node.nodeId])"
            >
              <div class="os-tda-item-header">
                <span class="os-rank">{{ index + 1 }}</span>
                <div class="os-tda-item-info">
                  <span class="os-tda-item-title">{{ node.label }}</span>
                  <span class="os-tda-item-meta">
                    [38;5;220mBetweenness: {{ node.betweenness.toFixed(4) }}[0m
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="os-tda-empty-state">
            <p>[38;5;240mNo centrality data available[0m</p>
          </div>
        </div>

        <div class="os-tda-subsection">
          <div class="os-tda-section-header">
            <h4>[38;5;220mK-Core Centrality[0m</h4>
            <span class="os-tda-section-count">{{ topKCore.length }}</span>
          </div>
          
          <div v-if="topKCore.length > 0" class="os-tda-list">
            <div
              v-for="(node, index) in topKCore"
              :key="node.nodeId"
              class="os-tda-item"
              @click="toggleHighlight([node.nodeId])"
            >
              <div class="os-tda-item-header">
                <span class="os-rank">{{ index + 1 }}</span>
                <div class="os-tda-item-info">
                  <span class="os-tda-item-title">{{ node.label }}</span>
                  <span class="os-tda-item-meta">
                    [38;5;220mK-Core: {{ node.kCore }}[0m [38;5;240m|[0m Degree: {{ node.degree }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="os-tda-empty-state">
            <p>[38;5;240mNo k-core data available[0m</p>
          </div>
        </div>
      </div>

      <!-- Clusters Tab -->
      <div v-if="activeTab === 'clusters'" class="os-tda-section">
        <div class="os-tda-section-header">
          <h4>[38;5;208mClusters[0m</h4>
          <span class="os-tda-section-count">{{ result.clusters?.length || 0 }}</span>
        </div>
        
        <div v-if="result.clusters && result.clusters.length > 0" class="os-tda-list">
          <div
            v-for="(cluster, index) in result.clusters"
            :key="cluster.id"
            class="os-tda-item"
            :class="{ 'is-highlighted': isHighlighted(cluster.nodeIds) }"
            @click="toggleHighlight(cluster.nodeIds)"
          >
            <div class="os-tda-item-header">
              <span class="os-tda-item-icon" :style="{ background: getColor(index) }"></span>
              <div class="os-tda-item-info">
                <span class="os-tda-item-title">Cluster {{ index + 1 }}</span>
                <span class="os-tda-item-meta">
                  {{ cluster.size }} nodes [38;5;240m|[0m Rep: {{ cluster.representative }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="os-tda-empty-state">
          <p>[38;5;240mNo clusters found[0m</p>
        </div>
      </div>

      <!-- Barcode Tab -->
      <div v-if="activeTab === 'barcode'" class="os-tda-section">
        <div class="os-tda-section-header">
          <h4>[38;5;220mPersistence Barcode[0m</h4>
          <span class="os-tda-section-count">{{ result.bars?.length || 0 }}</span>
        </div>
        
        <div v-if="result.bars && result.bars.length > 0" class="os-tda-barcode">
          <div
            v-for="(bar, index) in result.bars"
            :key="index"
            class="os-tda-bar"
            @click="highlightBarNodes(index)"
          >
            <div class="os-tda-bar-track">
              <div 
                class="os-tda-bar-fill" 
                :style="{ 
                  width: bar.death ? `${((bar.death - bar.birth) / maxPersistence) * 100}%` : '100%',
                  background: getBarColor(index)
                }"
              ></div>
            </div>
            <span class="os-tda-bar-label">
              {{ bar.size }} nodes [38;5;240m|[0m Birth: {{ bar.birth.toFixed(2) }}
            </span>
          </div>
        </div>
        <div v-else class="os-tda-empty-state">
          <p>[38;5;240mNo persistence data available[0m</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TdaResult, NodeMetric } from '@/shared/lib/tda'
import type { GraphData } from '@/shared/api/types'

const props = defineProps<{ 
  graph: GraphData | null;
  result: TdaResult | null;
  highlightIds?: string[]
}>()

const emit = defineEmits<{ 
  (e: 'highlight', ids: string[]): void 
  (e: 'clear'): void 
}>()

// State
const activeTab = ref<'components' | 'cycles' | 'critical' | 'centrality' | 'clusters' | 'barcode'>('components')

// Tabs configuration
const tabs = computed(() => [
  { key: 'components', label: 'Components', icon: '[38;5;220mH0[0m', count: props.result?.components?.length || 0 },
  { key: 'cycles', label: 'Cycles', icon: '[38;5;214mH1[0m', count: props.result?.cycles?.length || 0 },
  { key: 'critical', label: 'Critical', icon: '[38;5;196m![0m', count: (props.result?.bridges?.length || 0) + (props.result?.cutVertices?.length || 0) },
  { key: 'centrality', label: 'Centrality', icon: '[38;5;220m*[0m', count: props.result?.metrics?.length || 0 },
  { key: 'clusters', label: 'Clusters', icon: '[38;5;208m#[0m', count: props.result?.clusters?.length || 0 },
  { key: 'barcode', label: 'Barcode', icon: '[38;5;220m=[0m', count: props.result?.bars?.length || 0 }
])

// Computed properties for top metrics
const topBetweenness = computed<NodeMetric[]>(() => {
  if (!props.result?.metrics) return []
  return [...props.result.metrics]
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 10)
})

const topKCore = computed<NodeMetric[]>(() => {
  if (!props.result?.metrics) return []
  return [...props.result.metrics]
    .sort((a, b) => b.kCore - a.kCore)
    .slice(0, 10)
})

// Max persistence for barcode visualization
const maxPersistence = computed<number>(() => {
  if (!props.result?.bars) return 1
  const max = Math.max(...props.result.bars.map(b => b.death ? b.death - b.birth : 1))
  return max > 0 ? max : 1
})

// Methods
function toggleHighlight(ids: string[]) {
  const currentHighlights = props.highlightIds || []
  const newHighlights = currentHighlights.length > 0 && 
    currentHighlights.every(id => ids.includes(id)) 
    ? [] 
    : ids
  emit('highlight', newHighlights)
}

function isHighlighted(ids: string[]): boolean {
  if (!props.highlightIds || props.highlightIds.length === 0) return false
  return ids.some(id => props.highlightIds.includes(id))
}

function highlightBarNodes(index: number) {
  if (!props.result?.bars || !props.graph) return
  // This would need to map bars to actual node IDs
  // For now, just clear highlights
  emit('clear')
}

function getColor(index: number): string {
  const colors = [
    '#22d3ee', // Cyan
    '#a3e635', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981'  // Emerald
  ]
  return colors[index % colors.length]
}

function getBarColor(index: number): string {
  const colors = [
    'rgba(34, 211, 238, 0.8)',
    'rgba(163, 230, 53, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)'
  ]
  return colors[index % colors.length]
}
</script>

<style scoped>
/* Tabs */
.os-tda-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  flex-wrap: wrap;
}

.os-tda-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.8rem;
}

.os-tda-tab:hover {
  background: var(--bg-tertiary);
  color: var(--text);
}

.os-tda-tab.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.os-tab-icon {
  font-size: 0.9rem;
}

.os-tab-label {
  font-size: 0.8rem;
}

.os-tab-count {
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--bg-secondary);
  font-size: 0.65rem;
  color: var(--text-muted);
}

.os-tda-tab.is-active .os-tab-count {
  background: rgba(0, 0, 0, 0.2);
  color: white;
}

/* Sections */
.os-tda-section {
  margin-bottom: 16px;
}

.os-tda-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.os-tda-section-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.os-tda-section-count {
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.os-tda-subsection {
  margin-bottom: 16px;
}

/* List Items */
.os-tda-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.os-tda-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.os-tda-item:hover {
  background: var(--bg-hover);
}

.os-tda-item.is-highlighted {
  border: 1px solid var(--accent);
  background: rgba(34, 211, 238, 0.1);
}

.os-tda-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.os-tda-item-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
}

.os-tda-item-info {
  display: flex;
  flex-direction: column;
}

.os-tda-item-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

.os-tda-item-meta {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.os-tda-item-details {
  display: flex;
  gap: 6px;
}

/* Badges */
.os-tda-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.65rem;
  font-weight: 500;
}

.os-tda-badge-tree {
  background: rgba(34, 211, 238, 0.2);
  color: #22d3ee;
}

.os-tda-badge-loop {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.os-tda-badge-acyclic {
  background: rgba(163, 230, 53, 0.2);
  color: #a3e635;
}

/* Rank */
.os-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Barcode */
.os-tda-barcode {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.os-tda-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.os-tda-bar:hover {
  opacity: 0.8;
}

.os-tda-bar-track {
  flex: 1;
  height: 20px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.os-tda-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.os-tda-bar-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Empty State */
.os-tda-empty-state {
  text-align: center;
  padding: 16px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Responsive */
@media (max-width: 900px) {
  .os-tda-tabs {
    gap: 1px;
  }
  
  .os-tda-tab {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
  
  .os-tda-stat {
    padding: 6px;
  }
  
  .os-tda-item {
    padding: 6px 8px;
  }
}
</style>
