<template>
  <div class="pl-root">
    <!-- Header -->
    <header class="pl-header">
      <div class="pl-header-left">
        <h1 class="pl-title">
          <svg class="pl-title-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/>
            <line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
          Pipeline
        </h1>
        <span class="pl-header-sep" />
        <span class="pl-header-sub">OSINT Data Collection & Enrichment</span>
      </div>
      <div class="pl-header-right">
        <button class="c-btn c-btn-secondary" @click="refreshStatus" :disabled="refreshing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'pl-spin': refreshing }">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
        <button class="c-btn c-btn-primary" @click="showLaunchDialog = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Launch Pipeline
        </button>
      </div>
    </header>

    <!-- Stats -->
    <div class="pl-stats">
      <div class="c-stat">
        <span class="c-stat-value">{{ tools.length }}</span>
        <span class="c-stat-label">Tools</span>
      </div>
      <div class="c-stat">
        <span class="c-stat-value">{{ tools.filter(t => t.status === 'installed').length }}</span>
        <span class="c-stat-label">Installed</span>
      </div>
      <div class="c-stat">
        <span class="c-stat-value">{{ runs.length }}</span>
        <span class="c-stat-label">Total Runs</span>
      </div>
      <div class="c-stat">
        <span class="c-stat-value">{{ runs.filter(r => r.status === 'running').length }}</span>
        <span class="c-stat-label">Running</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="c-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="c-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="c-badge c-badge-neutral">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="pl-content">
      <!-- Tools list -->
      <ToolsList
        v-if="activeTab === 'tools'"
        :tools="tools"
        :installing="installingTool"
        @install="installTool"
      />

      <!-- Runs history -->
      <RunsList
        v-else-if="activeTab === 'runs'"
        :runs="runs"
        :loading="refreshing"
        @view-run="viewRun"
        @cancel-run="cancelRun"
      />

      <!-- Active run detail -->
      <RunDetail
        v-else-if="activeTab === 'active' && activeRun"
        :run="activeRun"
        :live-log="liveLog"
        @cancel="cancelRun(activeRun.id)"
      />

      <!-- Empty state for active tab -->
      <div v-else-if="activeTab === 'active'" class="c-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="c-empty-icon">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <p class="c-empty-text">No active pipeline run</p>
        <button class="c-btn c-btn-primary" @click="showLaunchDialog = true">Launch Pipeline</button>
      </div>
    </div>

    <!-- Launch dialog -->
    <LaunchDialog
      v-if="showLaunchDialog"
      :tools="tools"
      @close="showLaunchDialog = false"
      @launch="launchPipeline"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { pipelineApi } from '@/entities/pipeline/api'
import ToolsList from './ToolsList.vue'
import RunsList from './RunsList.vue'
import RunDetail from './RunDetail.vue'
import LaunchDialog from './LaunchDialog.vue'
import type { PipelineTool, PipelineRun } from '@/entities/pipeline/api'

const refreshing = ref(false)
const installingTool = ref('')
const showLaunchDialog = ref(false)
const activeTab = ref('tools')
const tools = ref<PipelineTool[]>([])
const runs = ref<PipelineRun[]>([])
const activeRun = ref<PipelineRun | null>(null)
const liveLog = ref<string[]>([])
let eventSource: EventSource | null = null

const tabs = computed(() => [
  { id: 'tools', label: 'Tools', count: tools.value.length },
  { id: 'runs', label: 'Runs', count: runs.value.length },
  { id: 'active', label: 'Active', count: runs.value.filter(r => r.status === 'running').length },
])

async function refreshStatus() {
  refreshing.value = true
  try {
    const [status, runList] = await Promise.all([
      pipelineApi.status(),
      pipelineApi.runs(),
    ])
    tools.value = status.tools || []
    runs.value = runList || []
  } catch (e) {
    console.error('Failed to refresh pipeline status:', e)
  } finally {
    refreshing.value = false
  }
}

async function installTool(name: string) {
  installingTool.value = name
  try {
    await pipelineApi.install(name)
    await refreshStatus()
  } catch (e) {
    console.error('Install failed:', e)
  } finally {
    installingTool.value = ''
  }
}

async function launchPipeline(target: string, type: string) {
  try {
    const result = await pipelineApi.launch(target, type)
    showLaunchDialog.value = false
    activeTab.value = 'active'
    await refreshStatus()
    if (result.id) {
      openRun(result.id)
    }
  } catch (e) {
    console.error('Launch failed:', e)
  }
}

async function viewRun(id: string) {
  activeTab.value = 'active'
  openRun(id)
}

function openRun(id: string) {
  const run = runs.value.find(r => r.id === id)
  if (run) {
    activeRun.value = run
    liveLog.value = []

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    eventSource = pipelineApi.subscribeRun(id, (event) => {
      liveLog.value.push(`[${new Date().toLocaleTimeString()}] ${event.type}: ${event.message || ''}`)
      if (event.type === 'complete' || event.type === 'error') {
        eventSource?.close()
        eventSource = null
        refreshStatus()
      }
    })
  }
}

async function cancelRun(id: string) {
  try {
    await pipelineApi.cancel(id)
    await refreshStatus()
    if (activeRun.value?.id === id) {
      activeRun.value = null
      activeTab.value = 'runs'
    }
  } catch (e) {
    console.error('Cancel failed:', e)
  }
}

onMounted(refreshStatus)

onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close()
  }
})
</script>

<style scoped>
.pl-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--sp-3);
}

/* ── Header ──────────────────────────────────────────────── */
.pl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.pl-header-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.pl-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
}

.pl-title-icon {
  color: var(--accent);
}

.pl-header-sep {
  width: 1px;
  height: 16px;
  background: var(--border-default);
}

.pl-header-sub {
  font-size: var(--text-sm);
  color: var(--fg-muted);
}

.pl-header-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* ── Stats ────────────────────────────────────────────────── */
.pl-stats {
  display: flex;
  gap: var(--sp-3);
  flex-shrink: 0;
}

/* ── Content ──────────────────────────────────────────────── */
.pl-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ── Spinner ──────────────────────────────────────────────── */
.pl-spin {
  animation: pl-spin 0.8s linear infinite;
}

@keyframes pl-spin {
  to { transform: rotate(360deg); }
}
</style>
