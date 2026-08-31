<template>
  <section class="view view-embed os-view">
    <header class="view-head view-head-embed">
      <h1>ОСИНТ</h1>
      <span class="chip">ДВИЖОК FLOWSINT · NEO4J · ENRICHER THEBIGBROTHER · TDA</span>
    </header>

    <div class="os-workspace">
      <InvestigationSidebar :active-sketch-id="activeSketchId" @select="onSelect" />

      <div class="os-ws-center">
        <GraphCanvas
          ref="canvasRef"
          :sketch-id="activeSketchId"
          :highlight-ids="highlightIds"
          @graph="onGraph"
          @selection="onSelection"
          @tbb-state="onTbbState"
        />
        <TdaLayer
          :graph="currentGraph"
          :highlight-ids="highlightIds"
          @highlight="onHighlight"
          @clear="onClearHighlight"
        />
      </div>

      <div class="os-ws-right">
        <NodeInspector
          :node="selectedNode"
          @close="onCloseInspector"
          @delete="onDeleteNode"
        />
        <TypePalette :sketch-id="activeSketchId" @added="onAdded" />
        <EnricherCatalog
          :sketch-id="activeSketchId"
          :node-ids="selectedNodeIds"
          :disabled="tbbBusy"
          @enriched="onEnriched"
        />
        <EventLog :sketch-id="activeSketchId" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import InvestigationSidebar from '@/widgets/investigation-sidebar/index.vue'
import GraphCanvas from '@/widgets/graph-canvas/index.vue'
import TdaLayer from '@/widgets/tda-layer/index.vue'
import NodeInspector from '@/widgets/node-inspector/index.vue'
import TypePalette from '@/widgets/type-palette/index.vue'
import EnricherCatalog from '@/widgets/enricher-catalog/index.vue'
import EventLog from '@/widgets/event-log/index.vue'
import '@/shared/styles/osint-graph.css'
import { useOsintPage } from '../useOsintPage'

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
</script>
