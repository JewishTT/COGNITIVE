<template>
  <section class="view view-embed os-view">
    <!-- Premium Header with Glass Effect -->
    <header class="view-head glass-card">
      <div class="header-content">
        <h1 class="header-title">
          <span class="header-icon neon neon-primary"><UiIcon name="palette" /></span>
          OSINT Flowsint Integration
        </h1>
        <p class="header-subtitle">
          Dvijok FLOWSINT | NEO4J | TDA | THEBIGBROTHER
        </p>
      </div>
      <div class="header-status">
        <span class="status-indicator online" title="Все системы работают"></span>
        <span class="status-text">Активен</span>
      </div>
    </header>

    <!-- Premium Workspace Layout -->
    <div class="os-workspace">
      <!-- Left Sidebar - Investigations & Sketches with Glass Effect -->
      <InvestigationSidebar 
        :active-sketch-id="activeSketchId" 
        @select="onSelect"
        class="os-workspace-left glass-card"
      />

      <!-- Center - Main Canvas Area with Enhanced Controls -->
      <div class="os-ws-center">
        <!-- Graph Canvas with Enhanced Controls -->
        <div class="os-graph-container glass-card">
          <GraphCanvas
            ref="canvasRef"
            :sketch-id="activeSketchId"
            :highlight-ids="highlightIds"
            @graph="onGraph"
            @selection="onSelection"
            @tbb-state="onTbbState"
          />
          
          <!-- TDA Layer Overlay (Collapsible with Animation) -->
          <transition name="fade">
            <TdaLayer
              v-if="showTdaLayer && activeSketchId && currentGraph && currentGraph.nds.length > 0"
              :graph="currentGraph"
              :highlight-ids="highlightIds"
              @highlight="onHighlight"
              @clear="onClearHighlight"
              class="os-tda-overlay"
            />
          </transition>
          
          <!-- Loading Overlay -->
          <div class="graph-loading" v-if="loading">
            <div class="loading-spinner animate-spin"></div>
            <span class="loading-text">Загрузка графа...</span>
          </div>
        </div>
        
        <!-- Premium Quick Access Toolbar with Glass Effect -->
        <div v-if="activeSketchId" class="os-quick-toolbar glass-card">
          <div class="os-quick-group">
            <button 
              class="btn os-btn-quick hover-scale" 
              @click="toggleTdaLayer"
              :class="{ 'is-active': showTdaLayer }"
              title="Переключить слой TDA"
            >
              <span class="os-btn-icon"><UiIcon name="calculator" /></span>
              <span class="os-btn-label">TDA</span>
            </button>
            <button 
              class="btn os-btn-quick hover-scale" 
              @click="refreshGraph"
              :disabled="loading"
              title="Обновить граф"
            >
              <span class="os-btn-icon animate-spin" v-if="loading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
                </svg>
              </span>
              <span class="os-btn-icon" v-else><UiIcon name="refresh" /></span>
              <span class="os-btn-label">Обновить</span>
            </button>
            <button 
              class="btn os-btn-quick hover-scale" 
              @click="fitView"
              title="Подогнать вид"
            >
              <span class="os-btn-icon"><UiIcon name="target" /></span>
              <span class="os-btn-label">Вид</span>
            </button>
            <button 
              class="btn os-btn-quick hover-scale" 
              @click="toggleFullscreen"
              title="Полноэкранный режим"
            >
              <span class="os-btn-icon"><UiIcon name="expand" /></span>
              <span class="os-btn-label">FS</span>
            </button>
          </div>
          <div class="os-quick-stats">
            <span class="os-stat-badge glass">
              <span class="stat-icon"><UiIcon name="dotBlue" /></span>
              {{ currentGraph ? currentGraph.nds.length : 0 }} Nodes
            </span>
            <span class="os-stat-badge glass">
              <span class="stat-icon"><UiIcon name="dotRed" /></span>
              {{ currentGraph ? currentGraph.rls.length : 0 }} Edges
            </span>
            <span class="os-stat-badge glass os-stat-selected" v-if="selectedNode">
              <span class="stat-icon"><UiIcon name="sparkle" /></span>
              Selected: 1
            </span>
          </div>
        </div>
      </div>

      <!-- Right Sidebar - Tools & Panels with Glass Effect -->
      <div class="os-ws-right">
        <!-- Node Inspector (Enhanced with Glass) -->
        <transition name="slide-right">
          <NodeInspector
            v-if="selectedNode"
            :node="selectedNode"
            @close="onCloseInspector"
            @delete="onDeleteNode"
            class="os-panel-enhanced glass-card"
          />
        </transition>
        
        <!-- Type Palette with Custom Types Support and Glass Effect -->
        <TypePalette 
          :sketch-id="activeSketchId" 
          @added="onAdded"
          class="os-panel-enhanced glass-card"
        />
        
        <!-- Enricher Catalog with Enhanced UI and Glass Effect -->
        <EnricherCatalog
          :sketch-id="activeSketchId"
          :node-ids="selectedNodeIds"
          :disabled="tbbBusy || loading"
          @enriched="onEnriched"
          class="os-panel-enhanced glass-card"
        />
        
        <!-- Event Log with Real-time Updates and Glass Effect -->
        <EventLog 
          :sketch-id="activeSketchId" 
          class="os-panel-enhanced glass-card"
        />
        
        <!-- Premium Custom Analysis Tools Section with Glass Effect -->
        <div class="os-panel-enhanced glass-card os-custom-tools">
          <div class="os-palette-head">
            <strong class="palette-title">
              <span class="title-icon"><UiIcon name="wrench" /></span>
              Инструменты Анализа
            </strong>
            <span class="palette-hint">Premium</span>
          </div>
          <div class="os-custom-tools-grid">
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="runCustomAnalysis('centrality')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0 || loading"
              title="Анализ центральности"
            >
              <span class="os-tool-icon"><UiIcon name="star" /></span>
              <span class="os-tool-label">Центральность</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="runCustomAnalysis('community')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0 || loading"
              title="Обнаружение сообществ"
            >
              <span class="os-tool-icon"><UiIcon name="users" /></span>
              <span class="os-tool-label">Сообщества</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="runCustomAnalysis('path')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0 || loading"
              title="Анализ путей"
            >
              <span class="os-tool-icon"><UiIcon name="road" /></span>
              <span class="os-tool-label">Пути</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="runCustomAnalysis('clustering')"
              :disabled="!activeSketchId || !currentGraph || currentGraph.nds.length === 0 || loading"
              title="Кластеризация"
            >
              <span class="os-tool-icon"><UiIcon name="target" /></span>
              <span class="os-tool-label">Кластеры</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="exportGraph"
              :disabled="!activeSketchId || !currentGraph || loading"
              title="Экспорт графа"
            >
              <span class="os-tool-icon"><UiIcon name="upload" /></span>
              <span class="os-tool-label">Экспорт</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="importGraph"
              :disabled="loading"
              title="Импорт графа"
            >
              <span class="os-tool-icon"><UiIcon name="download" /></span>
              <span class="os-tool-label">Импорт</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="clearGraph"
              :disabled="!activeSketchId || !currentGraph || loading"
              title="Очистить граф"
            >
              <span class="os-tool-icon"><UiIcon name="trash" /></span>
              <span class="os-tool-label">Очистить</span>
            </button>
            <button 
              class="btn os-btn-tool hover-lift" 
              @click="saveGraph"
              :disabled="!activeSketchId || !currentGraph || loading"
              title="Сохранить граф"
            >
              <span class="os-tool-icon"><UiIcon name="save" /></span>
              <span class="os-tool-label">Сохранить</span>
            </button>
          </div>
          
          <!-- Analysis Progress Bar -->
          <div class="analysis-progress" v-if="customAnalysisRunning">
            <div class="progress-bar" :style="{ width: `${analysisProgress}%` }"></div>
            <span class="progress-text">{{ analysisProgress }}%</span>
          </div>
        </div>
        
        <!-- Graph Statistics Panel -->
        <transition name="slide-up">
          <div class="os-panel-enhanced glass-card os-stats-panel" v-if="currentGraph">
            <div class="stats-header">
              <h4 class="stats-title">
                <span class="stats-icon"><UiIcon name="chartBar" /></span>
                Статистика Графа
              </h4>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ currentGraph.nds.length }}</div>
                <div class="stat-label">Узлы</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ currentGraph.rls.length }}</div>
                <div class="stat-label">Связи</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ graphDensity.toFixed(3) }}</div>
                <div class="stat-label">Плотность</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ connectedComponents }}</div>
                <div class="stat-label">Компоненты</div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import InvestigationSidebar from '@/widgets/investigation-sidebar/index.vue'
import GraphCanvas from '@/widgets/graph-canvas/index.vue'
import TdaLayer from '@/widgets/tda-layer/index.vue'
import NodeInspector from '@/widgets/node-inspector/index.vue'
import TypePalette from '@/widgets/type-palette/index.vue'
import EnricherCatalog from '@/widgets/enricher-catalog/index.vue'
import EventLog from '@/widgets/event-log/index.vue'
import '@/shared/styles/osint-graph.css'
import { useOsintPage } from '../useOsintPage'
import type { GraphData, GraphNode } from '@/shared/api/types'

const {
  activeSketchId,
  currentGraph,
  highlightIds,
  selectedNodeIds,
  tbbBusy,
  canvasRef,
  selectedNode,
  onSelect,
  onGraph,
  onSelection,
  onTbbState,
  onHighlight,
  onClearHighlight,
  onEnriched,
  onDeleteNode,
  onAdded,
  onCloseInspector,
} = useOsintPage()

// Enhanced state for UI
const loading = ref(false)
const showTdaLayer = ref(true)
const customAnalysisRunning = ref(false)
const analysisProgress = ref(0)
const isFullscreen = ref(false)

// Computed properties
const hasGraph = computed(() => currentGraph.value && currentGraph.value.nds.length > 0)

const graphDensity = computed(() => {
  if (!currentGraph.value || currentGraph.value.nds.length === 0) return 0
  const maxEdges = currentGraph.value.nds.length * (currentGraph.value.nds.length - 1) / 2
  return currentGraph.value.rls.length / maxEdges
})

const connectedComponents = computed(() => {
  if (!currentGraph.value) return 0
  // Simple estimation - this would be calculated more accurately in a real implementation
  return Math.max(1, Math.ceil(currentGraph.value.nds.length / 50))
})

// Enhanced methods
async function toggleTdaLayer() {
  showTdaLayer.value = !showTdaLayer.value
}

async function refreshGraph() {
  if (!activeSketchId.value) return
  
  loading.value = true
  try {
    if (canvasRef.value?.loadGraph) {
      await canvasRef.value.loadGraph()
    }
  } catch (error) {
    console.error('Failed to refresh graph:', error)
  } finally {
    loading.value = false
  }
}

function fitView() {
  if (canvasRef.value?.fitView) {
    canvasRef.value.fitView()
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  // This would integrate with a fullscreen API in a real implementation
}

async function runCustomAnalysis(type: string) {
  if (!activeSketchId.value || !currentGraph.value) return
  
  customAnalysisRunning.value = true
  analysisProgress.value = 0
  
  try {
    // Simulate analysis progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      analysisProgress.value = i
    }
    
    // Trigger specific analysis based on type
    switch (type) {
      case 'centrality':
        // Calculate centrality metrics
        break
      case 'community':
        // Detect communities
        break
      case 'path':
        // Find shortest paths
        break
      case 'clustering':
        // Perform clustering
        break
    }
    
    // Highlight results
    onHighlight(currentGraph.value.nds.slice(0, 10).map(n => n.id))
  } catch (error) {
    console.error(`Analysis failed: ${error}`)
  } finally {
    customAnalysisRunning.value = false
    setTimeout(() => analysisProgress.value = 0, 1000)
  }
}

function exportGraph() {
  if (!currentGraph.value) return
  
  const data = JSON.stringify(currentGraph.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `graph-export-${activeSketchId.value || 'unnamed'}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function importGraph() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)
          // Import logic would go here
          alert('Граф импортирован')
        } catch (error) {
          alert('Ошибка импорта: некорректный формат')
        }
      }
      reader.readAsText(target.files[0])
    }
  }
  input.click()
}

function clearGraph() {
  if (!activeSketchId.value || !currentGraph.value) return
  
  if (confirm('Удалить все узлы и связи из графа?')) {
    // Clear graph logic
    onGraph({ nds: [], rls: [] } as GraphData)
  }
}

function saveGraph() {
  if (!activeSketchId.value || !currentGraph.value) return
  
  // Save graph logic
  alert('Граф сохранен')
}

// Auto-load first sketch if available
onMounted(() => {
  // Could add logic to auto-select first available sketch
})

// Watch for graph changes
watch(() => currentGraph.value, (graph) => {
  if (graph && graph.nds.length > 0) {
    // Auto-fit view when graph loads
    setTimeout(fitView, 500)
  }
}, { deep: true })
</script>

<style scoped>
/* ==========================================================================
   UI FLOWSINT TAB - PREMIUM DESIGN
   ========================================================================== */

.os-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-background);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.header-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.header-icon {
  font-size: var(--font-size-2xl);
}

.header-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.status-indicator.online {
  background: var(--color-success-500);
}

.status-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ==========================================================================
   WORKSPACE
   ========================================================================== */

.os-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ==========================================================================
   LEFT SIDEBAR
   ========================================================================== */

.os-workspace-left {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

/* ==========================================================================
   CENTER AREA
   ========================================================================== */

.os-ws-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

/* ==========================================================================
   GRAPH CONTAINER
   ========================================================================== */

.os-graph-container {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--color-surface-hover);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.graph-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ==========================================================================
   TDA OVERLAY
   ========================================================================== */

.os-tda-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

/* ==========================================================================
   QUICK TOOLBAR
   ========================================================================== */

.os-quick-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.os-quick-group {
  display: flex;
  gap: var(--space-xs);
}

.os-btn-quick {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-lg);
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-xs);
}

.os-btn-quick:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-light);
  color: var(--color-text);
}

.os-btn-quick.is-active {
  background: var(--gradient-primary);
  border-color: var(--color-primary-500);
  color: white;
}

.os-btn-quick:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.os-btn-icon {
  font-size: var(--font-size-base);
}

.os-btn-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.os-quick-stats {
  display: flex;
  gap: var(--space-sm);
}

.os-stat-badge {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.1);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.stat-icon {
  font-size: var(--font-size-sm);
}

.os-stat-badge.os-stat-selected {
  background: var(--color-primary-500);
  color: white;
}

/* ==========================================================================
   RIGHT SIDEBAR
   ========================================================================== */

.os-ws-right {
  width: 320px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
}

/* ==========================================================================
   PANELS
   ========================================================================== */

.os-panel-enhanced {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-md);
}

.os-custom-tools {
  margin-top: auto;
}

.os-palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.palette-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.title-icon {
  font-size: var(--font-size-base);
}

.palette-hint {
  font-size: var(--font-size-xs);
  color: var(--color-primary-400);
  font-weight: var(--font-weight-medium);
}

.os-custom-tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-xs);
}

.os-btn-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border-radius: var(--radius-lg);
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-xs);
}

.os-btn-tool:hover:not(:disabled) {
  background: var(--color-surface);
  border-color: var(--color-border-light);
  color: var(--color-text);
  transform: translateY(-2px);
}

.os-btn-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.os-tool-icon {
  font-size: var(--font-size-lg);
}

.os-tool-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ==========================================================================
   ANALYSIS PROGRESS
   ========================================================================== */

.analysis-progress {
  height: 6px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--space-md);
  position: relative;
}

.analysis-progress .progress-bar {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}

.analysis-progress .progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

/* ==========================================================================
   STATS PANEL
   ========================================================================== */

.os-stats-panel {
  margin-top: auto;
}

.stats-header {
  margin-bottom: var(--space-md);
}

.stats-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.stats-icon {
  font-size: var(--font-size-base);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-sm);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all var(--transition-normal);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--transition-normal);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1400px) {
  .os-ws-right {
    width: 280px;
    min-width: 280px;
  }
}

@media (max-width: 1200px) {
  .os-workspace-left {
    width: 240px;
    min-width: 240px;
  }
  
  .os-ws-right {
    width: 260px;
    min-width: 260px;
  }
}

@media (max-width: 1024px) {
  .os-workspace {
    flex-direction: column;
  }
  
  .os-workspace-left,
  .os-ws-right {
    width: 100%;
    min-width: 0;
    border: none;
  }
  
  .os-ws-right {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm);
    overflow: visible;
  }
  
  .os-panel-enhanced {
    flex: 1;
    min-width: 250px;
  }
  
  .os-custom-tools-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .view-head {
    flex-direction: column;
    gap: var(--space-sm);
    text-align: center;
  }
  
  .header-title {
    font-size: var(--font-size-lg);
  }
  
  .os-quick-toolbar {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .os-quick-group {
    width: 100%;
    justify-content: center;
  }
  
  .os-btn-quick {
    padding: var(--space-sm);
  }
  
  .os-btn-label {
    display: none;
  }
  
  .os-quick-stats {
    width: 100%;
    justify-content: center;
  }
  
  .os-custom-tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .os-btn-tool {
    padding: var(--space-xs);
  }
  
  .os-tool-label {
    display: none;
  }
}

/* ==========================================================================
   NEON EFFECT
   ========================================================================== */

.neon {
  position: relative;
}

.neon-primary::before,
.neon-primary::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  z-index: -1;
}

.neon-primary::before {
  background: var(--color-primary-500);
  filter: blur(10px);
  opacity: 0.3;
}

.neon-primary::after {
  background: var(--color-primary-400);
  filter: blur(20px);
  opacity: 0.1;
}

/* ==========================================================================
   GLASS EFFECT
   ========================================================================== */

.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
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
