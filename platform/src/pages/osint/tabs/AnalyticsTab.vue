<template>
  <div class="analytics-tab">
    <!-- [38;5;240mAnalytics Header[0m -->
    <div class="analytics-header">
      <div class="analytics-info">
        <h2 class="analytics-title">
          <span class="title-icon">📊</span>
          OSINT Аналитика
        </h2>
        <p class="analytics-description">
          Комплексный анализ данных, статистика графов и временные паттерны
        </p>
      </div>
      <div class="analytics-actions">
        <div class="filter-selector">
          <select v-model="selectedGraph" class="form-select" @change="loadGraphStats">
            <option value="">Выберите граф</option>
            <option v-for="graph in availableGraphs" :key="graph.id" :value="graph.id">
              {{ graph.name }}
            </option>
          </select>
        </div>
        <button class="btn btn-secondary" @click="refreshStats" :disabled="loading">
          <span class="btn-icon animate-spin" v-if="loading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
            </svg>
          </span>
          <span v-else>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Обновить
          </span>
        </button>
        <button class="btn btn-primary" @click="exportAnalytics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Экспорт
        </button>
      </div>
    </div>

    <!-- [38;5;240mKey Metrics Bar[0m -->
    <div class="metrics-bar glass-card">
      <div class="metric" v-for="metric in keyMetrics" :key="metric.id">
        <div class="metric-icon" :class="`metric-icon-${metric.id}`">
          <component :is="metric.icon" v-if="typeof metric.icon === 'object'" />
          <span v-else>{{ metric.icon }}</span>
        </div>
        <div class="metric-value">{{ formatNumber(metric.value) }}</div>
        <div class="metric-label">{{ metric.label }}</div>
        <div class="metric-change" :class="metric.change >= 0 ? 'positive' : 'negative'" v-if="metric.change">
          {{ metric.change > 0 ? '+' : '' }}{{ metric.change }}%
        </div>
      </div>
    </div>

    <!-- [38;5;240mMain Dashboard Grid[0m -->
    <div class="dashboard-grid">
      <!-- [38;5;240mGraph Statistics Card[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">📈</span>
            Статистика Графа
          </h3>
          <div class="card-actions">
            <button class="card-action-btn" @click="toggleGraphStats" title="Свернуть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-content">
          <div class="stats-grid">
            <div class="stat-item" v-for="stat in graphStats" :key="stat.id">
              <div class="stat-value">{{ formatNumber(stat.value) }}</div>
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-progress" v-if="stat.max">
                <div class="progress-bar" :style="{ width: `${(stat.value / stat.max) * 100}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mEntity Distribution Chart[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">🏷️</span>
            Распределение Сущностей
          </h3>
        </div>
        <div class="card-content">
          <div class="chart-container">
            <svg class="donut-chart" ref="entityChart"></svg>
            <div class="chart-legend">
              <div class="legend-item" v-for="(item, index) in entityDistribution" :key="index">
                <span class="legend-color" :style="{ background: chartColors[index] }"></span>
                <span class="legend-label">{{ item.type }}</span>
                <span class="legend-value">{{ item.count }} ({{ Math.round((item.count / totalEntities) * 100) }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mRelationship Types Chart[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">🔗</span>
            Типы Связей
          </h3>
        </div>
        <div class="card-content">
          <div class="chart-container">
            <svg class="bar-chart" ref="relationshipChart"></svg>
            <div class="chart-legend">
              <div class="legend-item" v-for="(item, index) in relationshipTypes" :key="index">
                <span class="legend-color" :style="{ background: chartColors[index] }"></span>
                <span class="legend-label">{{ item.type }}</span>
                <span class="legend-value">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mTemporal Analysis[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">⏰</span>
            Временной Анализ
          </h3>
        </div>
        <div class="card-content">
          <div class="temporal-container">
            <div class="time-range-selector">
              <button 
                class="time-btn" 
                v-for="range in timeRanges" 
                :key="range" 
                :class="{ active: selectedRange === range }"
                @click="selectedRange = range"
              >
                {{ rangeLabels[range] }}
              </button>
            </div>
            <div class="activity-chart">
              <svg class="line-chart" ref="activityChart"></svg>
            </div>
            <div class="activity-stats">
              <div class="activity-stat">
                <span class="stat-value">{{ totalEvents }}</span>
                <span class="stat-label">Событий</span>
              </div>
              <div class="activity-stat">
                <span class="stat-value">{{ peakActivity }}</span>
                <span class="stat-label">Пик/день</span>
              </div>
              <div class="activity-stat">
                <span class="stat-value">{{ avgActivity }}</span>
                <span class="stat-label">Среднее/день</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mCentrality Analysis[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">⭐</span>
            Центральность
          </h3>
        </div>
        <div class="card-content">
          <div class="centrality-container">
            <div class="centrality-tabs">
              <button 
                class="centrality-tab" 
                v-for="metric in centralityMetrics" 
                :key="metric" 
                :class="{ active: activeCentrality === metric }"
                @click="activeCentrality = metric"
              >
                {{ metricLabels[metric] }}
              </button>
            </div>
            <div class="centrality-list">
              <div 
                class="centrality-item" 
                v-for="(item, index) in centralityData[activeCentrality]" 
                :key="item.node"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="node-name">{{ item.node }}</span>
                <span class="node-value">{{ item.value.toFixed(4) }}</span>
                <div class="node-bar">
                  <div class="bar-fill" :style="{ width: `${(item.value / maxCentrality) * 100}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mCommunity Detection[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">👥</span>
            Обнаружение Сообществ
          </h3>
        </div>
        <div class="card-content">
          <div class="communities-container">
            <div class="communities-grid">
              <div 
                class="community-card" 
                v-for="(community, index) in communities" 
                :key="community.id"
                :style="{ background: communityColors[index] }"
              >
                <div class="community-info">
                  <span class="community-id">Сообщество {{ index + 1 }}</span>
                  <span class="community-size">{{ community.size }} узлов</span>
                </div>
                <div class="community-modularity">
                  Модульность: {{ community.modularity.toFixed(4) }}
                </div>
              </div>
            </div>
            <div class="community-stats">
              <div class="community-stat">
                <span class="stat-value">{{ communities.length }}</span>
                <span class="stat-label">Сообществ</span>
              </div>
              <div class="community-stat">
                <span class="stat-value">{{ avgCommunitySize }}</span>
                <span class="stat-label">Средний размер</span>
              </div>
              <div class="community-stat">
                <span class="stat-value">{{ maxModularity.toFixed(4) }}</span>
                <span class="stat-label">Макс. модульность</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mTop Entities by Type[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">🔝</span>
            Топ Сущности
          </h3>
          <div class="card-actions">
            <select v-model="selectedEntityType" class="form-select form-select-sm" @change="filterTopEntities">
              <option value="all">Все типы</option>
              <option v-for="type in entityTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
        </div>
        <div class="card-content">
          <div class="top-entities-list">
            <div 
              class="entity-item" 
              v-for="(entity, index) in topEntities" 
              :key="entity.id"
            >
              <span class="rank">{{ index + 1 }}</span>
              <div class="entity-info">
                <span class="entity-name">{{ entity.name || entity.id }}</span>
                <span class="entity-type badge badge-primary">{{ entity.type }}</span>
              </div>
              <span class="entity-score">{{ entity.score.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- [38;5;240mCustom Queries[0m -->
      <div class="dashboard-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">🔍</span>
            Пользовательские Запросы
          </h3>
        </div>
        <div class="card-content">
          <div class="query-container">
            <div class="query-input">
              <select v-model="queryType" class="form-select">
                <option value="cypher">Cypher</option>
                <option value="gremlin">Gremlin</option>
                <option value="custom">Пользовательский</option>
              </select>
              <textarea 
                v-model="customQuery" 
                class="form-textarea" 
                placeholder="Введите запрос..."
                :rows="3"
              ></textarea>
            </div>
            <div class="query-actions">
              <button class="btn btn-primary btn-sm" @click="executeQuery" :disabled="loadingQuery">
                <span class="btn-icon animate-spin" v-if="loadingQuery">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
                  </svg>
                </span>
                <span v-else>Выполнить</span>
              </button>
              <button class="btn btn-secondary btn-sm" @click="saveQuery">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                </svg>
                Сохранить
              </button>
            </div>
            <div class="query-results" v-if="queryResults.length > 0">
              <div class="result-header">
                <span class="result-count">{{ queryResults.length }} результатов</span>
                <span class="result-time">{{ queryTime }} мс</span>
              </div>
              <div class="result-table">
                <div class="result-row" v-for="(result, index) in queryResults" :key="index">
                  <pre class="result-content">{{ formatResult(result) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGraphStore } from '@/stores/graphStore'

// Stores
const graphStore = useGraphStore()

// State
const loading = ref(false)
const loadingQuery = ref(false)
const selectedGraph = ref('')
const selectedRange = ref('week')
const activeCentrality = ref('degree')
const selectedEntityType = ref('all')
const queryType = ref('cypher')
const customQuery = ref('')
const queryTime = ref(0)

// Data
const availableGraphs = computed(() => graphStore.graphs)

// Key Metrics
const keyMetrics = ref([
  { id: 'totalNodes', label: 'Всего узлов', value: 15420, change: 12.5, icon: '🔵' },
  { id: 'totalEdges', label: 'Всего связей', value: 87345, change: 8.3, icon: '🔴' },
  { id: 'activeInvestigations', label: 'Активных расследований', value: 12, change: -2.1, icon: '🟢' },
  { id: 'newEntities', label: 'Новых сущностей', value: 428, change: 25.7, icon: '🟡' },
  { id: 'dataVolume', label: 'Объем данных', value: 2.4, change: 15.2, icon: '💾' },
])

// Graph Stats
const graphStats = ref([
  { id: 'nodes', label: 'Узлы', value: 15420, max: 20000 },
  { id: 'edges', label: 'Связи', value: 87345, max: 100000 },
  { id: 'density', label: 'Плотность', value: 0.37, max: 1 },
  { id: 'diameter', label: 'Диаметр', value: 8, max: 20 },
  { id: 'components', label: 'Компоненты', value: 3, max: 10 },
  { id: 'clusters', label: 'Кластеры', value: 15, max: 50 },
])

// Entity Distribution
const entityDistribution = ref([
  { type: 'Person', count: 4520 },
  { type: 'Organization', count: 2830 },
  { type: 'Location', count: 1890 },
  { type: 'IP Address', count: 1245 },
  { type: 'Domain', count: 985 },
  { type: 'Email', count: 2340 },
  { type: 'Phone', count: 1560 },
])

const totalEntities = computed(() => {
  return entityDistribution.value.reduce((sum, item) => sum + item.count, 0)
})

// Relationship Types
const relationshipTypes = ref([
  { type: 'CONNECTED_TO', count: 25400 },
  { type: 'WORKS_AT', count: 18200 },
  { type: 'LOCATED_AT', count: 12340 },
  { type: 'COMMUNICATED_WITH', count: 8760 },
  { type: 'OWNED_BY', count: 5420 },
  { type: 'RESOLVED_TO', count: 3200 },
])

// Time Ranges
const timeRanges = ['day', 'week', 'month', 'quarter', 'year']
const rangeLabels = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
}

// Activity Stats
const totalEvents = ref(12450)
const peakActivity = ref(890)
const avgActivity = ref(415)

// Centrality
const centralityMetrics = ['degree', 'betweenness', 'closeness', 'eigenvector']
const metricLabels = {
  degree: 'Степень',
  betweenness: 'Посредничество',
  closeness: 'Близость',
  eigenvector: 'Собственный вектор',
}

const centralityData = ref({
  degree: [
    { node: 'Node_A', value: 0.8523 },
    { node: 'Node_B', value: 0.7215 },
    { node: 'Node_C', value: 0.6542 },
    { node: 'Node_D', value: 0.5879 },
    { node: 'Node_E', value: 0.5126 },
  ],
  betweenness: [
    { node: 'Node_A', value: 0.4523 },
    { node: 'Node_B', value: 0.3876 },
    { node: 'Node_C', value: 0.3124 },
    { node: 'Node_D', value: 0.2845 },
    { node: 'Node_E', value: 0.2456 },
  ],
  closeness: [
    { node: 'Node_A', value: 0.7215 },
    { node: 'Node_B', value: 0.6542 },
    { node: 'Node_C', value: 0.5879 },
    { node: 'Node_D', value: 0.5126 },
    { node: 'Node_E', value: 0.4523 },
  ],
  eigenvector: [
    { node: 'Node_A', value: 0.5879 },
    { node: 'Node_B', value: 0.5126 },
    { node: 'Node_C', value: 0.4523 },
    { node: 'Node_D', value: 0.3876 },
    { node: 'Node_E', value: 0.3124 },
  ],
})

const maxCentrality = computed(() => {
  return Math.max(...centralityData.value[activeCentrality.value].map(item => item.value))
})

// Communities
const communities = ref([
  { id: 'comm_1', size: 45, modularity: 0.8234 },
  { id: 'comm_2', size: 32, modularity: 0.7891 },
  { id: 'comm_3', size: 28, modularity: 0.7456 },
  { id: 'comm_4', size: 22, modularity: 0.7123 },
  { id: 'comm_5', size: 18, modularity: 0.6890 },
  { id: 'comm_6', size: 15, modularity: 0.6543 },
])

const avgCommunitySize = computed(() => {
  return Math.round(communities.value.reduce((sum, c) => sum + c.size, 0) / communities.value.length)
})

const maxModularity = computed(() => {
  return Math.max(...communities.value.map(c => c.modularity))
})

// Top Entities
const entityTypes = ref(['Person', 'Organization', 'Location', 'IP Address', 'Domain'])
const topEntities = ref([
  { id: 'entity_1', name: 'Иван Иванов', type: 'Person', score: 98.5 },
  { id: 'entity_2', name: 'OOO Рога и Копыта', type: 'Organization', score: 92.3 },
  { id: 'entity_3', name: 'Moscow, RU', type: 'Location', score: 88.7 },
  { id: 'entity_4', name: '192.168.1.1', type: 'IP Address', score: 85.2 },
  { id: 'entity_5', name: 'example.com', type: 'Domain', score: 82.4 },
  { id: 'entity_6', name: 'Петр Петров', type: 'Person', score: 78.9 },
  { id: 'entity_7', name: 'Google LLC', type: 'Organization', score: 76.5 },
  { id: 'entity_8', name: 'Saint Petersburg, RU', type: 'Location', score: 74.2 },
])

// Query Results
const queryResults = ref<string[]>([])

// Colors
const chartColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#eab308', '#ec4899', '#14b8a6',
]

const communityColors = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
]

// Actions
const loadGraphStats = () => {
  loading.value = true
  // Simulate loading
  setTimeout(() => {
    loading.value = false
  }, 500)
}

const refreshStats = () => {
  loading.value = true
  // Update metrics with random changes
  keyMetrics.value = keyMetrics.value.map(m => ({
    ...m,
    value: Math.floor(m.value * (0.95 + Math.random() * 0.1)),
    change: (Math.random() * 20 - 10).toFixed(1),
  }))
  
  setTimeout(() => {
    loading.value = false
  }, 1000)
}

const exportAnalytics = () => {
  // Export logic
  alert('Экспорт аналитики выполнен')
}

const toggleGraphStats = () => {
  // Toggle expanded/collapsed state
}

const filterTopEntities = () => {
  // Filter entities by type
}

const executeQuery = async () => {
  if (!customQuery.value.trim()) {
    alert('Введите запрос')
    return
  }
  
  loadingQuery.value = true
  const startTime = Date.now()
  
  // Simulate query execution
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  queryTime.value = Date.now() - startTime
  queryResults.value = [
    '{ "id": 1, "name": "Иван Иванов", "type": "Person" }',
    '{ "id": 2, "name": "OOO Рога и Копыта", "type": "Organization" }',
    '{ "id": 3, "name": "Moscow, RU", "type": "Location" }',
  ]
  
  loadingQuery.value = false
}

const saveQuery = () => {
  if (!customQuery.value.trim()) {
    alert('Введите запрос для сохранения')
    return
  }
  alert('Запрос сохранен')
}

// Formatters
const formatNumber = (value: number) => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toString()
}

const formatResult = (result: string) => {
  try {
    const parsed = JSON.parse(result)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return result
  }
}

// Initialize
onMounted(() => {
  // Load initial data
  if (availableGraphs.value.length > 0) {
    selectedGraph.value = availableGraphs.value[0].id
  }
})

// Watch for graph selection
watch(() => selectedGraph.value, (graphId) => {
  if (graphId) {
    loadGraphStats()
  }
})
</script>

<style scoped>
/* ==========================================================================
   ANALYTICS TAB - PREMIUM DESIGN
   ========================================================================== */

.analytics-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--space-lg);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.analytics-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
}

.analytics-info {
  flex: 1;
}

.analytics-title {
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

.analytics-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 600px;
}

.analytics-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.filter-selector {
  min-width: 180px;
}

/* ==========================================================================
   METRICS BAR
   ========================================================================== */

.metrics-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
  padding: var(--space-lg);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  text-align: center;
  transition: all var(--transition-fast);
}

.metric:hover {
  transform: translateY(-5px);
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-lg);
}

.metric-icon {
  font-size: var(--font-size-xl);
}

.metric-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
}

.metric-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-change {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.metric-change.positive {
  color: var(--color-success-500);
}

.metric-change.negative {
  color: var(--color-danger-500);
}

/* ==========================================================================
   DASHBOARD GRID
   ========================================================================== */

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--space-lg);
  flex: 1;
  min-height: 0;
}

/* ==========================================================================
   DASHBOARD CARDS
   ========================================================================== */

.dashboard-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.card-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.card-icon {
  font-size: var(--font-size-lg);
}

.card-actions {
  display: flex;
  gap: var(--space-xs);
}

.card-action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.card-action-btn:hover {
  background: var(--color-surface-active);
  color: var(--color-text);
  border-color: var(--color-border-light);
}

.card-content {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
  min-height: 0;
}

/* ==========================================================================
   STATS GRID
   ========================================================================== */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
  text-align: center;
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.stat-progress {
  width: 100%;
  height: 4px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--space-xs);
}

.progress-bar {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}

/* ==========================================================================
   CHARTS
   ========================================================================== */

.chart-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.donut-chart,
.bar-chart,
.line-chart {
  width: 100%;
  height: 200px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-sm);
}

.legend-label {
  flex: 1;
  color: var(--color-text);
}

.legend-value {
  color: var(--color-text-muted);
}

/* ==========================================================================
   TEMPORAL ANALYSIS
   ========================================================================== */

.temporal-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.time-range-selector {
  display: flex;
  gap: var(--space-xs);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
  padding: var(--space-xs);
}

.time-btn {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.time-btn:hover {
  color: var(--color-text);
  background: var(--color-surface);
}

.time-btn.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.activity-chart {
  flex: 1;
  min-height: 200px;
}

.activity-stats {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.activity-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.activity-stat .stat-value {
  font-size: var(--font-size-lg);
}

.activity-stat .stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ==========================================================================
   CENTRALITY
   ========================================================================== */

.centrality-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.centrality-tabs {
  display: flex;
  gap: var(--space-xs);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
  padding: var(--space-xs);
}

.centrality-tab {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.centrality-tab:hover {
  color: var(--color-text);
  background: var(--color-surface);
}

.centrality-tab.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.centrality-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.centrality-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-500);
  color: white;
  border-radius: 50%;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.node-name {
  flex: 1;
  font-weight: var(--font-weight-medium);
}

.node-value {
  color: var(--color-primary-400);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.node-bar {
  width: 100px;
  height: 8px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

/* ==========================================================================
   COMMUNITIES
   ========================================================================== */

.communities-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.communities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
}

.community-card {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  color: white;
  box-shadow: var(--shadow-md);
}

.community-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.community-id {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.community-size {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.community-modularity {
  font-size: var(--font-size-xs);
  opacity: 0.6;
}

.community-stats {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.community-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.community-stat .stat-value {
  font-size: var(--font-size-lg);
  color: var(--color-text);
}

.community-stat .stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ==========================================================================
   TOP ENTITIES
   ========================================================================== */

.top-entities-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.entity-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.entity-item .rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.entity-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
}

.entity-name {
  font-weight: var(--font-weight-medium);
}

.entity-type {
  align-self: flex-start;
}

.entity-score {
  color: var(--color-warning-500);
  font-weight: var(--font-weight-semibold);
}

/* ==========================================================================
   CUSTOM QUERIES
   ========================================================================== */

.query-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.query-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.query-input .form-select {
  min-width: 150px;
}

.query-actions {
  display: flex;
  gap: var(--space-sm);
}

.query-results {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.result-count {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.result-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.result-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 200px;
  overflow-y: auto;
}

.result-row {
  padding: var(--space-sm);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.result-content {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

@media (max-width: 1024px) {
  .analytics-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .analytics-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .filter-selector {
    flex: 1;
    min-width: 150px;
  }
  
  .metrics-bar {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .analytics-title {
    font-size: var(--font-size-xl);
  }
  
  .analytics-description {
    display: none;
  }
  
  .metrics-bar {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .metric {
    padding: var(--space-sm);
  }
  
  .metric-value {
    font-size: var(--font-size-lg);
  }
  
  .time-range-selector {
    flex-wrap: wrap;
  }
  
  .time-btn {
    flex: 0 0 30%;
  }
  
  .activity-stats {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .centrality-item {
    flex-wrap: wrap;
  }
  
  .node-bar {
    width: 100%;
    order: 5;
  }
  
  .communities-grid {
    grid-template-columns: 1fr;
  }
  
  .query-actions {
    flex-direction: column;
  }
  
  .query-actions .btn {
    width: 100%;
  }
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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
