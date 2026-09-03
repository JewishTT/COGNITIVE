<template>
  <button
    class="btn os-btn-tda"
    :class="{ 'os-btn-tda-active': active }"
    :disabled="disabled"
    @click="handleClick"
    :title="active ? 'Disable TDA Overlay' : 'Enable TDA Overlay'"
  >
    <span class="os-tda-btn-icon"> </span>
    <span class="os-tda-btn-text">{{ active ? 'TDA On' : 'TDA' }}</span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()

function handleClick() {
  emit('toggle')
}
</script>

<style scoped>
.os-btn-tda {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.os-btn-tda:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.os-btn-tda:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.os-btn-tda-active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.os-btn-tda-active:hover:not(:disabled) {
  background: var(--accent-hover, var(--accent));
  border-color: var(--accent-hover, var(--accent));
}

.os-tda-btn-icon {
  font-size: 1rem;
}

.os-tda-btn-text {
  font-weight: 500;
}
</style>