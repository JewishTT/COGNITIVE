/**
 * COGNITIVE PLATFORM - UNIFIED CORE
 * ====================================
 * 
 * [38;5;240mSingle Entry Point for All Core Services[0m
 * 
 * This file exports all core services, utilities, and types for easy import.
 * 
 * Usage:
 *   import { config, graphService, pipelineService, tdaService, ... } from './core';
 */

// ============================================================================
// TYPES
// ============================================================================

export * from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export * from './config';

// ============================================================================
// ERRORS
// ============================================================================

export * from './errors';

// ============================================================================
// LOGGER
// ============================================================================

export * from './logger';

// ============================================================================
// UTILITIES
// ============================================================================

export * from './utils';

// ============================================================================
// SERVICES
// ============================================================================

// Graph Service
export * from './services/graph';

// Pipeline Service
export * from './services/pipeline';

// TDA Service
export * from './services/tda';

// Globe Service
export * from './services/globe';

// Factory Service
export * from './services/factory';

// AI Service
export * from './services/ai';

// Storage Service
export * from './services/storage';

// Cache Service
export * from './services/cache';

// Event Bus Service
export * from './services/eventBus';

// Auth Service
export * from './services/auth';

// ============================================================================
// SINGLETON EXPORTS
// ============================================================================

// Configuration
import { config } from './config';
export { config };

// Services
import { graphService } from './services/graph';
import { pipelineService } from './services/pipeline';
import { tdaService } from './services/tda';
import { globeService } from './services/globe';
import { factoryService } from './services/factory';
import { aiService } from './services/ai';
import { storageService } from './services/storage';
import { cacheService } from './services/cache';
import { eventBus } from './services/eventBus';
import { authService } from './services/auth';

export {
  graphService,
  pipelineService,
  tdaService,
  globeService,
  factoryService,
  aiService,
  storageService,
  cacheService,
  eventBus,
  authService,
};

// ============================================================================
// CORE EXPORTS
// ============================================================================

export {
  // From types
  ID,
  ISODateString,
  Timestamp,
  Entity,
  
  // All STIX/TAXII types
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
  
  // All Graph types
  GraphNode,
  GraphRelationship,
  Graph,
  GraphStats,
  GraphQuery,
  GraphQueryResult,
  
  // All TDA types
  TdaConfig,
  BettiNumbers,
  PersistenceInterval,
  PersistenceDiagram,
  Barcode,
  CriticalPoint,
  TdaAnalysis,
  TdaAnalysisRequest,
  
  // All Pipeline types
  PipelineStepType,
  PipelineStep,
  PipelineTriggerType,
  PipelineSchedule,
  Pipeline,
  PipelineExecution,
  PipelineExecutionRequest,
  
  // All Globe types
  Coordinates3D,
  Coordinates2D,
  GlobeEntity,
  GlobeCameraPosition,
  GlobeViewOptions,
  GlobeConfig,
  
  // All AI/Factory types
  AIModelType,
  AIModelConfig,
  AIAnalysisType,
  AIAnalysisRequest,
  AIAnalysisResult,
  AIEnrichmentResult,
  
  // All Storage types
  StorageType,
  StorageConfig,
  Neo4jStorageConfig,
  RedisStorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
  
  // All Cache types
  CacheBackendType,
  CacheConfig,
  CacheEntry,
  
  // All Event Bus types
  EventType,
  EventPayload,
  EventSubscription,
  
  // All Auth types
  UserRole,
  User,
  UserPreferences,
  AuthToken,
  AuthCredentials,
  Tenant,
  TenantConfig,
  
  // All API types
  ApiRequest,
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  
  // Error types
  ErrorCode,
  ServiceType,
  
  // Utility types
  DeepPartial,
  DeepReadonly,
  RequireAtLeastOne,
  ValueOf,
  ArrayElement,
  PromiseValue,
  Awaited,
};
