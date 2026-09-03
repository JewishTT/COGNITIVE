<template>
  <div class="ld-overlay" @click.self="$emit('close')">
    <div class="ld-dialog">
      <!-- Header -->
      <div class="ld-header">
        <h2 class="ld-title">Launch Pipeline</h2>
        <button class="c-btn c-btn-ghost c-btn-icon" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="ld-body">
        <!-- Target input -->
        <div class="ld-field">
          <label class="ld-label">Target</label>
          <input
            v-model="target"
            class="c-input"
            placeholder="e.g. username, domain, email, IP…"
            autofocus
            @keyup.enter="handleLaunch"
          />
        </div>

        <!-- Type selector -->
        <div class="ld-field">
          <label class="ld-label">Type</label>
          <div class="ld-types">
            <button
              v-for="t in types"
              :key="t.id"
              class="ld-type-btn"
              :class="{ active: type === t.id }"
              @click="type = t.id"
            >
              <span class="ld-type-icon">{{ t.icon }}</span>
              <span class="ld-type-name">{{ t.label }}</span>
            </button>
          </div>
        </div>

        <!-- Available tools preview -->
        <div class="ld-field">
          <label class="ld-label">Available Tools ({{ availableTools.length }})</label>
          <div class="ld-tools">
            <span v-for="tool in availableTools" :key="tool.name" class="c-badge c-badge-info">
              {{ tool.label || tool.name }}
            </span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="ld-footer">
        <button class="c-btn c-btn-secondary" @click="$emit('close')">Cancel</button>
        <button
          class="c-btn c-btn-primary"
          :disabled="!target.trim()"
          @click="handleLaunch"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Launch
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PipelineTool } from '@/entities/pipeline/api'

const props = defineProps<{
  tools: PipelineTool[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'launch', target: string, type: string): void
}>()

const target = ref('')
const type = ref('username')

const types = [
  { id: 'username', label: 'Username', icon: '@' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'domain', label: 'Domain', icon: '⊞' },
  { id: 'ip', label: 'IP Address', icon: '◈' },
  { id: 'phone', label: 'Phone', icon: 'phone' },
  { id: 'company', label: 'Company', icon: 'building' },
]

const availableTools = computed(() =>
  props.tools.filter(t => t.status === 'installed').slice(0, 6)
)

function handleLaunch() {
  if (!target.value.trim()) return
  emit('launch', target.value.trim(), type.value)
}
</script>

<style scoped>
.ld-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.ld-dialog {
  width: 480px;
  max-width: 90vw;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ld-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4);
  border-bottom: 1px solid var(--border-subtle);
}

.ld-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
}

.ld-body {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.ld-field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.ld-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-secondary);
}

.ld-types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
}

.ld-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-2);
  background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.ld-type-btn:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.ld-type-btn.active {
  border-color: var(--accent);
  background: var(--surface-active);
}

.ld-type-icon {
  font-size: var(--text-lg);
}

.ld-type-name {
  font-size: var(--text-xs);
  color: var(--fg-secondary);
}

.ld-type-btn.active .ld-type-name {
  color: var(--accent);
}

.ld-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}

.ld-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--border-subtle);
}
</style>
