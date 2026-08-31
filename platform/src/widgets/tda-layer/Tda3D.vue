<template>
  <div class="os3d">
    <div class="os3d-stage">
      <div ref="container" class="os3d-canvas"></div>
      <div class="os3d-hud">
        <div class="os3d-legend">
          <span><i class="os-lg-dot" style="background:#22d3ee"></i> 0-симплекс · вершина</span>
          <span><i class="os-lg-line"></i> 1-симплекс · ребро</span>
          <span><i class="os-lg-tri" style="border-top-color:#a3e635"></i> 2-симплекс · треугольник</span>
        </div>
      </div>
      <div v-if="error" class="os3d-error">{{ error }}</div>
    </div>
    <p class="os3d-tip">ЛКМ — вращение · колесо — зум · клик по треугольнику — подсветка его узлов</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { analyzeTda, colorFor } from '@/shared/lib/tda'
import type { GraphData } from '@/shared/api/types'

const props = defineProps<{ graph: GraphData | null; highlightIds?: string[] }>()

const emit = defineEmits<{
  (e: 'highlight', ids: string[]): void
  (e: 'clear'): void
}>()

const container = ref<HTMLDivElement | null>(null)
const error = ref<string>('')

let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let frame = Cesium.Matrix4.IDENTITY.clone()
let selectedTri: string | null = null

const nodeBase = new Map<string, Cesium.Color>()
const nodeEnts = new Map<string, Cesium.Entity>()
interface TriRec { id: string; entity: Cesium.Entity; base: Cesium.Color }
const tris: TriRec[] = []

const REF = Cesium.Cartesian3.fromDegrees(37.6, 55.75)
const BG = Cesium.Color.fromCssColorString('#070c14')
const GLOW_EDGE = '#4cc9f0'

function loc(x: number, y: number, z: number): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(x, y, z), new Cesium.Cartesian3())
}

function lift(x: number, y: number): number {
  const L = 190
  return Math.sin((x / L) * Math.PI) * Math.cos((y / L) * Math.PI) * 42 + x * 0.05
}


function build() {
  if (!viewer) return
  viewer.entities.removeAll()
  tris.length = 0
  nodeEnts.clear()
  nodeBase.clear()
  selectedTri = null

  const nds = props.graph?.nds || []
  const rls = props.graph?.rls || []
  if (nds.length === 0) return

  const tda = analyzeTda(
    nds.map((n) => ({ id: n.id, label: n.nodeLabel, type: n.nodeType, x: n.x ?? 0, y: n.y ?? 0 })),
    rls.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
  )

  const xs = nds.map((n) => n.x ?? 0)
  const ys = nds.map((n) => n.y ?? 0)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const range = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const S = 210 / range

  const cart = new Map<string, Cesium.Cartesian3>()
  nds.forEach((n) => {
    const x = ((n.x ?? 0) - cx) * S
    const y = ((n.y ?? 0) - cy) * S
    cart.set(n.id, loc(x, y, lift(x, y)))
  })

  /* Stage floor — one hologram grid instead of a constellation void. */
  const HALF = 170
  viewer.entities.add({
    id: 'stage:floor',
    polygon: {
      hierarchy: [loc(-HALF, -HALF, 0), loc(HALF, -HALF, 0), loc(HALF, HALF, 0), loc(-HALF, HALF, 0)],
      material: new Cesium.GridMaterialProperty({
        color: Cesium.Color.fromCssColorString('#2f5d8a').withAlpha(0.5),
        cellAlpha: 0.05,
        lineCount: new Cesium.Cartesian2(22, 22),
        lineThickness: new Cesium.Cartesian2(1.2, 1.2),
      }),
      height: 0,
    },
  })

  /* 1-simplices — glowing struts. */
  const glow = new Cesium.PolylineGlowMaterialProperty({
    glowPower: 0.26,
    color: Cesium.Color.fromCssColorString(GLOW_EDGE),
  })
  rls.forEach((e) => {
    const a = cart.get(e.source)
    const b = cart.get(e.target)
    if (!a || !b) return
    viewer!.entities.add({
      id: 'e:' + e.id,
      polyline: { positions: [a, b], width: 3.5, material: glow, clampToGround: false },
    })
  })

  /* 2-simplices — tinted translucent facets with lit edges. */
  tda.triangles.forEach((t, i) => {
    const pts = t.nodeIds.map((id) => cart.get(id)).filter((p): p is Cesium.Cartesian3 => p != null)
    if (pts.length !== 3) return
    const color = colorFor(i + 2)
    const fill = Cesium.Color.fromCssColorString(color).withAlpha(0.48)
    const entity = viewer!.entities.add({
      id: 't:' + t.nodeIds.join('|'),
      polygon: {
        hierarchy: pts,
        material: fill,
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.95),
      },
    })
    tris.push({ id: t.nodeIds.join('|'), entity, base: fill })
  })

  /* 0-simplices — solid shaded spheres. */
  nds.forEach((n) => {
    const c = cart.get(n.id)
    if (!c) return
    const col = Cesium.Color.fromCssColorString(n.nodeColor || '#22d3ee')
    nodeBase.set(n.id, col)
    const ent = viewer!.entities.add({
      id: 'v:' + n.id,
      position: c,
      ellipsoid: {
        radii: new Cesium.Cartesian3(7.5, 7.5, 7.5),
        material: col,
        slicePartitions: 24,
        stackPartitions: 14,
      },
      label: {
        text: n.nodeLabel,
        font: '600 13px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#eaf2ff'),
        outlineColor: BG,
        outlineWidth: 4,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      },
    })
    nodeEnts.set(n.id, ent)
  })

  const pts = Array.from(cart.values())
  const sphere = Cesium.BoundingSphere.fromPoints(pts)
  if (sphere.radius > 0) {
    const offset = new Cesium.HeadingPitchRange(0.55, -0.42, sphere.radius * 2.5)
    viewer.camera.viewBoundingSphere(sphere, offset)
  }

  applyHighlight()
  viewer.scene.requestRender()
}

function applyHighlight() {
  const set = new Set(props.highlightIds || [])
  nodeEnts.forEach((ent, id) => {
    const base = nodeBase.get(id)
    if (!ent.ellipsoid || !base) return
    const on = set.has(id)
    ent.ellipsoid.material = (on ? Cesium.Color.fromCssColorString('#fde047') : base) as Cesium.MaterialProperty
  })
  viewer?.scene.requestRender()
}

function select(id: string) {
  for (const t of tris) {
    const on = t.id === id
    const mat = on ? Cesium.Color.fromCssColorString('#fde047').withAlpha(0.72) : t.base
    t.entity.polygon!.material = mat as Cesium.MaterialProperty
  }
  selectedTri = id === selectedTri ? null : id
  if (selectedTri) emit('highlight', selectedTri.split('|').filter(Boolean))
  else emit('clear')
  viewer?.scene.requestRender()
}

onMounted(() => {
  if (!container.value) return
  try {
    viewer = new Cesium.Viewer(container.value, {
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      timeline: false,
      animation: false,
      selectionIndicator: false,
      infoBox: false,
      shouldAnimate: false,
    })
    /* Lab scene, not outer space: no starfield, no atmosphere, no sun/moon. */
    viewer.scene.globe.show = false
    viewer.scene.skyBox.show = false
    viewer.scene.skyAtmosphere.show = false
    if (viewer.scene.sun) viewer.scene.sun.show = false
    if (viewer.scene.moon) viewer.scene.moon.show = false
    viewer.scene.backgroundColor = BG
    viewer.scene.requestRenderMode = true
    viewer.scene.maximumRenderTimeChange = Infinity
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false
    frame = Cesium.Transforms.eastNorthUpToFixedFrame(REF)

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
      const picked = viewer!.scene.pick(movement.position)
      if (picked && picked.id && typeof picked.id.id === 'string' && picked.id.id.startsWith('t:')) {
        select(picked.id.id.slice(2))
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    build()
  } catch (e) {
    error.value = String((e as Error)?.message || e)
    console.error('TDA 3D init failed', e)
  }
})

watch(() => props.graph, () => build(), { deep: true })
watch(() => props.highlightIds, () => applyHighlight())

onBeforeUnmount(() => {
  handler?.destroy()
  handler = null
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy()
    viewer = null
  }
})
</script>
