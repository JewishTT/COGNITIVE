/**
 * tda.ts — Topological Data Analysis engine for the OSINT investigation graph.
 *
 * Dependency-free, pure functions. Works on the undirected projection of a
 * Flowsint sketch graph and answers the questions an investigator actually
 * asks of a link graph:
 *
 *   H0 · connected components — how many independent "worlds" this sketch holds;
 *   H1 · cycles / loops        — E − V + C, the redundancy count (rings of influence);
 *   critical · bridges & cut vertices — links/nodes whose removal splits the graph;
 *   centrality · betweenness + k-core — hubs vs. dense cores;
 *   clusters · spatial single-linkage — proximity groups with a persistence cut,
 *        plus a 0-dimensional persistence barcode for the merge hierarchy.
 *
 * Inputs are intentionally primitive (id/label/type/x/y + id/source/target/
 * label/type/weight) so the engine stays decoupled from the API DTOs.
 */

export interface TdaNode {
  id: string
  label: string
  type: string
  x: number
  y: number
}

export interface TdaEdge {
  id: string
  source: string
  target: string
  label: string
  type?: string | null
  weight?: number | null
}

export interface ComponentInfo {
  id: number
  size: number
  edgeCount: number
  isTree: boolean
  loopCount: number // H1 within this component = E_c − V_c + 1
  nodeIds: string[]
}

export interface CycleInfo {
  id: number
  componentId: number
  nodeIds: string[]
  length: number
  /** true — цикл является границей заполненных симплексов (не дыра). */
  filled: boolean
}

export interface TriangleInfo {
  id: number
  componentId: number
  nodeIds: string[] // ordered triple, a < b < c
  labels: string[] // matching vertex labels
}

export interface BridgeInfo {
  edgeId: string
  source: string
  target: string
  label: string
  fromLabel: string
  toLabel: string
}

export interface CutVertexInfo {
  nodeId: string
  label: string
  splitComponents: number // how many pieces removing it creates (0 = none)
}

export interface NodeMetric {
  nodeId: string
  label: string
  type: string
  degree: number
  inDegree: number
  outDegree: number
  betweenness: number
  kCore: number
  componentId: number
}

export interface ClusterInfo {
  id: number
  nodeIds: string[]
  size: number
  representative: string
  componentId: number
}

export interface PersistenceBar {
  birth: number
  death: number | null // null → never dies (the last surviving component)
  size: number // nodes in this cluster after the cut
}

export interface TdaResult {
  nodeCount: number
  edgeCount: number
  avgDegree: number
  h0: number // β0 активного комплекса
  h1: number // β1 активного комплекса
  diameterComponents: number // components with more than one node
  components: ComponentInfo[]
  cycles: CycleInfo[]
  triangles: TriangleInfo[]
  bridges: BridgeInfo[]
  cutVertices: CutVertexInfo[]
  metrics: NodeMetric[]
  clusters: ClusterInfo[]
  bars: PersistenceBar[]
  /** Построенный комплекс и его честные группы гомологий. */
  mode: ComplexMode
  betti0: number
  betti1: number
  betti1Exact: boolean // false — перечисление треугольников упёрлось в бюджет
  complexVertices: number
  complexEdgeCount: number
  complexEdges: ComplexEdge[]
  triangleCount: number
  maxDim: number
  truncated: boolean
  simplicesMax: MaximalSimplex[]
  witnessIds: string[]
  hubCount: number
  coveredCount: number
  /** Весовой баркод: как топология графа меняется при повышении порога веса. */
  weightFiltration: WeightBar[]
}

export type ComplexMode = 'flag' | 'dowker'

export interface TdaOptions {
  mode?: ComplexMode
  /** Типы узлов-свидетелей (dowker): их окрестности порождают симплексы. */
  hubTypes?: string[]
  /** Минимальный размер группы |N(hub)|, образующей симплекс. */
  minGroup?: number
  /**
   * Минимальный вес ребра. Рёбра с weight < minWeight (null трактуется как
   * вес 1, то есть всегда проходит) исключаются из комплекса. Позволяет
   * строить взвешенные симплициальные комплексы: слабые/малодостоверные
   * связи (например, Pastebin, вес 0.3) отсекаются, и топология графа
   * «проявляется» по мере роста порога уверенности.
   */
  minWeight?: number
}

/** Столбец весового баркода: топология графа на пороге уверенности `threshold`. */
export interface WeightBar {
  threshold: number
  /** β0 — число связных компонент на этом пороге. */
  betti0: number
  /** Цикломатическое число (незаполненные циклы, H1 1-скелета) на этом пороге. */
  cycleRank: number
}

export interface MaximalSimplex {
  id: number
  hubId: string
  hubLabel: string
  nodeIds: string[]
  labels: string[]
  size: number
}

export interface ComplexEdge {
  source: string
  target: string
}

/* ── helpers ──────────────────────────────────────────────────────────── */

class UnionFind {
  parent: number[]
  rank: number[]

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.rank = new Array(n).fill(0)
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]
      x = this.parent[x]
    }
    return x
  }

  union(a: number, b: number) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra
    else {
      this.parent[rb] = ra
      this.rank[ra]++
    }
  }
}

function nodeKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/* Brandes betweenness centrality (unweighted). O(V · E). */
function betweenness(adj: number[][], n: number): number[] {
  const b = new Array(n).fill(0)
  for (let s = 0; s < n; s++) {
    const stack: number[] = []
    const preds: number[][] = Array.from({ length: n }, () => [])
    const sigma = new Array(n).fill(0)
    const dist = new Array(n).fill(-1)
    sigma[s] = 1
    dist[s] = 0
    const queue = [s]
    let qi = 0
    while (qi < queue.length) {
      const v = queue[qi++]
      stack.push(v)
      for (const w of adj[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1
          queue.push(w)
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v]
          preds[w].push(v)
        }
      }
    }
    const delta = new Array(n).fill(0)
    while (stack.length) {
      const w = stack.pop()!
      for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      if (w !== s) b[w] += delta[w]
    }
  }
  return b
}

/* k-core decomposition via repeated peeling of the min-degree vertex. */
function kCoreValues(adj: number[][], n: number): number[] {
  const deg = adj.map((a) => a.length)
  const core = new Array(n).fill(0)
  const active = new Array(n).fill(true)
  let remaining = n
  while (remaining > 0) {
    let minD = Infinity
    let u = -1
    for (let i = 0; i < n; i++) {
      if (active[i] && deg[i] < minD) {
        minD = deg[i]
        u = i
      }
    }
    if (u === -1) break
    core[u] = minD
    active[u] = false
    remaining--
    for (const w of adj[u]) if (active[w]) deg[w]--
  }
  return core
}

/* Prim minimum spanning tree over the dense spatial distance matrix. */
function primMst(nodes: TdaNode[]): { a: number; b: number; dist: number }[] {
  const n = nodes.length
  const dist = new Array(n).fill(Infinity)
  const inTree = new Array(n).fill(false)
  const parent = new Array(n).fill(-1)
  const edges: { a: number; b: number; dist: number }[] = []
  dist[0] = 0
  for (let it = 0; it < n; it++) {
    let u = -1
    let best = Infinity
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && dist[i] < best) {
        best = dist[i]
        u = i
      }
    }
    if (u === -1) break
    inTree[u] = true
    if (parent[u] !== -1) edges.push({ a: parent[u], b: u, dist: dist[u] })
    for (let w = 0; w < n; w++) {
      if (inTree[w]) continue
      const d = Math.hypot(nodes[u].x - nodes[w].x, nodes[u].y - nodes[w].y)
      if (d < dist[w]) {
        dist[w] = d
        parent[w] = u
      }
    }
  }
  return edges
}

/* ── main entry ──────────────────────────────────────────────────────── */

export function analyzeTda(nodes: TdaNode[], edges: TdaEdge[], options: TdaOptions = {}): TdaResult {
  const n = nodes.length
  const empty: TdaResult = {
    nodeCount: n,
    edgeCount: 0,
    avgDegree: 0,
    h0: Math.max(n, 0),
    h1: 0,
    diameterComponents: 0,
    components: [],
    cycles: [],
    triangles: [],
    bridges: [],
    cutVertices: [],
    metrics: [],
    clusters: [],
    bars: [],
    mode: options.mode ?? 'flag',
    betti0: Math.max(n, 0),
    betti1: 0,
    betti1Exact: true,
    complexVertices: Math.max(n, 0),
    complexEdgeCount: 0,
    complexEdges: [],
    triangleCount: 0,
    maxDim: 0,
    truncated: false,
    simplicesMax: [],
    witnessIds: [],
    hubCount: 0,
    coveredCount: Math.max(n, 0),
    weightFiltration: [],
  }
  if (n === 0) return empty

  const idx = new Map<string, number>()
  nodes.forEach((nd, i) => idx.set(nd.id, i))

  const adj: number[][] = Array.from({ length: n }, () => [])
  const seen = new Set<string>()
  const undirected: { a: number; b: number; e: TdaEdge }[] = []
  const minW = options.minWeight
  for (const e of edges) {
    const a = idx.get(e.source)
    const b = idx.get(e.target)
    if (a === undefined || b === undefined) continue
    // Взвешенный комплекс: отсекаем рёбра легче порога (null ⇒ вес 1, всегда проходит).
    if (minW != null && (e.weight ?? 1) < minW) continue
    const key = nodeKey(a, b)
    if (seen.has(key)) continue
    seen.add(key)
    undirected.push({ a, b, e })
    adj[a].push(b)
    adj[b].push(a)
  }
  const m = undirected.length

  // ── connected components (H0) ─────────────────────────────────────
  const uf = new UnionFind(n)
  for (const { a, b } of undirected) uf.union(a, b)
  const compGroups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = uf.find(i)
    const g = compGroups.get(r) || []
    g.push(i)
    compGroups.set(r, g)
  }
  const compEdgeCount = new Map<number, number>()
  for (const { a, b } of undirected) {
    const r = uf.find(a)
    compEdgeCount.set(r, (compEdgeCount.get(r) || 0) + 1)
  }

  const compOfNode = new Array<number>(n).fill(-1)
  const components: ComponentInfo[] = []
  let cid = 0
  for (const [root, g] of compGroups) {
    const ec = compEdgeCount.get(root) || 0
    const loopCount = ec - g.length + 1
    components.push({
      id: cid,
      size: g.length,
      edgeCount: ec,
      isTree: loopCount <= 0,
      loopCount: Math.max(0, loopCount),
      nodeIds: g.map((i) => nodes[i].id),
    })
    for (const i of g) compOfNode[i] = cid
    cid++
  }

  // ── Tarjan: bridges + articulation points + spanning forest ───────
  const disc = new Array(n).fill(-1)
  const low = new Array(n).fill(0)
  const parent = new Array(n).fill(-1)
  const childCnt = new Array(n).fill(0)
  const isVertex = new Array(n).fill(false)
  const treeKeys = new Set<string>()
  const bridgeKeys = new Set<string>()
  let t = 0

  const dfs = (u: number, par: number) => {
    disc[u] = low[u] = t++
    for (const w of adj[u]) {
      if (w === par) continue
      if (disc[w] === -1) {
        parent[w] = u
        childCnt[u]++
        treeKeys.add(nodeKey(u, w))
        dfs(w, u)
        low[u] = Math.min(low[u], low[w])
        if (low[w] >= disc[u]) isVertex[u] = true
        if (low[w] > disc[u]) bridgeKeys.add(nodeKey(u, w))
      } else {
        low[u] = Math.min(low[u], disc[w])
      }
    }
  }
  for (let i = 0; i < n; i++) if (disc[i] === -1) dfs(i, -1)

  // root correction: a DFS root is an articulation point iff it has > 1 child
  for (let u = 0; u < n; u++) {
    if (parent[u] === -1 && childCnt[u] <= 1) isVertex[u] = false
  }

  const bridges: BridgeInfo[] = []
  for (const { a, b, e } of undirected) {
    if (bridgeKeys.has(nodeKey(a, b))) {
      bridges.push({
        edgeId: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        fromLabel: nodes[a].label,
        toLabel: nodes[b].label,
      })
    }
  }

  // articulation points → estimated split count
  const cutVertices: CutVertexInfo[] = []
  for (let u = 0; u < n; u++) {
    if (!isVertex[u]) continue
    let pieces = 0
    if (parent[u] === -1) {
      pieces = childCnt[u]
    } else {
      pieces = 1 // the parent-side subtree(s)
      for (const w of adj[u]) if (parent[w] === u && low[w] >= disc[u]) pieces++
    }
    cutVertices.push({
      nodeId: nodes[u].id,
      label: nodes[u].label,
      splitComponents: pieces,
    })
  }
  // ── simplicial complex construction (mode-aware) ──────────────────
  // flag   — clique/flag complex of the undirected graph: a simplex is a set
  //          of pairwise adjacent vertices.
  // dowker — complex of the relation "x is attached to hub y" (Dowker 1952):
  //          maximal simplices are the hub neighbourhoods N(y) restricted to
  //          non-hub vertices; hubs are witnesses, not complex vertices.
  const mode: ComplexMode = options.mode ?? 'flag'
  const minGroup = Math.max(2, Math.floor(options.minGroup ?? 2))
  const hubTypeSet = new Set((options.hubTypes ?? []).map((t) => t.toLowerCase()))
  const isHub = new Set<number>()
  if (mode === 'dowker') {
    nodes.forEach((nd, i) => {
      if (hubTypeSet.has(nd.type.toLowerCase())) isHub.add(i)
    })
  }

  const MAX_COMPLEX_EDGES = 40_000
  const MAX_TRI_COLUMNS = 60_000
  const MAX_OUTPUT_TRIANGLES = 4_000
  const MAX_OUTPUT_EDGES = 6_000
  let edgeTruncated = false
  let triTruncated = false

  // Dowker: maximal simplices from hub neighbourhoods + co-occurrence pairs
  const simplicesMax: MaximalSimplex[] = []
  const witnessIds: string[] = []
  const coEdgeKeys = new Set<string>()
  if (mode === 'dowker') {
    for (const y of isHub) {
      const members = adj[y].filter((w) => !isHub.has(w))
      if (members.length < minGroup) continue
      simplicesMax.push({
        id: 0,
        hubId: nodes[y].id,
        hubLabel: nodes[y].label,
        nodeIds: members.map((i) => nodes[i].id),
        labels: members.map((i) => nodes[i].label),
        size: members.length,
      })
      witnessIds.push(nodes[y].id)
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          if (coEdgeKeys.size >= MAX_COMPLEX_EDGES) {
            edgeTruncated = true
            break
          }
          coEdgeKeys.add(nodeKey(members[i], members[j]))
        }
        if (edgeTruncated) break
      }
    }
    simplicesMax.sort((p, q) => q.size - p.size)
    simplicesMax.forEach((s, i) => { s.id = i })
  }

  // complex 1-skeleton
  const complexEdges: ComplexEdge[] = []
  const edgeIndex = new Map<string, number>()
  let cAdj: number[][]
  if (mode === 'flag') {
    cAdj = adj
    for (const { a, b } of undirected) {
      edgeIndex.set(nodeKey(a, b), complexEdges.length)
      complexEdges.push({ source: nodes[a].id, target: nodes[b].id })
    }
  } else {
    cAdj = Array.from({ length: n }, () => [])
    for (const key of coEdgeKeys) {
      const [a, b] = key.split('|').map(Number)
      edgeIndex.set(key, complexEdges.length)
      complexEdges.push({ source: nodes[a].id, target: nodes[b].id })
      cAdj[a].push(b)
      cAdj[b].push(a)
    }
  }

  // β0 — connected components of the complex 1-skeleton
  const isComplexVertex = (i: number) => mode === 'flag' || !isHub.has(i)
  const cUF = new UnionFind(n)
  for (const key of edgeIndex.keys()) {
    const [a, b] = key.split('|').map(Number)
    cUF.union(a, b)
  }
  const cComp = new Map<number, number>()
  let vertexCount = 0
  for (let i = 0; i < n; i++) {
    if (!isComplexVertex(i)) continue
    vertexCount++
    const r = cUF.find(i)
    if (!cComp.has(r)) cComp.set(r, cComp.size)
  }
  const betti0 = cComp.size

  // 2-simplices: flag — graph 3-cliques; dowker — triples sharing a witness
  const triangles: TriangleInfo[] = []
  let triangleCount = 0
  const triColumns: number[][] = []
  const recordTriangle = (p: number, q: number, r: number, componentId: number) => {
    triangleCount++
    if (triColumns.length >= MAX_TRI_COLUMNS) {
      triTruncated = true
      return
    }
    const e1 = edgeIndex.get(nodeKey(p, q))
    const e2 = edgeIndex.get(nodeKey(p, r))
    const e3 = edgeIndex.get(nodeKey(q, r))
    if (e1 === undefined || e2 === undefined || e3 === undefined) return
    triColumns.push([e1, e2, e3])
    if (triangles.length < MAX_OUTPUT_TRIANGLES) {
      triangles.push({
        id: triangles.length,
        componentId,
        nodeIds: [p, q, r].map((i) => nodes[i].id),
        labels: [p, q, r].map((i) => nodes[i].label),
      })
    }
  }
  if (mode === 'flag') {
    const nbSet = adj.map((a) => new Set(a))
    const triSeen = new Set<string>()
    for (const { a, b } of undirected) {
      for (const w of nbSet[a]) {
        if (w === b || !nbSet[b].has(w)) continue
        const ord = [a, b, w].sort((p, q) => p - q)
        const key = nodeKey(ord[0], ord[1]) + '|' + ord[2]
        if (triSeen.has(key)) continue
        triSeen.add(key)
        recordTriangle(ord[0], ord[1], ord[2], compOfNode[a])
      }
    }
  } else {
    for (const s of simplicesMax) {
      if (s.size < 3) continue
      const mem = s.nodeIds
        .map((id) => idx.get(id))
        .filter((v): v is number => v !== undefined)
        .sort((p, q) => p - q)
      const compId = cComp.get(cUF.find(mem[0])) ?? -1
      for (let i = 0; i < mem.length; i++)
        for (let j = i + 1; j < mem.length; j++)
          for (let k = j + 1; k < mem.length; k++)
            recordTriangle(mem[i], mem[j], mem[k], compId)
    }
  }

  // rank(im ∂2) via Z2 column reduction (lowest-row pivot)
  const pivots = new Map<number, number[]>()
  const xorSorted = (a: number[], b: number[]): number[] => {
    const out: number[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++ }
      else if (a[i] < b[j]) out.push(a[i++])
      else out.push(b[j++])
    }
    while (i < a.length) out.push(a[i++])
    while (j < b.length) out.push(b[j++])
    return out
  }
  for (const col of triColumns) {
    let cur = col.slice().sort((x, y) => x - y)
    while (cur.length) {
      const low = cur[cur.length - 1]
      const p = pivots.get(low)
      if (!p) {
        pivots.set(low, cur)
        break
      }
      cur = xorSorted(cur, p)
    }
  }
  const rank2 = pivots.size

  // fundamental cycles of the complex 1-skeleton + filled/holes split
  const cParent = new Array(n).fill(-1)
  const cTree = new Set<string>()
  const cDisc = new Array(n).fill(-1)
  let ct = 0
  const cdfs = (u: number, par: number) => {
    cDisc[u] = ct++
    for (const w of cAdj[u]) {
      if (w === par) continue
      if (cDisc[w] === -1) {
        cParent[w] = u
        cTree.add(nodeKey(u, w))
        cdfs(w, u)
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!isComplexVertex(i) || cDisc[i] !== -1) continue
    cdfs(i, -1)
  }
  const inSpan = (col: number[]): boolean => {
    let cur = col.slice().sort((x, y) => x - y)
    while (cur.length) {
      const p = pivots.get(cur[cur.length - 1])
      if (!p) return false
      cur = xorSorted(cur, p)
    }
    return true
  }
  const cycles: CycleInfo[] = []
  let cycleId = 0
  for (const key of edgeIndex.keys()) {
    const [a, b] = key.split('|').map(Number)
    if (cTree.has(key)) continue
    const ancA = new Set<number>()
    let x = a
    ancA.add(a)
    while (cParent[x] !== -1) {
      x = cParent[x]
      ancA.add(x)
    }
    let meet = b
    while (cParent[meet] !== -1 && !ancA.has(meet)) meet = cParent[meet]
    const chainA: number[] = []
    x = a
    while (true) {
      chainA.push(x)
      if (x === meet) break
      x = cParent[x]
      if (x === -1) break
    }
    const chainB: number[] = []
    let yb = b
    while (yb !== meet) {
      chainB.push(yb)
      yb = cParent[yb]
    }
    const chain = chainA.concat(chainB.reverse())
    const col: number[] = []
    for (let i = 0; i + 1 < chain.length; i++) {
      const ei = edgeIndex.get(nodeKey(chain[i], chain[i + 1]))
      if (ei !== undefined) col.push(ei)
    }
    const closing = edgeIndex.get(key)
    if (closing !== undefined) col.push(closing)
    cycles.push({
      id: cycleId++,
      componentId: mode === 'flag' ? compOfNode[a] : (cComp.get(cUF.find(a)) ?? -1),
      nodeIds: chain.map((i) => nodes[i].id),
      length: chain.length,
      filled: inSpan(col),
    })
  }

  // β1 = цикловой ранг 1-скелета − ранг заполненных треугольников
  const cycleRank = complexEdges.length - vertexCount + betti0
  const betti1 = Math.max(0, cycleRank - rank2)
  const betti1Exact = !triTruncated

  let maxDim = complexEdges.length ? 1 : 0
  if (mode === 'dowker') {
    for (const s of simplicesMax) maxDim = Math.max(maxDim, s.size - 1)
  } else if (triangleCount > 0) {
    maxDim = 2
  }

  let coveredCount = vertexCount
  if (mode === 'dowker') {
    const cov = new Set<number>()
    for (const s of simplicesMax) {
      for (const id of s.nodeIds) {
        const i = idx.get(id)
        if (i !== undefined) cov.add(i)
      }
    }
    coveredCount = cov.size
  }

  // ── node metrics: degree / betweenness / k-core ───────────────────
  const betw = betweenness(adj, n)
  const cores = kCoreValues(adj, n)
  const inDegree = new Array(n).fill(0)
  for (const e of edges) {
    const b = idx.get(e.target)
    if (b !== undefined) inDegree[b]++
  }
  const metrics: NodeMetric[] = nodes.map((nd, i) => ({
    nodeId: nd.id,
    label: nd.label,
    type: nd.type,
    degree: adj[i].length,
    inDegree: inDegree[i],
    outDegree: Math.max(0, adj[i].length - inDegree[i]),
    betweenness: betw[i],
    kCore: cores[i],
    componentId: compOfNode[i],
  }))

  // ── spatial single-linkage clustering + 0D persistence ────────────
  let clusters: ClusterInfo[] = []
  let bars: PersistenceBar[] = []
  if (n > 1) {
    const mst = primMst(nodes).sort((p, q) => p.dist - q.dist)

    // Natural cut: the largest gap between consecutive merge distances.
    let cutDist = 0
    for (let i = 1; i < mst.length; i++) {
      const gap = mst[i].dist - mst[i - 1].dist
      if (gap > cutDist) cutDist = gap
    }
    const threshold = mst.length
      ? mst[0].dist + cutDist
      : 0

    // Clusters = connected pieces of the spatial MST with merges above threshold removed.
    const cutUF = new UnionFind(n)
    for (const e of mst) if (e.dist <= threshold) cutUF.union(e.a, e.b)
    const clGroups = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const r = cutUF.find(i)
      const g = clGroups.get(r) || []
      g.push(i)
      clGroups.set(r, g)
    }
    clusters = Array.from(clGroups.values())
      .map((g, i) => ({
        id: i,
        nodeIds: g.map((v) => nodes[v].id),
        size: g.length,
        representative: nodes[g[0]].label,
        componentId: compOfNode[g[0]],
      }))
      .sort((a, b) => b.size - a.size)

    // Barcode: one bar per cluster; persistence = in-cluster max merge distance.
    clusters.forEach((c) => {
      const set = new Set(c.nodeIds)
      let death = 0
      for (const e of mst) if (set.has(nodes[e.a].id) && set.has(nodes[e.b].id)) death = Math.max(death, e.dist)
      bars.push({
        birth: 0,
        death: c.size === n ? null : death,
        size: c.size,
      })
    })
    bars = bars.sort((p, q) => (q.death ?? Infinity) - (p.death ?? Infinity))
  } else if (n === 1) {
    clusters = [{ id: 0, nodeIds: [nodes[0].id], size: 1, representative: nodes[0].label, componentId: 0 }]
    bars = [{ birth: 0, death: null, size: 1 }]
  }

  return {
    nodeCount: n,
    edgeCount: m,
    avgDegree: n ? (2 * m) / n : 0,
    h0: betti0,
    h1: betti1,
    diameterComponents: components.filter((c) => c.size > 1).length,
    components,
    cycles,
    triangles,
    bridges,
    cutVertices,
    metrics,
    clusters,
    bars,
    mode,
    betti0,
    betti1,
    betti1Exact,
    complexVertices: vertexCount,
    complexEdgeCount: complexEdges.length,
    complexEdges: complexEdges.slice(0, MAX_OUTPUT_EDGES),
    triangleCount,
    maxDim,
    truncated: edgeTruncated || triTruncated,
    simplicesMax,
    witnessIds,
    hubCount: witnessIds.length,
    coveredCount,
    weightFiltration: weightFiltration(nodes, edges),
  }
}

/**
 * Auto-suggest Dowker witness types: node types (excluding the most populous
 * one — usually the "subject" type like person) whose members carry enough
 * links to act as hubs. Falls back to the single best-connected non-modal
 * type; empty when the graph has no such type.
 */
export function suggestHubTypes(nodes: TdaNode[], edges: TdaEdge[]): string[] {
  const n = nodes.length
  if (n === 0) return []
  const idx = new Map<string, number>()
  nodes.forEach((nd, i) => idx.set(nd.id, i))
  const deg = new Array(n).fill(0)
  const seen = new Set<string>()
  for (const e of edges) {
    const a = idx.get(e.source)
    const b = idx.get(e.target)
    if (a === undefined || b === undefined) continue
    const key = nodeKey(a, b)
    if (seen.has(key)) continue
    seen.add(key)
    deg[a]++
    deg[b]++
  }
  const byType = new Map<string, { count: number; degSum: number }>()
  nodes.forEach((nd, i) => {
    const t = nd.type.toLowerCase()
    const rec = byType.get(t) ?? { count: 0, degSum: 0 }
    rec.count++
    rec.degSum += deg[i]
    byType.set(t, rec)
  })
  let modalType = ''
  let modalCount = -1
  for (const [t, rec] of byType) {
    if (rec.count > modalCount) {
      modalCount = rec.count
      modalType = t
    }
  }
  const cands: { t: string; avg: number }[] = []
  for (const [t, rec] of byType) {
    if (t === modalType) continue
    cands.push({ t, avg: rec.degSum / rec.count })
  }
  cands.sort((p, q) => q.avg - p.avg)
  const picked = cands.filter((c) => c.avg >= 3).map((c) => c.t)
  if (picked.length) return picked
  return cands.length ? [cands[0].t] : []
}

/* Весовой баркод: как топология графа (β0 и цикломатическое число H1 1-скелета)
 * меняется при повышении порога уверенности. Каждый порог отсекает рёбра легче
 * него — так «проявляются» устойчивые структуры (например, координированная
 * личность TheBigBrother), которые при полном графе тонут в шуме слабых связей. */
export function weightFiltration(nodes: TdaNode[], edges: TdaEdge[]): WeightBar[] {
  const weights = new Set<number>()
  for (const e of edges) weights.add(e.weight ?? 1)
  const sorted = Array.from(weights).sort((a, b) => a - b)
  const idx = new Map<string, number>()
  nodes.forEach((nd, i) => idx.set(nd.id, i))
  return sorted.map((tw) => {
    const uf = new UnionFind(nodes.length)
    let kept = 0
    for (const e of edges) {
      const w = e.weight ?? 1
      if (w < tw) continue
      const a = idx.get(e.source)
      const b = idx.get(e.target)
      if (a === undefined || b === undefined) continue
      uf.union(a, b)
      kept++
    }
    const comps = new Set<number>()
    for (let i = 0; i < nodes.length; i++) comps.add(uf.find(i))
    const betti0 = comps.size
    const cycleRank = Math.max(0, kept - nodes.length + betti0)
    return { threshold: tw, betti0, cycleRank }
  })
}

/* Small palette for clusters / components, cyan-first to match the app accent. */
export const PALETTE = [
  '#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#a78bfa',
  '#fb7185', '#34d399', '#60a5fa', '#f97316', '#e879f9',
  '#4ade80', '#facc15', '#38bdf8', '#fb923c', '#2dd4bf',
]

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}