// platform/src/services/shared/types/index.ts
// Shared Type Definitions for OSINT Microservices Architecture
// This file contains standardized types used across all microservices

// ============================================================================
// CORE TYPES - STIX/TAXII Compliant
// ============================================================================

/**
 * STIX 2.1 Compliant Entity Types
 * Standardized OSINT entity types based on STIX/TAXII and OpenCTI
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
// GRAPH DATA STRUCTURES
// ============================================================================

/**
 * Standardized Graph Node - STIX Compliant
 * All properties are optional to maintain backward compatibility
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
 * Standardized Graph Edge - STIX Compliant
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
 * Graph Data Structure
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
// API CONTRACTS
// ============================================================================

/**
 * Standard API Response Wrapper
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
 * Standard API Error
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Pagination Parameters
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
 * Paginated Response
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
// EVENT BUS TYPES
// ============================================================================

/**
 * Event Types for Redis Pub/Sub
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
 * Event Message Structure
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
 * Graph Event Data
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
// PIPELINE TYPES
// ============================================================================

/**
 * Pipeline Task Types
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
 * Pipeline Status
 */
export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

/**
 * Pipeline Tool Configuration
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
 * Pipeline Run Configuration
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
 * Pipeline Result
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
// TDA (Topological Data Analysis) TYPES
// ============================================================================

/**
 * TDA Analysis Mode
 */
export type TdaAnalysisMode =
  | 'flag'      // Flag complex (clique complex)
  | 'dowker'    // Dowker complex
  | 'rips'      // Rips complex
  | 'cech'      // Cech complex
  | 'mapper'    // Mapper algorithm
  | 'persistent-homology';

/**
 * TDA Analysis Parameters
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
 * TDA Analysis Result
 */
export interface TdaAnalysisResult {
  // Basic stats
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  
  // Homology groups
  h0: number; // Betti number 0 (connected components)
  h1: number; // Betti number 1 (cycles)
  h2?: number; // Betti number 2 (voids)
  h3?: number; // Betti number 3 (higher-dimensional holes)
  
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
 * TDA Component Information
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
 * TDA Cycle Information
 */
export interface TdaCycle {
  id: number;
  componentId: number;
  nodeIds: string[];
  length: number;
  filled: boolean;
}

/**
 * TDA Triangle Information
 */
export interface TdaTriangle {
  id: number;
  componentId: number;
  nodeIds: string[];
  labels: string[];
}

/**
 * TDA Bridge Information
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
 * TDA Cut Vertex Information
 */
export interface TdaCutVertex {
  nodeId: string;
  label: string;
  splitComponents: number;
}

/**
 * TDA Node Metrics
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
 * TDA Cluster Information
 */
export interface TdaCluster {
  id: number;
  nodeIds: string[];
  size: number;
  representative: string;
  componentId: number;
}

/**
 * TDA Persistence Bar
 */
export interface TdaPersistenceBar {
  birth: number;
  death: number | null;
  size: number;
}

/**
 * TDA Complex Edge
 */
export interface TdaComplexEdge {
  source: string;
  target: string;
}

/**
 * TDA Maximal Simplex
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
 * TDA Weight Bar
 */
export interface TdaWeightBar {
  threshold: number;
  betti0: number;
  cycleRank: number;
}

// ============================================================================
// ENRICHMENT TYPES
// ============================================================================

/**
 * Enrichment Category
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
 * Enricher Interface
 * Plugin system interface for custom enrichers
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
 * Enrichment Input
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
 * Enrichment Output
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
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Health Check Result
 */
export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Enrichment Chain Definition
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
// COLLABORATION TYPES
// ============================================================================

/**
 * User Role
 */
export type UserRole =
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'guest';

/**
 * Permission Level
 */
export type PermissionLevel =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin';

/**
 * Access Control Entry
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
 * Graph Version
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
 * Graph Comment
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
 * Graph Annotation
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
// CACHE TYPES
// ============================================================================

/**
 * Cache Entry
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
 * Cache Strategy
 */
export type CacheStrategy =
  | 'none'
  | 'memory'
  | 'localStorage'
  | 'redis'
  | 'hybrid';

/**
 * Cache Configuration
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
// ERROR TYPES
// ============================================================================

/**
 * Detailed Error with Context
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
// UTILITY TYPES
// ============================================================================

/**
 * Result Type for Operations
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Maybe Type (Optional with null)
 */
export type Maybe<T> = T | null | undefined;

/**
 * Deep Partial Type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Require At Least One Property
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Deep Readonly Type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// ============================================================================
// EXPORT ALL TYPES
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
