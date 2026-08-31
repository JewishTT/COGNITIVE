// platform/src/services/shared/types/index.ts
// [38;5;240mShared Type Definitions for OSINT Microservices Architecture[0m
// [38;5;240mThis file contains standardized types used across all microservices[0m

// ============================================================================
// [38;5;220mCORE TYPES - STIX/TAXII Compliant[0m
// ============================================================================

/**
 * STIX 2.1 Compliant Entity Types
 * [38;5;240mStandardized OSINT entity types based on STIX/TAXII and OpenCTI[0m
 */
export type StixEntityType =
  | 'attack-pattern'
  | 'campaign'
  | 'course-of-action'
  | 'identity'
  | 'indicator'
  | 'intrusion-set'
  | 'location'
  | 'malware'
  | 'observed-data'
  | 'report'
  | 'threat-actor'
  | 'tool'
  | 'vulnerability'
  | 'x-custom-entity';

/**
 * STIX 2.1 Compliant Relationship Types
 */
export type StixRelationshipType =
  | 'related-to'
  | 'uses'
  | 'targets'
  | 'indicates'
  | 'attributed-to'
  | 'belongs-to'
  | 'part-of'
  | 'has'
  | 'located-at'
  | 'owns'
  | 'mitigates'
  | 'x-custom-relationship';

// ============================================================================
// [38;5;220mGRAPH DATA STRUCTURES[0m
// ============================================================================

/**
 * [38;5;220mStandardized Graph Node - STIX Compliant[0m
 * [38;5;240mAll properties are optional to maintain backward compatibility[0m
 */
export interface StandardGraphNode {
  id: string;
  // STIX Properties
  stixId?: string;
  stixType?: StixEntityType;
  name?: string;
  description?: string;
  created?: string; // ISO 8601
  modified?: string; // ISO 8601
  
  // Visual Properties
  x?: number;
  y?: number;
  color?: string;
  icon?: string;
  size?: number;
  shape?: string;
  
  // Metadata
  confidence?: number; // 0-100
  reliability?: number; // 0-100
  tags?: string[];
  source?: string;
  sourceUri?: string;
  
  // Custom Properties (for backward compatibility)
  nodeLabel?: string;
  nodeType?: string;
  nodeColor?: string | null;
  nodeIcon?: string | null;
  nodeImage?: string | null;
  nodeFlag?: string | null;
  nodeShape?: string | null;
  nodeSize?: number | null;
  nodeProperties?: Record<string, unknown>;
  nodeMetadata?: Record<string, unknown>;
}

/**
 * [38;5;220mStandardized Graph Edge - STIX Compliant[0m
 */
export interface StandardGraphEdge {
  id: string;
  source: string;
  target: string;
  
  // STIX Properties
  stixId?: string;
  stixType?: StixRelationshipType;
  relationshipType?: StixRelationshipType;
  created?: string; // ISO 8601
  modified?: string; // ISO 8601
  
  // Visual Properties
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  
  // Metadata
  label?: string;
  description?: string;
  confidence?: number; // 0-100
  reliability?: number; // 0-100
  date?: string;
  caption?: string | null;
  type?: string | null;
  weight?: number | null;
  confidence_level?: number | string | null;
  
  // STIX Specific
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

/**
 * [38;5;220mGraph Data Structure[0m
 */
export interface StandardGraphData {
  nodes: StandardGraphNode[];
  edges: StandardGraphEdge[];
  metadata?: {
    version: string;
    timestamp: string;
    source: string;
    schema: string;
  };
}

// ============================================================================
// [38;5;220mAPI CONTRACTS[0m
// ============================================================================

/**
 * [38;5;220mStandard API Response Wrapper[0m
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  warnings?: string[];
  timestamp: string;
  requestId: string;
}

/**
 * [38;5;220mStandard API Error[0m
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * [38;5;220mPagination Parameters[0m
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

/**
 * [38;5;220mPaginated Response[0m
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// [38;5;220mEVENT BUS TYPES[0m
// ============================================================================

/**
 * [38;5;220mEvent Types for Redis Pub/Sub[0m
 */
export type EventType =
  | 'graph:created'
  | 'graph:updated'
  | 'graph:deleted'
  | 'node:created'
  | 'node:updated'
  | 'node:deleted'
  | 'edge:created'
  | 'edge:updated'
  | 'edge:deleted'
  | 'analysis:started'
  | 'analysis:completed'
  | 'analysis:failed'
  | 'enrichment:started'
  | 'enrichment:completed'
  | 'pipeline:started'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'tda:analysis-started'
  | 'tda:analysis-completed';

/**
 * [38;5;220mEvent Message Structure[0m
 */
export interface EventMessage<T = unknown> {
  eventType: EventType;
  timestamp: string;
  data: T;
  metadata?: {
    service: string;
    version: string;
    correlationId?: string;
  };
}

/**
 * [38;5;220mGraph Event Data[0m
 */
export interface GraphEventData {
  graphId?: string;
  sketchId?: string;
  nodeIds?: string[];
  edgeIds?: string[];
  changes?: {
    addedNodes?: string[];
    updatedNodes?: string[];
    deletedNodes?: string[];
    addedEdges?: string[];
    updatedEdges?: string[];
    deletedEdges?: string[];
  };
  triggeredBy?: string;
}

// ============================================================================
// [38;5;220mPIPELINE TYPES[0m
// ============================================================================

/**
 * [38;5;220mPipeline Task Types[0m
 */
export type PipelineTaskType =
  | 'domain'
  | 'ip'
  | 'email'
  | 'username'
  | 'phone'
  | 'company'
  | 'cryptowallet'
  | 'url'
  | 'hash'
  | 'custom';

/**
 * [38;5;220mPipeline Status[0m
 */
export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

/**
 * [38;5;220mPipeline Tool Configuration[0m
 */
export interface PipelineToolConfig {
  name: string;
  label: string;
  description: string;
  version: string;
  category: 'collection' | 'extraction' | 'analysis' | 'enrichment';
  enabled: boolean;
  configurable: boolean;
  params?: Record<string, unknown>;
  dependencies?: string[];
  timeout?: number; // in seconds
  maxRetries?: number;
}

/**
 * [38;5;220mPipeline Run Configuration[0m
 */
export interface PipelineRunConfig {
  id: string;
  taskType: PipelineTaskType;
  target: string;
  tools?: string[];
  params?: Record<string, unknown>;
  priority?: number; // 1-10
  timeout?: number; // in seconds
}

/**
 * [38;5;220mPipeline Result[0m
 */
export interface PipelineResult {
  runId: string;
  status: PipelineStatus;
  startTime: string;
  endTime?: string;
  duration?: number; // in milliseconds
  nodesCollected?: number;
  edgesCollected?: number;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// [38;5;220mTDA (Topological Data Analysis) TYPES[0m
// ============================================================================

/**
 * [38;5;220mTDA Analysis Mode[0m
 */
export type TdaAnalysisMode =
  | 'flag'      // Flag complex (clique complex)
  | 'dowker'    // Dowker complex
  | 'rips'      // Rips complex
  | 'cech'      // [38;5;208m[0m[38;5;208m[0m[38
  | 'mapper'    // Mapper algorithm
  | 'persistent-homology';

/**
 * [38;5;220mTDA Analysis Parameters[0m
 */
export interface TdaParameters {
  mode: TdaAnalysisMode;
  maxDimension?: number; // 0, 1, 2, 3
  threshold?: number; // for Rips complex
  minGroupSize?: number;
  minWeight?: number;
  hubTypes?: string[];
}

/**
 * [38;5;220mTDA Analysis Result[0m
 */
export interface TdaAnalysisResult {
  // Basic stats
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  
  // Homology groups
  h0: number; // [38;5;220mBetti number 0 (connected components)[0m
  h1: number; // [38;5;220mBetti number 1 (cycles)[0m
  h2?: number; // [38;5;220mBetti number 2 (voids)[0m
  h3?: number; // [38;5;220mBetti number 3 (higher-dimensional holes)[0m
  
  // Components
  components: TdaComponent[];
  cycles: TdaCycle[];
  triangles: TdaTriangle[];
  
  // Critical elements
  bridges: TdaBridge[];
  cutVertices: TdaCutVertex[];
  
  // Centrality
  metrics: TdaNodeMetric[];
  
  // Clustering
  clusters: TdaCluster[];
  
  // Persistent Homology
  bars: TdaPersistenceBar[];
  
  // Simplicial Complex
  complexMode: TdaAnalysisMode;
  betti0: number;
  betti1: number;
  betti1Exact: boolean;
  complexVertices: number;
  complexEdgeCount: number;
  complexEdges: TdaComplexEdge[];
  triangleCount: number;
  maxDim: number;
  truncated: boolean;
  simplicesMax: TdaMaximalSimplex[];
  witnessIds: string[];
  hubCount: number;
  coveredCount: number;
  weightFiltration: TdaWeightBar[];
  
  // Analysis metadata
  analysisId: string;
  timestamp: string;
  duration: number; // in milliseconds
  parameters: TdaParameters;
}

/**
 * [38;5;220mTDA Component Information[0m
 */
export interface TdaComponent {
  id: number;
  size: number;
  edgeCount: number;
  isTree: boolean;
  loopCount: number;
  nodeIds: string[];
}

/**
 * [38;5;220mTDA Cycle Information[0m
 */
export interface TdaCycle {
  id: number;
  componentId: number;
  nodeIds: string[];
  length: number;
  filled: boolean;
}

/**
 * [38;5;220mTDA Triangle Information[0m
 */
export interface TdaTriangle {
  id: number;
  componentId: number;
  nodeIds: string[];
  labels: string[];
}

/**
 * [38;5;220mTDA Bridge Information[0m
 */
export interface TdaBridge {
  edgeId: string;
  source: string;
  target: string;
  label: string;
  fromLabel: string;
  toLabel: string;
}

/**
 * [38;5;220mTDA Cut Vertex Information[0m
 */
export interface TdaCutVertex {
  nodeId: string;
  label: string;
  splitComponents: number;
}

/**
 * [38;5;220mTDA Node Metrics[0m
 */
export interface TdaNodeMetric {
  nodeId: string;
  label: string;
  type: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  betweenness: number;
  kCore: number;
  componentId: number;
}

/**
 * [38;5;220mTDA Cluster Information[0m
 */
export interface TdaCluster {
  id: number;
  nodeIds: string[];
  size: number;
  representative: string;
  componentId: number;
}

/**
 * [38;5;220mTDA Persistence Bar[0m
 */
export interface TdaPersistenceBar {
  birth: number;
  death: number | null;
  size: number;
}

/**
 * [38;5;220mTDA Complex Edge[0m
 */
export interface TdaComplexEdge {
  source: string;
  target: string;
}

/**
 * [38;5;220mTDA Maximal Simplex[0m
 */
export interface TdaMaximalSimplex {
  id: number;
  hubId: string;
  hubLabel: string;
  nodeIds: string[];
  labels: string[];
  size: number;
}

/**
 * [38;5;220mTDA Weight Bar[0m
 */
export interface TdaWeightBar {
  threshold: number;
  betti0: number;
  cycleRank: number;
}

// ============================================================================
// [38;5;220mENRICHMENT TYPES[0m
// ============================================================================

/**
 * [38;5;220mEnrichment Category[0m
 */
export type EnrichmentCategory =
  | 'identity'
  | 'social'
  | 'domain'
  | 'ip'
  | 'email'
  | 'phone'
  | 'location'
  | 'financial'
  | 'threat-intelligence'
  | 'custom';

/**
 * [38;5;220mEnricher Interface[0m
 * [38;5;240mPlugin system interface for custom enrichers[0m
 */
export interface IEnricher {
  // Metadata
  name: string;
  label: string;
  description: string;
  version: string;
  author: string;
  category: EnrichmentCategory;
  icon?: string;
  
  // Configuration
  paramsSchema?: Record<string, {
    type: string;
    required: boolean;
    default?: unknown;
    description?: string;
  }>;
  
  // Execution
  execute: (input: EnrichmentInput) => Promise<EnrichmentOutput>;
  
  // Validation
  validateInput?: (input: EnrichmentInput) => Promise<ValidationResult>;
  
  // Health check
  healthCheck?: () => Promise<HealthCheckResult>;
}

/**
 * [38;5;220mEnrichment Input[0m
 */
export interface EnrichmentInput {
  query: string;
  queryType: PipelineTaskType;
  graph?: StandardGraphData;
  selectedNodes?: string[];
  params?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * [38;5;220mEnrichment Output[0m
 */
export interface EnrichmentOutput {
  success: boolean;
  nodes?: StandardGraphNode[];
  edges?: StandardGraphEdge[];
  metadata?: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
  cacheKey?: string;
  cacheTTL?: number; // in seconds
}

/**
 * [38;5;220mValidation Result[0m
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * [38;5;220mHealth Check Result[0m
 */
export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * [38;5;220mEnrichment Chain Definition[0m
 */
export interface EnrichmentChain {
  id: string;
  name: string;
  description: string;
  enrichers: {
    enricherName: string;
    params?: Record<string, unknown>;
    condition?: (input: EnrichmentInput, output?: EnrichmentOutput) => boolean;
  }[];
  executionMode: 'sequential' | 'parallel' | 'conditional';
  maxRetries?: number;
  timeout?: number; // in seconds
}

// ============================================================================
// [38;5;220mCOLLABORATION TYPES[0m
// ============================================================================

/**
 * [38;5;220mUser Role[0m
 */
export type UserRole =
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'guest';

/**
 * [38;5;220mPermission Level[0m
 */
export type PermissionLevel =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin';

/**
 * [38;5;220mAccess Control Entry[0m
 */
export interface AccessControlEntry {
  userId: string;
  userRole: UserRole;
  permissions: PermissionLevel[];
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

/**
 * [38;5;220mGraph Version[0m
 */
export interface GraphVersion {
  id: string;
  graphId: string;
  timestamp: string;
  author: string;
  message: string;
  changes: {
    addedNodes?: string[];
    updatedNodes?: string[];
    deletedNodes?: string[];
    addedEdges?: string[];
    updatedEdges?: string[];
    deletedEdges?: string[];
  };
  parentVersionId?: string;
}

/**
 * [38;5;220mGraph Comment[0m
 */
export interface GraphComment {
  id: string;
  nodeId?: string;
  edgeId?: string;
  graphId?: string;
  author: string;
  content: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

/**
 * [38;5;220mGraph Annotation[0m
 */
export interface GraphAnnotation {
  id: string;
  targetId: string;
  targetType: 'node' | 'edge' | 'graph';
  author: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
  timestamp: string;
  updatedAt?: string;
}

// ============================================================================
// [38;5;220mCACHE TYPES[0m
// ============================================================================

/**
 * [38;5;220mCache Entry[0m
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  ttl: number; // in seconds
  createdAt: string;
  expiresAt: string;
  tags?: string[];
}

/**
 * [38;5;220mCache Strategy[0m
 */
export type CacheStrategy =
  | 'none'
  | 'memory'
  | 'localStorage'
  | 'redis'
  | 'hybrid';

/**
 * [38;5;220mCache Configuration[0m
 */
export interface CacheConfig {
  strategy: CacheStrategy;
  ttl: number; // default TTL in seconds
  maxSize?: number; // max entries
  prefix?: string;
  compression?: boolean;
  encryption?: boolean;
}

// ============================================================================
// [38;5;220mERROR TYPES[0m
// ============================================================================

/**
 * [38;5;220mDetailed Error with Context[0m
 */
export interface DetailedError extends Error {
  code: string;
  type: 'validation' | 'authentication' | 'authorization' | 'not_found' | 'internal' | 'external';
  details?: Record<string, unknown>;
  context?: {
    service: string;
    method: string;
    parameters?: Record<string, unknown>;
    timestamp: string;
  };
  isRetryable?: boolean;
  retryAfter?: number; // in seconds
}

// ============================================================================
// [38;5;220mUTILITY TYPES[0m
// ============================================================================

/**
 * [38;5;220mResult Type for Operations[0m
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * [38;5;220mMaybe Type (Optional with null)[0m
 */
export type Maybe<T> = T | null | undefined;

/**
 * [38;5;220mDeep Partial Type[0m
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * [38;5;220mRequire At Least One Property[0m
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * [38;5;220mDeep Readonly Type[0m
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// ============================================================================
// [38;5;220mEXPORT ALL TYPES[0m
// ============================================================================

export {
  // Core Types
  StixEntityType,
  StixRelationshipType,
  
  // Graph Types
  StandardGraphNode,
  StandardGraphEdge,
  StandardGraphData,
  
  // API Types
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  
  // Event Types
  EventType,
  EventMessage,
  GraphEventData,
  
  // Pipeline Types
  PipelineTaskType,
  PipelineStatus,
  PipelineToolConfig,
  PipelineRunConfig,
  PipelineResult,
  
  // TDA Types
  TdaAnalysisMode,
  TdaParameters,
  TdaAnalysisResult,
  TdaComponent,
  TdaCycle,
  TdaTriangle,
  TdaBridge,
  TdaCutVertex,
  TdaNodeMetric,
  TdaCluster,
  TdaPersistenceBar,
  TdaComplexEdge,
  TdaMaximalSimplex,
  TdaWeightBar,
  
  // Enrichment Types
  EnrichmentCategory,
  IEnricher,
  EnrichmentInput,
  EnrichmentOutput,
  ValidationResult,
  HealthCheckResult,
  EnrichmentChain,
  
  // Collaboration Types
  UserRole,
  PermissionLevel,
  AccessControlEntry,
  GraphVersion,
  GraphComment,
  GraphAnnotation,
  
  // Cache Types
  CacheEntry,
  CacheStrategy,
  CacheConfig,
  
  // Error Types
  DetailedError,
  
  // Utility Types
  Result,
  Maybe,
  DeepPartial,
  RequireAtLeastOne,
  DeepReadonly,
};
