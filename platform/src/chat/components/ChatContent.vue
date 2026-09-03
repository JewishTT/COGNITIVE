<!--
  ChatContent.vue — render-function wrapper for the markdown renderer.
  Outputs real VNodes (no innerHTML → XSS-safe).
-->
<script lang="ts">
import { defineComponent, h } from 'vue'
import { renderContent } from '../formatContent'

export default defineComponent({
  name: 'ChatContent',
  inheritAttrs: false,
  props: { content: { type: String, required: true } },
  setup(props) {
    return () => h('div', { class: 'msg-body' }, renderContent(props.content))
  },
})
</script>

<style scoped>
.msg-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}
.msg-body :deep(.gev-line) {
  display: block;
  min-width: 0;
  width: 100%;
}
</style>
