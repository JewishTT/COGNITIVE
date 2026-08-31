<template>
  <div class="osint-page">
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
        {{ tab.label }}
      </button>
    </nav>

    <div class="os-tab-body">
      <UiFlowsintTab v-if="activeTab === 'ui'" />
      <PipelineTab v-else-if="activeTab === 'pipeline'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UiFlowsintTab from './tabs/UiFlowsintTab.vue'
import PipelineTab from './tabs/PipelineTab.vue'

const tabs = [
  { id: 'ui', label: 'UI Flowsint' },
  { id: 'pipeline', label: 'Пайплайн' },
]

const activeTab = ref<string>('ui')
</script>

<style scoped>
.osint-page { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.os-tabs { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid var(--border); }
.os-tab {
  padding: 7px 16px;
  font-size: 13px;
  color: var(--muted);
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
}
.os-tab:hover { color: var(--text); }
.os-tab.active {
  color: var(--text);
  background: var(--panel);
  border-color: var(--border);
  position: relative;
  top: 1px;
}
.os-tab-body { flex: 1; min-height: 0; display: flex; }
.os-tab-body > * { flex: 1; min-width: 0; }
</style>
