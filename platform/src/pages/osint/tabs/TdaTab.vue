<template>
  <div class="tda-tab">
    <!-- TDA Header with Description -->
    <div class="tda-header">
      <div class="tda-info">
        <h2 class="tda-title">
          <span class="title-icon"><UiIcon name="calculator" /></span>
          Topological Data Analysis
        </h2>
        <p class="tda-description">
          Глубокий анализ структуры графов с использованием методов топологической теории данных.
          Выявляйте скрытые паттерны, сообщества и аномалии.
        </p>
      </div>
      <div class="tda-actions">
        <button class="btn btn-secondary" @click="loadFromGraph" :disabled="!selectedGraph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Загрузить из графа
        </button>
        <button class="btn btn-primary" @click="runTdaAnalysis" :disabled="loading">
          <span class="btn-icon animate-spin" v-if="loading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
            </svg>
          </span>
          <span v-else>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
            </svg>
            Запустить TDA
          </span>
        </button>
      </div>
    </div>

    <!-- Configuration Panel -->
    <div class="tda-config glass-card" v-if="!analysisId">
      <h3 class="config-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Конфигурация TDA
      </h3>
      
      <div class="config-grid">
        <div class="config-group">
          <label class="config-label">Размерность</label>
          <select v-model="config.dimension" class="form-select" :disabled="loading">
            <option value="2">2D (Рипс комплекс)</option>
            <option value="3">3D (Кубический комплекс)</option>
          </select>
        </div>
        
        <div class="config-group">
          <label class="config-label">Метрика расстояния</label>
          <select v-model="config.distanceMetric" class="form-select" :disabled="loading">
            <option value="euclidean">Евклидова</option>
            <option value="cosine">Косинусная</option>
            <option value="manhattan">Манхэттенская</option>
          </select>
        </div>
        
        <div class="config-group">
          <label class="config-label">Радиус (ε)</label>
          <input 
            type="number" 
            v-model.number="config.radius" 
            class="form-input" 
            min="0.1" 
            max="10" 
            step="0.1"
            :disabled="loading"
          />
        </div>
        
        <div class="config-group">
          <label class="config-label">Макс. симплексов</label>
          <input 
            type="number" 
            v-model.number="config.maxSimplices" 
            class="form-input" 
            min="100" 
            max="10000"
            :disabled="loading"
          />
        </div>
        
        <div class="config-group">
          <label class="config-label">Порог персистентности</label>
          <input 
            type="range" 
            v-model.number="config.persistenceThreshold" 
            class="form-range" 
            min="0" 
            max="1" 
            step="0.05"
            :disabled="loading"
          />
          <span class="range-value">{{ config.persistenceThreshold }}</span>
        </div>
      </div>
      
      <div class="config-options">
        <label class="config-checkbox">
          <input type="checkbox" v-model="config.includeBarcode" :disabled="loading">
          <span class="checkbox-label">Включить Barcode</span>
        </label>
        <label class="config-checkbox">
          <input type="checkbox" v-model="config.includePersistenceDiagram" :disabled="loading">
          <span class="checkbox-label">Персистентная диаграмма</span>
        </label>
        <label class="config-checkbox">
          <input type="checkbox" v-model="config.includeBettiNumbers" :disabled="loading">
          <span class="checkbox-label">Числа Бетти</span>
        </label>
        <label class="config-checkbox">
          <input type="checkbox" v-model="config.includeCentrality" :disabled="loading">
          <span class="checkbox-label">Центральность</span>
        </label>
        <label class="config-checkbox">
          <input type="checkbox" v-model="config.includeCommunities" :disabled="loading">
          <span class="checkbox-label">Обнаружение сообществ</span>
        </label>
      </div>
    </div>

    <!-- Analysis Results Panel -->
    <div class="tda-results" v-else>
      <div class="results-header">
        <h3 class="results-title">
          <span class="status-indicator" :class="statusClass"></span>
          Результаты анализа TDA
        </h3>
        <div class="results-meta">
          <span class="meta-item">ID: {{ analysisId }}</span>
          <span class="meta-item">Граф: {{ selectedGraph?.name || 'Неизвестно' }}</span>
          <span class="meta-item">Время: {{ formatDuration(duration) }}</span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container" v-if="status === 'running'">
        <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
        <span class="progress-text">{{ progress }}%</span>
      </div>

      <!-- Results Tabs -->
      <div class="results-tabs">
        <button 
          v-for="tab in resultTabs" 
          :key="tab.id" 
          class="result-tab" 
          :class="{ active: activeResultTab === tab.id }"
          @click="activeResultTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="results-content">
        <transition name="fade" mode="out-in">
          <!-- Overview -->
          <div class="result-panel" v-if="activeResultTab === 'overview'" key="overview">
            <div class="overview-grid">
              <div class="overview-card">
                <div class="card-header">
                  <h4>Числа Бетти</h4>
                  <span class="card-icon"><UiIcon name="calculator" /></span>
                </div>
                <div class="betti-numbers">
                  <div class="betti-item" v-for="(value, dim) in bettiNumbers" :key="dim">
                    <div class="betti-dim">H{{ dim }}</div>
                    <div class="betti-value">{{ value }}</div>
                  </div>
                </div>
                <div class="betti-info">
                  <p>H0: Количество связных компонент</p>
                  <p>H1: Количество "дыр" (циклов)</p>
                  <p>H2: Количество "полостей"</p>
                </div>
              </div>

              <div class="overview-card">
                <div class="card-header">
                  <h4>Компоненты</h4>
                  <span class="card-icon"><UiIcon name="link" /></span>
                </div>
                <div class="components-list">
                  <div class="component-item" v-for="(comp, index) in components" :key="index">
                    <div class="component-info">
                      <span class="component-name">Компонента {{ index + 1 }}</span>
                      <span class="component-nodes">{{ comp.nodes.length }} узлов</span>
                    </div>
                    <div class="component-visual">
                      <div 
                        class="component-bar" 
                        :style="{ width: `${(comp.nodes.length / maxComponentSize) * 100}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="overview-card">
                <div class="card-header">
                  <h4>Циклы</h4>
                  <span class="card-icon"><UiIcon name="refresh" /></span>
                </div>
                <div class="cycles-info">
                  <div class="cycle-count">{{ cycles.length }} циклов обнаружено</div>
                  <div class="cycle-sizes">
                    <span class="size-badge" v-for="(size, idx) in cycleSizes" :key="idx">
                      {{ size }} узлов
                    </span>
                  </div>
                </div>
              </div>

              <div class="overview-card">
                <div class="card-header">
                  <h4>Критические точки</h4>
                  <span class="card-icon"><UiIcon name="star" /></span>
                </div>
                <div class="critical-points">
                  <div class="point-count">{{ criticalPoints.length }} точек</div>
                  <div class="point-threshold">Порог: {{ persistenceThreshold }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Persistence Diagram -->
          <div class="result-panel" v-else-if="activeResultTab === 'persistence'" key="persistence">
            <div class="persistence-container">
              <svg class="persistence-svg" ref="persistenceSvg"></svg>
              <div class="persistence-legend">
                <div class="legend-item" v-for="(color, dim) in persistenceColors" :key="dim">
                  <span class="legend-color" :style="{ background: color }"></span>
                  <span class="legend-label">H{{ dim }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Barcode -->
          <div class="result-panel" v-else-if="activeResultTab === 'barcode'" key="barcode">
            <div class="barcode-container">
              <div class="barcode-track" v-for="(track, idx) in barcode" :key="idx">
                <div class="barcode-label">H{{ idx }}</div>
                <div class="barcode-bars">
                  <div 
                    class="barcode-bar" 
                    v-for="(bar, barIdx) in track" 
                    :key="barIdx"
                    :style="{
                      left: `${bar.start * 100}%`,
                      width: `${(bar.end - bar.start) * 100}%`,
                      background: persistenceColors[idx]
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Centrality -->
          <div class="result-panel" v-else-if="activeResultTab === 'centrality'" key="centrality">
            <div class="centrality-container">
              <div class="centrality-tabs">
                <button 
                  v-for="metric in centralityMetrics" 
                  :key="metric" 
                  class="centrality-tab" 
                  :class="{ active: activeCentralityMetric === metric }"
                  @click="activeCentralityMetric = metric"
                >
                  {{ metricLabels[metric] || metric }}
                </button>
              </div>
              <div class="centrality-visual">
                <svg class="centrality-svg" ref="centralitySvg"></svg>
              </div>
              <div class="centrality-table">
                <div class="table-header">
                  <span>Узел</span>
                  <span>Значение</span>
                </div>
                <div class="table-body">
                  <div 
                    class="table-row" 
                    v-for="(value, node) in sortedCentrality[activeCentralityMetric]" 
                    :key="node"
                  >
                    <span class="row-node">{{ node }}</span>
                    <span class="row-value">{{ value.toFixed(4) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Communities -->
          <div class="result-panel" v-else-if="activeResultTab === 'communities'" key="communities">
            <div class="communities-container">
              <div class="communities-grid">
                <div 
                  class="community-card" 
                  v-for="(community, idx) in communities" 
                  :key="idx"
                  :style="{ background: communityColors[idx] }"
                >
                  <div class="community-header">
                    <span class="community-id">Сообщество {{ idx + 1 }}</span>
                    <span class="community-size">{{ community.nodes.length }} узлов</span>
                  </div>
                  <div class="community-nodes">
                    <span class="node-tag" v-for="node in community.nodes.slice(0, 5)" :key="node">
                      {{ node }}
                    </span>
                    <span class="node-more" v-if="community.nodes.length > 5">
                      +{{ community.nodes.length - 5 }}...
                    </span>
                  </div>
                  <div class="community-modularity">
                    Модульность: {{ community.modularity.toFixed(4) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3D Visualization -->
          <div class="result-panel" v-else-if="activeResultTab === '3d'" key="3d">
            <div class="visualization-container">
              <div class="visualization-toolbar">
                <button class="toolbar-btn" @click="resetCamera" title="Сбросить камеру">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </button>
                <button class="toolbar-btn" @click="toggleLabels" title="Показать/скрыть метки">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 12h4"/>
                  </svg>
                </button>
                <button class="toolbar-btn" @click="toggleEdges" title="Показать/скрыть связи">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
              <div class="visualization-canvas" ref="tdaCanvas"></div>
              <div class="visualization-legend">
                <div class="legend-group">
                  <span class="legend-title">Цвета:</span>
                  <div class="legend-items">
                    <div class="legend-item" v-for="(color, idx) in communityColors" :key="idx">
                      <span class="legend-dot" :style="{ background: color }"></span>
                      <span class="legend-text">Сообщество {{ idx + 1 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Actions Panel -->
    <div class="tda-actions-panel glass-card" v-if="analysisId">
      <h4 class="actions-title">Действия</h4>
      <div class="actions-grid">
        <button class="action-btn" @click="exportResults" title="Экспорт результатов">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Экспорт</span>
        </button>
        <button class="action-btn" @click="saveAnalysis" title="Сохранить анализ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>Сохранить</span>
        </button>
        <button class="action-btn" @click="shareAnalysis" title="Поделиться">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>Поделиться</span>
        </button>
        <button class="action-btn action-btn-danger" @click="deleteAnalysis" title="Удалить анализ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Удалить</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGraphStore } from '@/stores/graphStore'
import { useTdaStore } from '@/stores/tdaStore'

// Stores
const graphStore = useGraphStore()
const tdaStore = useTdaStore()

// State
const loading = ref(false)
const analysisId = ref<string | null>(null)
const status = ref<'idle' | 'running' | 'completed' | 'failed'>('idle')
const progress = ref(0)
const duration = ref(0)
const startTime = ref<Date | null>(null)

// Configuration
const config = ref({
  dimension: 2,
  distanceMetric: 'euclidean' as const,
  radius: 1.0,
  maxSimplices: 1000,
  persistenceThreshold: 0.5,
  includeBarcode: true,
  includePersistenceDiagram: true,
  includeBettiNumbers: true,
  includeCentrality: true,
  includeCommunities: true,
})

// Results
const bettiNumbers = ref<Record<number, number>>({})
const components = ref<Array<{ id: string; nodes: string[]; birth: number; death: number }>>([])
const cycles = ref<Array<{ id: string; nodes: string[] }>>([])
const criticalPoints = ref<unknown[]>([])
const persistenceDiagram = ref<Array<{ birth: number; death: number; dimension: number }>>([])
const barcode = ref<Array<{ start: number; end: number; dimension: number }[]>>([])
const centrality = ref<Record<string, Record<string, number>>>({})
const communities = ref<Array<{ id: string; nodes: string[]; size: number; modularity: number }>>([])

// UI State
const activeResultTab = ref('overview')
const activeCentralityMetric = ref('degree')
const showLabels = ref(true)
const showEdges = ref(true)

// Selected graph
const selectedGraph = computed(() => graphStore.selectedGraph)

// Result tabs
const resultTabs = computed(() => [
  { id: 'overview', label: 'Обзор', icon: 'chartBar' },
  { id: 'persistence', label: 'Персистентность', icon: 'chartLine', count: persistenceDiagram.value.length },
  { id: 'barcode', label: 'Barcode', icon: 'clipboard', count: barcode.value.length },
  { id: 'centrality', label: 'Центральность', icon: 'star', count: Object.keys(centrality.value).length },
  { id: 'communities', label: 'Сообщества', icon: 'users', count: communities.value.length },
  { id: '3d', label: '3D Визуализация', icon: 'globe' },
])

// Centrality metrics
const centralityMetrics = ['degree', 'betweenness', 'closeness', 'eigenvector']
const metricLabels = {
  degree: 'Степень',
  betweenness: 'Посредничество',
  closeness: 'Близость',
  eigenvector: 'Собственный вектор',
}

// Sorted centrality
const sortedCentrality = computed(() => {
  const result: Record<string, Array<[string, number]>> = {}
  Object.entries(centrality.value).forEach(([metric, values]) => {
    result[metric] = Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  })
  return result
})

// Community colors
const communityColors = ref<string[]>([
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#eab308', '#ec4899', '#14b8a6',
])

// Persistence colors
const persistenceColors = {
  0: '#3b82f6',
  1: '#22c55e',
  2: '#ef4444',
}

// Status class
const statusClass = computed(() => {
  switch (status.value) {
    case 'running': return 'status-running'
    case 'completed': return 'status-completed'
    case 'failed': return 'status-failed'
    default: return 'status-idle'
  }
})

// Cycle sizes
const cycleSizes = computed(() => {
  return cycles.value.map(c => c.nodes.length).slice(0, 5)
})

// Max component size
const maxComponentSize = computed(() => {
  return Math.max(...components.value.map(c => c.nodes.length), 1)
})

// Format duration
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)}с`
  if (seconds < 3600) return `${Math.round(seconds / 60)}м`
  return `${Math.round(seconds / 3600)}ч ${Math.round((seconds % 3600) / 60)}м`
}

// Actions
const loadFromGraph = () => {
  // Load graph data
}

const runTdaAnalysis = async () => {
  if (!selectedGraph.value) {
    return
  }
  
  loading.value = true
  status.value = 'running'
  startTime.value = new Date()
  progress.value = 0
  
  analysisId.value = `tda_${Date.now()}`
  duration.value = 0
  status.value = 'completed'
  loading.value = false
}

const exportResults = () => {
  // Export logic
}

const saveAnalysis = () => {
  // Save logic
}

const shareAnalysis = () => {
  // Share logic
}

const deleteAnalysis = () => {
  if (confirm('Удалить этот анализ?')) {
    analysisId.value = null
    status.value = 'idle'
  }
}

const resetCamera = () => {
  // Reset camera
}

const toggleLabels = () => {
  showLabels.value = !showLabels.value
}

const toggleEdges = () => {
  showEdges.value = !showEdges.value
}

// Watch for graph selection
watch(() => selectedGraph.value, (graph) => {
  if (graph) {
    // Auto-load graph data
  }
})

// Initialize
onMounted(() => {
  // Load saved analysis if exists
})
</script>

<style scoped>
/* ==========================================================================
   TDA TAB - PREMIUM DESIGN
   ========================================================================== */

.tda-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--space-lg);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.tda-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
}

.tda-info {
  flex: 1;
}

.tda-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.title-icon {
  font-size: var(--font-size-3xl);
}

.tda-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 600px;
}

.tda-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* ==========================================================================
   CONFIGURATION PANEL
   ========================================================================== */

.tda-config {
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.config-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-lg);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.config-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.config-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.config-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.config-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-label {
  cursor: pointer;
}

.config-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary-500);
}

.form-range {
  width: 100%;
}

.range-value {
  font-size: var(--font-size-xs);
  color: var(--color-primary-400);
  font-weight: var(--font-weight-semibold);
}

/* ==========================================================================
   RESULTS PANEL
   ========================================================================== */

.tda-results {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.results-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.status-running { background: var(--color-warning-500); }
.status-completed { background: var(--color-success-500); animation: none; }
.status-failed { background: var(--color-danger-500); animation: none; }
.status-idle { background: var(--color-text-muted); animation: none; }

.results-meta {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.meta-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

/* Progress */
.progress-container {
  height: 8px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

/* Result Tabs */
.results-tabs {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow-x: auto;
}

.result-tab {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.result-tab:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.result-tab.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.tab-count {
  font-size: var(--font-size-xs);
  padding: 0 var(--space-xs);
  background: var(--color-primary-500);
  color: white;
  border-radius: var(--radius-full);
  margin-left: auto;
}

/* Result Content */
.results-content {
  flex: 1;
  min-height: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  overflow-y: auto;
}

.result-panel {
  height: 100%;
  min-height: 0;
}

/* Overview */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.overview-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.card-header h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.card-icon {
  font-size: var(--font-size-xl);
}

.betti-numbers {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.betti-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
}

.betti-dim {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-xs);
}

.betti-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
}

.betti-info {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}

.betti-info p {
  margin-bottom: var(--space-xs);
}

.components-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.component-item {
  padding: var(--space-sm);
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
}

.component-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.component-name {
  font-weight: var(--font-weight-medium);
}

.component-nodes {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.component-visual {
  height: 8px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.component-bar {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.cycles-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.cycle-count {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.cycle-sizes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.size-badge {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.critical-points {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.point-count {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-warning-500);
}

.point-threshold {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Persistence Diagram */
.persistence-container {
  padding: var(--space-lg);
}

.persistence-svg {
  width: 100%;
  height: 400px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.persistence-legend {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  margin-top: var(--space-md);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
}

.legend-label {
  color: var(--color-text-secondary);
}

/* Barcode */
.barcode-container {
  padding: var(--space-lg);
}

.barcode-track {
  margin-bottom: var(--space-md);
}

.barcode-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.barcode-bars {
  height: 30px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}

.barcode-bar {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: var(--radius-sm);
  opacity: 0.8;
}

/* Centrality */
.centrality-container {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.centrality-tabs {
  display: flex;
  gap: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xs);
}

.centrality-tab {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.centrality-tab:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.centrality-tab.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.centrality-svg {
  width: 100%;
  height: 300px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.centrality-table {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
  border-bottom: 1px solid var(--color-border);
}

.table-body {
  max-height: 300px;
  overflow-y: auto;
}

.table-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--color-border);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--color-surface-hover);
}

.row-node {
  color: var(--color-text);
}

.row-value {
  color: var(--color-primary-400);
  font-weight: var(--font-weight-medium);
}

/* Communities */
.communities-container {
  padding: var(--space-lg);
}

.communities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.community-card {
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  color: white;
  box-shadow: var(--shadow-lg);
}

.community-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.community-id {
  font-weight: var(--font-weight-semibold);
}

.community-size {
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.community-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.node-tag {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
}

.node-more {
  font-size: var(--font-size-xs);
  opacity: 0.6;
}

.community-modularity {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

/* 3D Visualization */
.visualization-container {
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.visualization-toolbar {
  display: flex;
  gap: var(--space-xs);
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
  border-color: var(--color-border-light);
}

.visualization-canvas {
  flex: 1;
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
  min-height: 400px;
}

.visualization-legend {
  display: flex;
  justify-content: center;
  gap: var(--space-lg);
}

.legend-group {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.legend-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.legend-items {
  display: flex;
  gap: var(--space-sm);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-text {
  color: var(--color-text-secondary);
}

/* ==========================================================================
   ACTIONS PANEL
   ========================================================================== */

.tda-actions-panel {
  padding: var(--space-lg);
}

.actions-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-lg);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-md);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
  border-color: var(--color-border-light);
}

.action-btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--color-danger-500);
  color: var(--color-danger-500);
}

.action-btn svg {
  width: 20px;
  height: 20px;
}

.action-btn span {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1024px) {
  .tda-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .tda-actions {
    width: 100%;
  }
  
  .results-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .results-meta {
    width: 100%;
    justify-content: flex-start;
  }
  
  .results-tabs {
    flex-wrap: wrap;
  }
  
  .result-tab {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .tab-label {
    display: none;
  }
  
  .overview-grid {
    grid-template-columns: 1fr;
  }
  
  .communities-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .tda-title {
    font-size: var(--font-size-xl);
  }
  
  .tda-description {
    display: none;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .config-options {
    flex-direction: column;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .action-btn span {
    display: none;
  }
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ==========================================================================
   ACCESSIBILITY
   ========================================================================== */

:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* ==========================================================================
   REDUCED MOTION
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
