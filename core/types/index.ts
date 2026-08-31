/**
 * COGNITIVE PLATFORM - UNIFIED TYPES SYSTEM
 * ============================================
 * 
 * [38;5;240mSingle Source of Truth for All Types[0m
 * 
 * Features:
 * - STIX/TAXII 2.1 compliant types
 * - Graph types (Neo4j compatible)
 * - TDA types (Topological Data Analysis)
 * - Pipeline types
 * - AI/Factory types
 * - Globe/3D types
 * - API types (Request/Response)
 * - Error types
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/** Unique identifier type */
export type ID = string;

/** ISO 8601 date string */
export type ISODateString = string;

/** Timestamp in milliseconds */
export type Timestamp = number;

/** Generic entity type */
export interface Entity {
  id: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// STIX/TAXII TYPES (STIX 2.1 Compliant)
// ============================================================================

/** STIX Bundle */
export interface StixBundle {
  type: 'bundle';
  id: string;
  spec_version: '2.1';
  objects: StixObject[];
}

/** Base STIX Object */
export interface StixObject {
  type: string;
  id: string;
  created: ISODateString;
  modified: ISODateString;
  spec_version: '2.1';
  object_marking?: StixMarkingDefinition[];
}

/** STIX Domain Object Types */
export type StixDomainObject = 
  | StixIndicator 
  | StixMalware 
  | StixThreatActor 
  | StixAttackPattern 
  | StixCampaign 
  | StixIncident 
  | StixVulnerability;

/** STIX Cyber Observable Types */
export type StixCyberObservable = 
  | StixIPv4Address 
  | StixIPv6Address 
  | StixDomainName 
  | StixURL 
  | StixEmailAddress 
  | StixFile 
  | StixX509Certificate;

/** STIX Relationship Types */
export type StixRelationshipType = 
  | 'indicates' 
  | 'uses' 
  | 'targets' 
  | 'mitigates' 
  | 'related-to' 
  | 'part-of' 
  | 'has' 
  | 'belongs-to';

// STIX Domain Objects

export interface StixIndicator extends StixObject {
  type: 'indicator';
  pattern: string;
  pattern_type: 'stix' | 'pcre' | 'sigma' | string;
  valid_from: ISODateString;
  labels?: string[];
  description?: string;
}

export interface StixMalware extends StixObject {
  type: 'malware';
  name: string;
  is_family: boolean;
  malware_types?: string[];
  description?: string;
}

export interface StixThreatActor extends StixObject {
  type: 'threat-actor';
  name: string;
  threat_actor_types: string[];
  roles?: string[];
  goals?: string[];
  sophistication?: 'none' | 'minimal' | 'intermediate' | 'advanced' | 'expert' | 'innovator' | string;
  resource_level?: 'individual' | 'club' | 'contender' | 'team' | 'organization' | 'government' | string;
  primary_motivation?: 'personal-gain' | 'organizational-gain' | 'national-prestige' | 'political' | 'personal-satisfaction' | 'ethical-beliefs' | 'unpredictable' | string;
}

export interface StixAttackPattern extends StixObject {
  type: 'attack-pattern';
  name: string;
  description?: string;
  external_references?: StixExternalReference[];
}

// STIX Cyber Observables

export interface StixIPv4Address {
  type: 'ipv4-addr';
  value: string;
  resolves_to_refs?: string[];
  belongs_to_refs?: string[];
}

export interface StixIPv6Address {
  type: 'ipv6-addr';
  value: string;
  resolves_to_refs?: string[];
  belongs_to_refs?: string[];
}

export interface StixDomainName {
  type: 'domain-name';
  value: string;
  resolves_to_refs?: string[];
}

export interface StixURL {
  type: 'url';
  value: string;
}

export interface StixEmailAddress {
  type: 'email-addr';
  value: string;
  display_name?: string;
  belongs_to_ref?: string;
}

export interface StixFile {
  type: 'file';
  name?: string;
  hashes?: StixHash[];
  size?: number;
  mime_type?: string;
  created?: ISODateString;
  modified?: ISODateString;
}

export interface StixX509Certificate {
  type: 'x509-certificate';
  issuer?: string;
  serial_number?: string;
  signature_algorithm?: string;
  subject?: string;
  validity_not_before?: ISODateString;
  validity_not_after?: ISODateString;
}

// STIX Common Types

export interface StixMarkingDefinition extends StixObject {
  type: 'marking-definition';
  definition_type: string;
  definition: Record<string, unknown>;
}

export interface StixExternalReference {
  source_name: string;
  url?: string;
  external_id?: string;
}

export interface StixHash {
  algorithm: string;
  value: string;
}

// STIX Relationship

export interface StixRelationship extends StixObject {
  type: 'relationship';
  relationship_type: StixRelationshipType;
  source_ref: string;
  target_ref: string;
  start_time?: ISODateString;
  end_time?: ISODateString;
}

// ============================================================================
// GRAPH TYPES (Neo4j Compatible)
// ============================================================================

/** Graph Node */
export interface GraphNode {
  id: ID;
  labels: string[];
  properties: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Graph Relationship */
export interface GraphRelationship {
  id: ID;
  type: string;
  startNodeId: ID;
  endNodeId: ID;
  properties: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Complete Graph */
export interface Graph {
  id: ID;
  name: string;
  description?: string;
  nds: GraphNode[];
  rls: GraphRelationship[];
  metadata?: {
    author?: string;
    tags?: string[];
    version?: string;
  };
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Graph Statistics */
export interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
  labelDistribution: Record<string, number>;
  relationshipTypeDistribution: Record<string, number>;
  density: number;
  diameter?: number;
  connectedComponents: number;
}

/** Graph Query */
export interface GraphQuery {
  cypher?: string;
  gremlin?: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

/** Graph Query Result */
export interface GraphQueryResult {
  records: Record<string, unknown>[];
  summary: {
    query: string;
    db: string;
    plan: unknown;
    profile: unknown;
    notifications: unknown[];
    server: {
      address: string;
      version: string;
    };
    queryType: 'r' | 'rw' | 'w' | 's';
  };
}

// ============================================================================
// TDA TYPES (Topological Data Analysis)
// ============================================================================

/** TDA Configuration */
export interface TdaConfig {
  dimension: 2 | 3; // 2D or 3D simplicial complex
  distanceMetric: 'euclidean' | 'cosine' | 'manhattan' | 'geodesic';
  radius: number; // ε value for Vietoris-Rips complex
  maxSimplices: number; // Maximum number of simplices to generate
  persistenceThreshold: number; // Threshold for persistence
  
  // Output options
  includeBarcode: boolean;
  includePersistenceDiagram: boolean;
  includeBettiNumbers: boolean;
  includeCentrality: boolean;
  includeCommunities: boolean;
  includeClustering: boolean;
}

/** Betti Numbers (H0, H1, H2, ...) */
export interface BettiNumbers {
  [dimension: number]: number;
}

/** Persistence Interval */
export interface PersistenceInterval {
  birth: number;
  death: number | 'Infinity';
  dimension: number;
  persistence: number;
}

/** Persistence Diagram */
export interface PersistenceDiagram {
  intervals: PersistenceInterval[];
  dimension: number;
}

/** Barcode */
export interface Barcode {
  dimension: number;
  intervals: Array<{ start: number; end: number }>;
}

/** Critical Point */
export interface CriticalPoint {
  id: ID;
  dimension: number;
  birth: number;
  death: number | 'Infinity';
  persistence: number;
  coordinates?: number[];
}

/** TDA Analysis Results */
export interface TdaAnalysis {
  id: ID;
  graphId: ID;
  config: TdaConfig;
  bettiNumbers: BettiNumbers;
  persistenceDiagrams: PersistenceDiagram[];
  barcodes: Barcode[];
  criticalPoints: CriticalPoint[];
  
  // Additional analysis
  centrality?: CentralityMetrics;
  communities?: Community[];
  clusters?: Cluster[];
  
  // Metadata
  duration: number; // in milliseconds
  startedAt: ISODateString;
  completedAt: ISODateString;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/** TDA Analysis Request */
export interface TdaAnalysisRequest {
  graphId: ID;
  config: Partial<TdaConfig>;
  nodeFilter?: string[]; // Filter nodes by IDs
  edgeFilter?: string[]; // Filter edges by types
}

// ============================================================================
// CENTRALITY TYPES
// ============================================================================

/** Centrality Metrics */
export interface CentralityMetrics {
  degree?: Record<ID, number>;
  betweenness?: Record<ID, number>;
  closeness?: Record<ID, number>;
  eigenvector?: Record<ID, number>;
  pageRank?: Record<ID, number>;
  hubs?: Record<ID, number>;
  authority?: Record<ID, number>;
}

/** Centrality Analysis Request */
export interface CentralityAnalysisRequest {
  graphId: ID;
  metrics: ('degree' | 'betweenness' | 'closeness' | 'eigenvector' | 'pageRank' | 'hubs' | 'authority')[];
  normalize?: boolean;
}

// ============================================================================
// COMMUNITY DETECTION TYPES
// ============================================================================

/** Community Detection Algorithm */
export type CommunityAlgorithm = 
  | 'louvain' 
  | 'leiden' 
  | 'label-propagation' 
  | 'fast-greedy' 
  | 'girvan-newman' 
  | 'modularity-optimization';

/** Community */
export interface Community {
  id: ID;
  name?: string;
  nodes: ID[];
  size: number;
  modularity: number;
  density?: number;
  centralNode?: ID;
}

/** Community Detection Request */
export interface CommunityDetectionRequest {
  graphId: ID;
  algorithm: CommunityAlgorithm;
  resolution?: number;
  maxIterations?: number;
  randomSeed?: number;
}

/** Community Detection Results */
export interface CommunityDetectionResults {
  communities: Community[];
  algorithm: CommunityAlgorithm;
  modularity: number; // Global modularity score
  executionTime: number;
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

/** Pipeline Step Type */
export type PipelineStepType = 
  | 'enrichment' 
  | 'filter' 
  | 'transform' 
  | 'analysis' 
  | 'export' 
  | 'import' 
  | 'notification';

/** Pipeline Step */
export interface PipelineStep {
  id: ID;
  name: string;
  type: PipelineStepType;
  description?: string;
  module: string; // Module identifier
  config: Record<string, unknown>;
  enabled: boolean;
  order: number;
}

/** Pipeline Trigger Type */
export type PipelineTriggerType = 
  | 'manual' 
  | 'schedule' 
  | 'event' 
  | 'api' 
  | 'webhook';

/** Pipeline Schedule */
export interface PipelineSchedule {
  type: 'cron' | 'interval';
  value: string; // Cron expression or interval in ms
}

/** Pipeline */
export interface Pipeline {
  id: ID;
  name: string;
  description?: string;
  icon?: string;
  status: 'active' | 'inactive' | 'paused' | 'error';
  
  steps: PipelineStep[];
  triggers: PipelineTriggerType[];
  schedule?: PipelineSchedule;
  
  // Execution stats
  executions: number;
  lastExecution?: ISODateString;
  avgDuration: number;
  
  // Metadata
  author: ID;
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Pipeline Execution */
export interface PipelineExecution {
  id: ID;
  pipelineId: ID;
  pipelineName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  startedAt: ISODateString;
  finishedAt?: ISODateString;
  duration: number; // in milliseconds
  
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  
  // Progress
  progress: number; // 0-100
  currentStep?: number;
  currentStepName?: string;
}

/** Pipeline Execution Request */
export interface PipelineExecutionRequest {
  pipelineId: ID;
  input: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
}

// ============================================================================
// GLOBE/3D TYPES
// ============================================================================

/** 3D Coordinates */
export interface Coordinates3D {
  x: number;
  y: number;
  z: number;
}

/** 2D Coordinates (for map projection) */
export interface Coordinates2D {
  longitude: number;
  latitude: number;
}

/** Globe Entity (for Cesium) */
export interface GlobeEntity {
  id: ID;
  name?: string;
  description?: string;
  
  // Position
  position: Coordinates3D | Coordinates2D;
  
  // Visual properties
  color?: string;
  scale?: number;
  icon?: string;
  model?: string; // 3D model URL
  
  // Graph properties
  nodeId?: ID;
  properties?: Record<string, unknown>;
  
  // TDA properties
  bettiNumber?: number;
  persistence?: number;
  communityId?: ID;
  centrality?: number;
}

/** Globe Camera Position */
export interface GlobeCameraPosition {
  position: Coordinates3D;
  target?: Coordinates3D;
  up?: Coordinates3D;
  zoom?: number;
}

/** Globe View Options */
export interface GlobeViewOptions {
  showNodes: boolean;
  showEdges: boolean;
  showLabels: boolean;
  showClusters: boolean;
  showTda: boolean;
  
  nodeSize: number;
  edgeWidth: number;
  labelSize: number;
  
  colorScheme: 'default' | 'centrality' | 'community' | 'tda' | 'custom';
}

/** Globe Configuration */
export interface GlobeConfig {
  cesiumToken: string;
  baseLayer?: string;
  terrainProvider?: string;
  defaultView?: GlobeCameraPosition;
  maxNodes?: number; // Maximum nodes to render
}

// ============================================================================
// FACTORY/AI TYPES
// ============================================================================

/** AI Model Type */
export type AIModelType = 
  | 'text-embedding' 
  | 'text-classification' 
  | 'ner' 
  | 'relation-extraction' 
  | 'summarization' 
  | 'translation' 
  | 'custom';

/** AI Model Configuration */
export interface AIModelConfig {
  type: AIModelType;
  name: string;
  provider: 'openai' | 'anthropic' | 'local' | 'huggingface' | string;
  endpoint?: string;
  apiKey?: string;
  parameters?: Record<string, unknown>;
}

/** AI Analysis Type */
export type AIAnalysisType = 
  | 'threat-intelligence' 
  | 'entity-resolution' 
  | 'relationship-prediction' 
  | 'anomaly-detection' 
  | 'community-detection' 
  | 'centrality-analysis' 
  | 'custom';

/** AI Analysis Request */
export interface AIAnalysisRequest {
  type: AIAnalysisType;
  model?: string;
  input: Record<string, unknown>;
  graphId?: ID;
  parameters?: Record<string, unknown>;
}

/** AI Analysis Result */
export interface AIAnalysisResult {
  id: ID;
  type: AIAnalysisType;
  model: string;
  
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  
  confidence?: number;
  explanation?: string;
  
  executionTime: number;
  startedAt: ISODateString;
  completedAt: ISODateString;
}

/** AI Enrichment Result */
export interface AIEnrichmentResult {
  entities: StixObject[];
  relationships: StixRelationship[];
  observations: StixCyberObservable[];
  confidenceScores: Record<ID, number>;
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

/** Storage Type */
export type StorageType = 'neo4j' | 'redis' | 'local' | 's3' | 'mongo';

/** Storage Configuration */
export interface StorageConfig {
  type: StorageType;
  [key: string]: unknown;
}

/** Neo4j Storage Config */
export interface Neo4jStorageConfig extends StorageConfig {
  type: 'neo4j';
  uri: string;
  user: string;
  password: string;
  database?: string;
}

/** Redis Storage Config */
export interface RedisStorageConfig extends StorageConfig {
  type: 'redis';
  url: string;
  password?: string;
  db?: number;
}

/** Local Storage Config */
export interface LocalStorageConfig extends StorageConfig {
  type: 'local';
  path: string;
}

/** S3 Storage Config */
export interface S3StorageConfig extends StorageConfig {
  type: 's3';
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/** Cache Backend Type */
export type CacheBackendType = 'memory' | 'localStorage' | 'redis' | 'hybrid';

/** Cache Configuration */
export interface CacheConfig {
  backend: CacheBackendType;
  ttl?: number; // in seconds
  maxSize?: number; // in MB
  
  // For hybrid cache
  primary?: CacheBackendType;
  fallback?: CacheBackendType[];
}

/** Cache Entry */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt: Timestamp;
  tags?: string[];
}

// ============================================================================
// EVENT BUS TYPES
// ============================================================================

/** Event Type */
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
  | 'pipeline:started' 
  | 'pipeline:completed' 
  | 'pipeline:failed' 
  | 'ai:request' 
  | 'ai:response' 
  | 'user:login' 
  | 'user:logout' 
  | 'custom';

/** Event Payload */
export interface EventPayload {
  type: EventType;
  data: Record<string, unknown>;
  timestamp: ISODateString;
  source: string; // Service that emitted the event
  correlationId?: string; // For tracing
}

/** Event Subscription */
export interface EventSubscription {
  eventType: EventType | EventType[];
  callback: (payload: EventPayload) => Promise<void>;
  filter?: (payload: EventPayload) => boolean;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

/** User Role */
export type UserRole = 
  | 'admin' 
  | 'analyst' 
  | 'investigator' 
  | 'viewer' 
  | 'guest';

/** User */
export interface User {
  id: ID;
  email: string;
  username: string;
  roles: UserRole[];
  tenantId?: ID;
  
  // Profile
  firstName?: string;
  lastName?: string;
  avatar?: string;
  
  // Preferences
  preferences?: UserPreferences;
  
  // Security
  lastLogin?: ISODateString;
  loginCount: number;
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** User Preferences */
export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  language: string;
  timezone: string;
  
  // UI Preferences
  pageSize: number;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  
  // Notification Preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
}

/** Auth Token */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** Auth Credentials */
export interface AuthCredentials {
  email: string;
  password: string;
  tenantId?: ID;
}

/** Tenant */
export interface Tenant {
  id: ID;
  name: string;
  description?: string;
  
  // Configuration
  config: TenantConfig;
  
  // Limits
  maxUsers: number;
  maxGraphs: number;
  maxStorage: number;
  
  // Status
  isActive: boolean;
  
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Tenant Configuration */
export interface TenantConfig {
  theme?: {
    primaryColor: string;
    logo: string;
  };
  features?: {
    tda: boolean;
    ai: boolean;
    globe: boolean;
    pipeline: boolean;
  };
}

// ============================================================================
// API TYPES
// ============================================================================

/** API Request */
export interface ApiRequest<T = unknown> {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  body?: T;
  timeout?: number;
}

/** API Response */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: ApiRequest;
}

/** Paginated Response */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Error Response */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  status: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/** Error Code */
export type ErrorCode = 
  | 'NOT_FOUND' 
  | 'UNAUTHORIZED' 
  | 'FORBIDDEN' 
  | 'VALIDATION_ERROR' 
  | 'INTERNAL_ERROR' 
  | 'CONNECTION_ERROR' 
  | 'TIMEOUT_ERROR' 
  | 'CONFLICT' 
  | 'RATE_LIMITED' 
  | string;

/** Service Type */
export type ServiceType = 
  | 'graph' 
  | 'pipeline' 
  | 'tda' 
  | 'globe' 
  | 'factory' 
  | 'ai' 
  | 'storage' 
  | 'cache' 
  | 'eventBus' 
  | 'auth' 
  | 'api' 
  | string;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Deep Partial */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Deep Readonly */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Require At Least One */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/** Value Of */
export type ValueOf<T> = T[keyof T];

/** Array Element */
export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;

/** Promise Value */
export type PromiseValue<P> = P extends Promise<infer T> ? T : P;

/** Awaited */
export type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// ============================================================================
// EXPORT ALL
// ============================================================================

export {
  // Base
  ID,
  ISODateString,
  Timestamp,
  Entity,
  
  // STIX/TAXII
  StixBundle,
  StixObject,
  StixDomainObject,
  StixCyberObservable,
  StixRelationshipType,
  StixIndicator,
  StixMalware,
  StixThreatActor,
  StixAttackPattern,
  StixIPv4Address,
  StixIPv6Address,
  StixDomainName,
  StixURL,
  StixEmailAddress,
  StixFile,
  StixX509Certificate,
  StixMarkingDefinition,
  StixExternalReference,
  StixHash,
  StixRelationship,
  
  // Graph
  GraphNode,
  GraphRelationship,
  Graph,
  GraphStats,
  GraphQuery,
  GraphQueryResult,
  
  // TDA
  TdaConfig,
  BettiNumbers,
  PersistenceInterval,
  PersistenceDiagram,
  Barcode,
  CriticalPoint,
  TdaAnalysis,
  TdaAnalysisRequest,
  
  // Centrality
  CentralityMetrics,
  CentralityAnalysisRequest,
  
  // Community
  CommunityAlgorithm,
  Community,
  CommunityDetectionRequest,
  CommunityDetectionResults,
  
  // Pipeline
  PipelineStepType,
  PipelineStep,
  PipelineTriggerType,
  PipelineSchedule,
  Pipeline,
  PipelineExecution,
  PipelineExecutionRequest,
  
  // Globe
  Coordinates3D,
  Coordinates2D,
  GlobeEntity,
  GlobeCameraPosition,
  GlobeViewOptions,
  GlobeConfig,
  
  // AI/Factory
  AIModelType,
  AIModelConfig,
  AIAnalysisType,
  AIAnalysisRequest,
  AIAnalysisResult,
  AIEnrichmentResult,
  
  // Storage
  StorageType,
  StorageConfig,
  Neo4jStorageConfig,
  RedisStorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
  
  // Cache
  CacheBackendType,
  CacheConfig,
  CacheEntry,
  
  // Event Bus
  EventType,
  EventPayload,
  EventSubscription,
  
  // Auth
  UserRole,
  User,
  UserPreferences,
  AuthToken,
  AuthCredentials,
  Tenant,
  TenantConfig,
  
  // API
  ApiRequest,
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  
  // Error
  ErrorCode,
  ServiceType,
  
  // Utility
  DeepPartial,
  DeepReadonly,
  RequireAtLeastOne,
  ValueOf,
  ArrayElement,
  PromiseValue,
  Awaited,
};
