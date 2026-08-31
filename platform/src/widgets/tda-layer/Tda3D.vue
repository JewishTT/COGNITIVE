<template>
  <div class="os3d-container">
    <!-- Header with Controls -->
    <div class="os3d-header">
      <div class="os3d-title">
        <span class="os3d-icon">[38;5;208m[0m</span>
        <span>3D Simplicial Complex</span>
      </div>
      <div class="os3d-controls">
        <button 
          class="os3d-btn" 
          @click="resetCamera"
          title="Reset Camera View"
        >
          [38;5;220m[0m
        </button>
        <button 
          class="os3d-btn" 
          @click="toggleRotation"
          :class="{ 'is-active': autoRotate }"
          title="Toggle Auto Rotation"
        >
          [38;5;220m[0m
        </button>
        <button 
          class="os3d-btn" 
          @click="toggleLabels"
          :class="{ 'is-active': showLabels }"
          title="Toggle Node Labels"
        >
          [38;5;220mA[0m
        </button>
      </div>
    </div>

    <!-- Main Canvas -->
    <div ref="container" class="os3d-canvas"></div>

    <!-- Legend -->
    <div class="os3d-legend">
      <div class="os3d-legend-item">
        <span class="os3d-legend-dot" style="background: #22d3ee;"></span>
        <span>0-Simplex (Vertices)</span>
      </div>
      <div class="os3d-legend-item">
        <span class="os3d-legend-line"></span>
        <span>1-Simplex (Edges)</span>
      </div>
      <div class="os3d-legend-item">
        <span class="os3d-legend-tri" style="border-top-color: #a3e635;"></span>
        <span>2-Simplex (Triangles)</span>
      </div>
    </div>

    <!-- Status -->
    <div v-if="error" class="os3d-error">
      <span>[38;5;196mError:[0m {{ error }}</span>
      <button class="os3d-btn" @click="error = ''">[38;5;196mX[0m</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="os3d-loading">
      <span>[38;5;220mBuilding complex...[0m</span>
    </div>

    <!-- Stats Overlay -->
    <div v-if="stats" class="os3d-stats">
      <div class="os3d-stat">
        <span class="os3d-stat-label">Vertices</span>
        <span class="os3d-stat-value">{{ stats.vertices }}</span>
      </div>
      <div class="os3d-stat">
        <span class="os3d-stat-label">Edges</span>
        <span class="os3d-stat-value">{{ stats.edges }}</span>
      </div>
      <div class="os3d-stat">
        <span class="os3d-stat-label">Triangles</span>
        <span class="os3d-stat-value">{{ stats.triangles }}</span>
      </div>
    </div>

    <!-- Help Tip -->
    <p class="os3d-tip">
      [38;5;240mLMB + Drag: Rotate [38;5;240m|[0m [38;5;240mRMB + Drag: Pan [38;5;240m|[0m [38;5;240mScroll: Zoom[0m
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { analyzeTda, type TdaNode, type TdaEdge } from '@/shared/lib/tda'
import type { GraphData } from '@/shared/api/types'

const props = defineProps<{ 
  graph: GraphData | null; 
  highlightIds?: string[] 
}>()

const emit = defineEmits<{ 
  (e: 'highlight', ids: string[]): void 
  (e: 'clear'): void 
}>()

// State
const container: Ref<HTMLDivElement | null> = ref(null)
const error = ref<string>('')
const loading = ref(false)
const autoRotate = ref(false)
const showLabels = ref(false)

// Stats
const stats = ref<{ vertices: number; edges: number; triangles: number } | null>(null)

// Cesium Viewer
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let frame = Cesium.Matrix4.IDENTITY.clone()
let rotationId: number | null = null

// Configuration
const BG = Cesium.Color.fromCssColorString('#070c14')
const GLOW_EDGE = '#4cc9f0'
const REF = Cesium.Cartesian3.fromDegrees(37.6, 55.75)

// Node and edge storage
const nodeEntities = new Map<string, Cesium.Entity>()
const edgeEntities = new Map<string, Cesium.Entity>()
const triangleEntities: Array<{ id: string; entity: Cesium.Entity }> = []

// Lift function for 3D positioning
function lift(x: number, y: number): number {
  const L = 190
  return Math.sin((x / L) * Math.PI) * Math.cos((y / L) * Math.PI) * 42 + x * 0.05
}

// Position calculation
function loc(x: number, y: number, z: number): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(x, y, z), new Cesium.Cartesian3())
}

// Build the 3D scene
function build() {
  if (!viewer || !props.graph) return
  
  loading.value = true
  error.value = ''
  
  try {
    // Clear existing entities
    viewer.entities.removeAll()
    nodeEntities.clear()
    edgeEntities.clear()
    triangleEntities.length = 0
    
    const nds = props.graph.nds || []
    const rls = props.graph.rls || []
    
    if (nds.length === 0) {
      stats.value = { vertices: 0, edges: 0, triangles: 0 }
      loading.value = false
      return
    }
    
    // Run TDA analysis to get triangles
    const nodes: TdaNode[] = nds.map(n => ({
      id: n.id,
      label: n.nodeLabel,
      type: n.nodeType,
      x: n.x || 0,
      y: n.y || 0
    }))
    
    const edges: TdaEdge[] = rls.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label
    }))
    
    const tda = analyzeTda(nodes, edges)
    
    // Calculate positions
    const xs = nds.map(n => n.x || 0)
    const ys = nds.map(n => n.y || 0)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const range = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      1
    )
    const S = 210 / range
    
    const cart = new Map<string, Cesium.Cartesian3>()
    nds.forEach(n => {
      const x = ((n.x || 0) - cx) * S
      const y = ((n.y || 0) - cy) * S
      cart.set(n.id, loc(x, y, lift(x, y)))
    })
    
    // Stage floor - hologram grid
    const HALF = 170
    viewer.entities.add({
      id: 'stage:floor',
      polygon: {
        hierarchy: [
          loc(-HALF, -HALF, 0),
          loc(HALF, -HALF, 0),
          loc(HALF, HALF, 0),
          loc(-HALF, HALF, 0)
        ],
        material: new Cesium.GridMaterialProperty({
          color: Cesium.Color.fromCssColorString('#2f5d8a').withAlpha(0.5),
          cellAlpha: 0.05,
          lineCount: new Cesium.Cartesian2(22, 22),
          lineThickness: new Cesium.Cartesian2(1.2, 1.2),
        }),
        height: -50,
        extrudedHeight: 0,
      },
    })
    
    // Add nodes (0-simplices)
    nds.forEach(n => {
      const pos = cart.get(n.id)
      if (!pos) return
      
      const nodeColor = n.nodeColor 
        ? Cesium.Color.fromCssColorString(n.nodeColor)
        : Cesium.Color.fromCssColorString('#22d3ee')
      
      const entity = viewer.entities.add({
        id: `node:${n.id}`,
        name: n.nodeLabel,
        position: pos,
        ellipsoid: {
          radii: new Cesium.Cartesian3(8, 8, 8),
          material: nodeColor,
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
          outlineWidth: props.highlightIds?.includes(n.id) ? 3 : 1,
          slicePartitions: 16,
          stackPartitions: 16,
        },
      })
      
      nodeEntities.set(n.id, entity)
      
      // Add label if enabled
      if (showLabels.value) {
        entity.label = {
          text: n.nodeLabel,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          eyeOffset: new Cesium.Cartesian3(0, 0, -50),
        }
      }
    })
    
    // Add edges (1-simplices)
    rls.forEach(e => {
      const sourcePos = cart.get(e.source)
      const targetPos = cart.get(e.target)
      
      if (!sourcePos || !targetPos) return
      
      const edgeColor = Cesium.Color.fromCssColorString(GLOW_EDGE)
      
      const entity = viewer.entities.add({
        id: `edge:${e.id}`,
        polyline: {
          positions: [sourcePos, targetPos],
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: edgeColor,
            glowPower: 0.5,
          }),
          depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
            color: edgeColor.withAlpha(0.5),
            glowPower: 0.3,
          }),
        },
      })
      
      edgeEntities.set(e.id, entity)
    })
    
    // Add triangles (2-simplices) if available
    if (tda.triangles && tda.triangles.length > 0) {
      tda.triangles.forEach(tri => {
        const a = cart.get(tri.nodeIds[0])
        const b = cart.get(tri.nodeIds[1])
        const c = cart.get(tri.nodeIds[2])
        
        if (!a || !b || !c) return
        
        const triangleColor = Cesium.Color.fromCssColorString('#a3e635').withAlpha(0.3)
        
        const entity = viewer.entities.add({
          id: `triangle:${tri.id}`,
          polygon: {
            hierarchy: [a, b, c],
            material: triangleColor,
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#a3e635').withAlpha(0.8),
            outlineWidth: 1,
          },
        })
        
        triangleEntities.push({ id: tri.id, entity })
      })
    }
    
    // Update stats
    stats.value = {
      vertices: nds.length,
      edges: rls.length,
      triangles: tda.triangles?.length || 0
    }
    
    // Frame the scene
    frameScene()
    
  } catch (err) {
    error.value = String(err)
    console.error('3D TDA Error:', err)
  } finally {
    loading.value = false
  }
}

// Frame the scene to show all content
function frameScene() {
  if (!viewer) return
  
  // Calculate bounding sphere
  const allPositions: Cesium.Cartesian3[] = []
  
  nodeEntities.forEach(entity => {
    if (entity.position) {
      allPositions.push(entity.position.getValue(viewer.clock.currentTime))
    }
  })
  
  if (allPositions.length > 0) {
    const boundingSphere = Cesium.BoundingSphere.fromPoints(allPositions)
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      offset: new Cesium.HeadingPitchRange(0, -0.5, boundingSphere.radius * 2),
      duration: 1.0,
    })
  }
}

// Reset camera
function resetCamera() {
  if (!viewer) return
  
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-120, 30, 500),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
    duration: 1.0,
  })
}

// Toggle auto rotation
function toggleRotation() {
  autoRotate.value = !autoRotate.value
  
  if (autoRotate.value) {
    startRotation()
  } else {
    stopRotation()
  }
}

// Start auto rotation
function startRotation() {
  if (!viewer || rotationId !== null) return
  
  let heading = viewer.camera.heading
  rotationId = viewer.clock.onTick.addEventListener(() => {
    heading += 0.002
    viewer.camera.setView({
      orientation: {
        heading: heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      },
    })
  })
}

// Stop auto rotation
function stopRotation() {
  if (rotationId !== null) {
    viewer?.clock.onTick.removeEventListener(rotationId)
    rotationId = null
  }
}

// Toggle labels
function toggleLabels() {
  showLabels.value = !showLabels.value
  
  if (!viewer) return
  
  // Update all node labels
  nodeEntities.forEach((entity, nodeId) => {
    const nd = props.graph?.nds.find(n => n.id === nodeId)
    if (nd) {
      entity.label = showLabels.value ? {
        text: nd.nodeLabel,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        eyeOffset: new Cesium.Cartesian3(0, 0, -50),
      } : undefined
    }
  })
}

// Highlight nodes
function highlightNodes(ids: string[]) {
  nodeEntities.forEach((entity, nodeId) => {
    const isHighlighted = ids.includes(nodeId)
    const node = props.graph?.nds.find(n => n.id === nodeId)
    
    if (node && entity.ellipsoid) {
      entity.ellipsoid.outlineWidth = isHighlighted ? 3 : 1
      entity.ellipsoid.outlineColor = isHighlighted 
        ? Cesium.Color.YELLOW 
        : Cesium.Color.WHITE.withAlpha(0.8)
    }
  })
}

// Initialize viewer
function initViewer() {
  if (!container.value) return
  
  // Configure Cesium
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYjQxMzU0My1mZjQxLTRhZTktYmE1Zi03ZjQzZDQyYzE0YzgiLCJpZCI6MTU5NjQsInNjI6InRydWUiLCJzY29wZXMiOlsiY3MiXSwiaWF0IjoxNjU4MzM3MTQ4fQ.1Z9v2Q4Q5v5Jv5Jv5Jv5Jv5Jv5Jv5Jv5Jv5Jv5Jv5J8'
  
  viewer = new Cesium.Viewer(container.value, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
    homeButton: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    geocoder: false,
    sceneModePicker: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: true,
    maximumScreenSpaceError: 2,
    shadows: false,
    environmentMap: undefined,
    skyBox: undefined,
    skyAtmosphere: undefined,
    stars: undefined,
    sun: undefined,
    moon: undefined,
    groundAtmosphere: undefined,
  })
  
  // Configure camera
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.requestRenderMode = true
  viewer.scene.maximumScreenSpaceError = 2
  
  // Disable default lighting
  viewer.scene.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(-0.5, -0.5, -1),
    intensity: 0.5,
  })
  
  // Set background color
  viewer.scene.backgroundColor = BG
  
  // Set up handler for selection
  handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
  
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.Position) => {
    const picked = viewer?.scene.pick(movement.endPosition)
    if (picked && picked.id) {
      const entityId = String(picked.id)
      if (entityId.startsWith('node:')) {
        const nodeId = entityId.replace('node:', '')
        emit('highlight', [nodeId])
      } else if (entityId.startsWith('edge:')) {
        const edgeId = entityId.replace('edge:', '')
        const edge = props.graph?.rls.find(e => e.id === edgeId)
        if (edge) {
          emit('highlight', [edge.source, edge.target])
        }
      }
    } else {
      emit('clear')
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // Handle window resize
  const resizeObserver = new ResizeObserver(() => {
    viewer?.resize()
  })
  resizeObserver.observe(container.value)
  
  // Cleanup on unmount
  onBeforeUnmount(() => {
    resizeObserver.disconnect()
    if (viewer) {
      viewer.destroy()
      viewer = null
    }
    if (handler) {
      handler.destroy()
      handler = null
    }
    stopRotation()
  })
}

// Watch for graph changes
watch(
  () => props.graph,
  (newGraph) => {
    if (newGraph) {
      build()
    } else {
      if (viewer) {
        viewer.entities.removeAll()
        stats.value = null
      }
    }
  },
  { immediate: true }
)

// Watch for highlight changes
watch(
  () => props.highlightIds,
  (newHighlights) => {
    if (newHighlights) {
      highlightNodes(newHighlights)
    }
  },
  { immediate: true }
)

// Initialize on mount
onMounted(() => {
  initViewer()
})
</script>

<style scoped>
/* Container */
.os3d-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

/* Header */
.os3d-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.os3d-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.os3d-icon {
  font-size: 1.1rem;
}

.os3d-controls {
  display: flex;
  gap: 4px;
}

.os3d-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.os3d-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.os3d-btn.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

/* Canvas */
.os3d-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* Legend */
.os3d-legend {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.os3d-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.os3d-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.os3d-legend-line {
  width: 20px;
  height: 2px;
  background: #4cc9f0;
  border-radius: 1px;
}

.os3d-legend-tri {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 10px solid;
}

/* Error */
.os3d-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.8rem;
}

/* Loading */
.os3d-loading {
  padding: 8px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

/* Stats */
.os3d-stats {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

.os3d-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.os3d-stat-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.os3d-stat-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

/* Tip */
.os3d-tip {
  padding: 6px 12px;
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

/* Responsive */
@media (max-width: 900px) {
  .os3d-header {
    padding: 6px 8px;
  }
  
  .os3d-title {
    font-size: 0.8rem;
  }
  
  .os3d-btn {
    width: 24px;
    height: 24px;
    font-size: 0.8rem;
  }
  
  .os3d-legend {
    font-size: 0.65rem;
    gap: 12px;
  }
  
  .os3d-stats {
    gap: 12px;
  }
  
  .os3d-stat-value {
    font-size: 0.8rem;
  }
}
</style>
