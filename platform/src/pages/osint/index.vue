<template>
  <div class="osint-page">
    <!-- Premium OSINT Header -->
    <div class="osint-header">
      <div class="osint-header-content">
        <div class="osint-title">
          <h1 class="osint-title-text">
            <span class="title-icon"><UiIcon name="search" :size="22" /></span>
            OSINT Командный Центр
          </h1>
          <p class="osint-title-description">
            Расследования, Анализ Данных, Визуализация
          </p>
        </div>
        <div class="osint-header-actions">
          <button class="btn btn-secondary" @click="refreshData">
            <span class="btn-icon animate-spin" v-if="loading">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </span>
            <span v-else>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Обновить
            </span>
          </button>
          <button class="btn btn-primary" @click="newInvestigation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Новое расследование
          </button>
        </div>
      </div>
      
      <!-- Quick Stats Bar -->
      <div class="osint-stats">
        <div class="stat-item">
          <div class="stat-value">{{ stats.activeInvestigations }}</div>
          <div class="stat-label">Активных расследований</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalNodes }}</div>
          <div class="stat-label">Узлов в графах</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalEdges }}</div>
          <div class="stat-label">Связей</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.pipelineTasks }}</div>
          <div class="stat-label">Задач в очереди</div>
        </div>
      </div>
    </div>

    <!-- Premium Tabs Navigation -->
    <nav class="os-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="os-tab"
        role="tab"
        :class="{ active: activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon"><UiIcon :name="tab.icon" :size="15" /></span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge" class="tab-badge badge badge-primary">{{ tab.badge }}</span>
      </button>
    </nav>

    <!-- Tab Content with Transitions -->
    <div class="os-tab-body">
      <transition name="fade" mode="out-in">
        <UiFlowsintTab v-if="activeTab === 'ui'" key="ui" />
        <PipelineTab v-else-if="activeTab === 'pipeline'" key="pipeline" />
        <TdaTab v-else-if="activeTab === 'tda'" key="tda" />
        <AnalyticsTab v-else-if="activeTab === 'analytics'" key="analytics" />
        <SettingsTab v-else-if="activeTab === 'settings'" key="settings" />
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import UiFlowsintTab from './tabs/flowsint/index.vue'
import PipelineTab from './tabs/pipeline/index.vue'

// Define tabs
const tabs = [
  { 
    id: 'ui', 
    label: 'Graph Investigation', 
    icon: 'search'
  },
  { 
    id: 'pipeline', 
    label: 'Pipeline', 
    icon: 'bolt'
  },
  { 
    id: 'tda', 
    label: 'TDA Analysis', 
    icon: 'calculator'
  },
  { 
    id: 'analytics', 
    label: 'Analytics', 
    icon: 'chartBar'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: 'settings'
  },
]

const activeTab = ref<string>('ui')
const loading = ref(false)
const router = useRouter()

// Stats
const stats = ref({
  activeInvestigations: 0,
  totalNodes: 0,
  totalEdges: 0,
  pipelineTasks: 0,
})

// Actions
const refreshData = async () => {
  loading.value = true
  loading.value = false
}

const newInvestigation = () => {
  router.push('/osint/new')
}

// Load initial data
onMounted(() => {
  // Load stats from API or local storage
  const savedStats = localStorage.getItem('osint-stats')
  if (savedStats) {
    stats.value = JSON.parse(savedStats)
  }
})
</script>

<style scoped>
/* ==========================================================================
   OSINT PAGE - PREMIUM DESIGN
   ========================================================================== */

.osint-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.osint-header {
  margin-bottom: var(--space-xl);
}

.osint-header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
  margin-bottom: var(--space-lg);
}

.osint-title {
  flex: 1;
}

.osint-title-text {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.title-icon {
  font-size: var(--font-size-4xl);
}

.osint-title-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.osint-header-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* ==========================================================================
   STATS BAR
   ========================================================================== */

.osint-stats {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
  line-height: 1;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: var(--space-xs);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
}

/* ==========================================================================
   TABS
   ========================================================================== */

.os-tabs {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-lg);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.os-tabs::-webkit-scrollbar {
  height: 4px;
}

.os-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.os-tabs::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

.os-tab {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.os-tab::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--gradient-primary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.os-tab:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.os-tab:hover::before {
  opacity: 0.1;
}

.os-tab.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.os-tab.active::before {
  opacity: 0.2;
}

.tab-icon {
  font-size: var(--font-size-base);
}

.tab-label {
  font-size: var(--font-size-sm);
}

.tab-badge {
  margin-left: auto;
}

/* ==========================================================================
   TAB BODY
   ========================================================================== */

.os-tab-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.os-tab-body > * {
  flex: 1;
  min-width: 0;
}

/* ==========================================================================
   TRANSITIONS
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
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1024px) {
  .osint-header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .osint-header-actions {
    width: 100%;
    justify-content: flex-start;
  }
  
  .osint-stats {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  
  .stat-item {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }
  
  .stat-divider {
    display: none;
  }
  
  .os-tabs {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .osint-title-text {
    font-size: var(--font-size-2xl);
  }
  
  .osint-stats {
    display: none;
  }
  
  .os-tab {
    padding: var(--space-sm) var(--space-md);
  }
  
  .tab-label {
    display: none;
  }
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
