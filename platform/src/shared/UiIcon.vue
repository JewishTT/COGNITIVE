<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="def.viewBox"
    fill="none"
    :stroke="def.fill ? 'none' : 'currentColor'"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="def.nodes.join('')"
    class="ui-icon"
    :style="styleObj"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from './icons'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number | string
    color?: string
  }>(),
  { size: 16, strokeWidth: 1.8, color: undefined },
)

const def = computed(() => ICONS[props.name] ?? ICONS.box)
const styleObj = computed(() => (props.color ? { color: props.color } : undefined))
</script>

<style scoped>
.ui-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  pointer-events: none;
}
</style>