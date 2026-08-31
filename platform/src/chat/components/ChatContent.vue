<!--
  ChatContent.vue — render-function wrapper around the markdown-ish `renderContent`
  helper. A plain template can't emit a dynamic array of VNodes, so this thin
  functional component renders `renderContent(content)` as a real VNode tree
  (no innerHTML → XSS-safe).
-->
<script lang="ts">
import { defineComponent, h } from 'vue'
import { renderContent } from '../formatContent'

export default defineComponent({
  name: 'ChatContent',
  inheritAttrs: false,
  props: { content: { type: String, required: true } },
  setup(props) {
    return () => h('div', { class: 'gev-msg-body' }, renderContent(props.content))
  },
})
</script>

<style scoped>
.gev-msg-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>

