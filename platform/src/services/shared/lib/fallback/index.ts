// platform/src/services/shared/lib/fallback/index.ts
// [38;5;240mFallback System for External Services[0m
// [38;5;240mProvides offline capabilities and graceful degradation[0m

import {
  StandardGraphData,
  StandardGraphNode,
  StandardGraphEdge,
  PipelineResult,
  PipelineTaskType,
} from '../../types';
import { getCacheManager } from '../cache';
import { getEventBus } from '../eventBus';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mFallback Strategy[0m
 */
export type FallbackStrategy =
  | 'cache'
  | 'offline'
  | 'mock'
  | 'none';

/**
 * [38;5;220mFallback Configuration[0m
 */
export interface FallbackConfig {
  enabled: boolean;
  strategy: FallbackStrategy;
  cacheTtl: number; // in seconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
  offlineDataPath?: string;
}

/**
 * [38;5;220mService Status[0m
 */
export interface ServiceStatus {
  service: string;
  available: boolean;
  lastCheck: Date;
  lastError?: string;
  fallbackActive: boolean;
}

/**
 * [38;5;220mFallback Result[0m
 */
export interface FallbackResult<T> {
  data: T;
  fromFallback: boolean;
  fallbackStrategy: FallbackStrategy;
  timestamp: Date;
  warning?: string;
}

/**
 * [38;5;220mOffline Data Entry[0m
 */
export interface OfflineDataEntry {
  id: string;
  type: 'graph' | 'pipeline' | 'tda' | 'enrichment';
  data: unknown;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// [38;5;220mDEFAULT CONFIGURATION[0m
// ============================================================================

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: true,
  strategy: 'cache',
  cacheTtl: 86400, // 24 hours
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  offlineDataPath: './offline-data',
};

// ============================================================================
// [38;5;220mFALLBACK MANAGER[0m
// ============================================================================

/**
 * [38;5;220mFallback Manager[0m
 * [38;5;240mManages fallback strategies for external services[0m
 */
export class FallbackManager {
  private config: FallbackConfig;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private offlineData: Map<string, OfflineDataEntry> = new Map();
  private cacheManager = getCacheManager();
  private eventBus = getEventBus('fallback-manager');
  private initialized: boolean = false;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  }

  // ==========================================================================
  // [38;5;220mINITIALIZATION[0m
  // ==========================================================================

  /**
   * [38;5;220mInitialize the fallback manager[0m
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.eventBus.initialize();
      await this.loadOfflineData();
      this.initialized = true;
      
      console.log(`[38;5;220m[FallbackManager] Initialized with strategy: ${this.config.strategy}[0m`);
    } catch (error) {
      console.error(`[38;5;196m[FallbackManager] Initialization failed:[0m`, error);
      throw error;
    }
  }

  /**
   * [38;5;220mCleanup resources[0m
   */
  async cleanup(): Promise<void> {
    this.offlineData.clear();
    this.serviceStatuses.clear();
    this.initialized = false;
  }

  // ==========================================================================
  // [38;5;220mSERVICE STATUS MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mCheck service availability[0m
   */
  async checkServiceAvailability(
    service: string,
    checkFn: () => Promise<boolean>
  ): Promise<boolean> {
    try {
      const available = await checkFn();
      
      this.serviceStatuses.set(service, {
        service,
        available,
        lastCheck: new Date(),
        fallbackActive: !available,
      });
      
      return available;
    } catch (error) {
      this.serviceStatuses.set(service, {
        service,
        available: false,
        lastCheck: new Date(),
        lastError: String(error),
        fallbackActive: true,
      });
      
      return false;
    }
  }

  /**
   * [38;5;220mGet service status[0m
   */
  getServiceStatus(service: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(service);
  }

  /**
   * [38;5;220mGet all service statuses[0m
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  /**
   * [38;5;220mIs fallback active for a service[0m
   */
  isFallbackActive(service: string): boolean {
    const status = this.serviceStatuses.get(service);
    return !!status?.fallbackActive;
  }

  // ==========================================================================
  // [38;5;220mFALLBACK EXECUTION[0m
  // ==========================================================================

  /**
   * [38;5;220mExecute with fallback support[0m
   */
  async executeWithFallback<T>(
    service: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    options?: {
      retries?: number;
      retryDelay?: number;
      cacheKey?: string;
      mockData?: T;
    }
  ): Promise<FallbackResult<T>> {
    await this.ensureInitialized();
    
    const {
      retries = this.config.maxRetries,
      retryDelay = this.config.retryDelay,
      cacheKey,
      mockData,
    } = options || {};

    let lastError: Error | undefined;
    
    // Try primary function with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await primaryFn();
        
        // Update service status
        this.serviceStatuses.set(service, {
          service,
          available: true,
          lastCheck: new Date(),
          fallbackActive: false,
        });
        
        // Cache the result if cache key is provided
        if (cacheKey) {
          await this.cacheManager.getDefaultBackend().set(
            cacheKey,
            result,
            this.config.cacheTtl
          );
        }
        
        return {
          data: result,
          fromFallback: false,
          fallbackStrategy: 'none',
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error as Error;
        
        // Update service status
        this.serviceStatuses.set(service, {
          service,
          available: false,
          lastCheck: new Date(),
          lastError: lastError.message,
          fallbackActive: true,
        });
        
        // Try fallback if this is the last attempt
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    // Try fallback function
    if (fallbackFn) {
      try {
        const fallbackData = await fallbackFn();
        return {
          data: fallbackData,
          fromFallback: true,
          fallbackStrategy: 'custom',
          timestamp: new Date(),
          warning: `Service ${service} unavailable, using fallback`,
        };
      } catch (fallbackError) {
        console.error(`[38;5;196m[FallbackManager] Fallback function failed:[0m`, fallbackError);
      }
    }

    // Try cache
    if (cacheKey) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached !== undefined) {
          return {
            data: cached as T,
            fromFallback: true,
            fallbackStrategy: 'cache',
            timestamp: new Date(),
            warning: `Service ${service} unavailable, using cached data`,
          };
        }
      } catch (cacheError) {
        console.error(`[38;5;196m[FallbackManager] Cache fallback failed:[0m`, cacheError);
      }
    }

    // Try mock data
    if (mockData !== undefined) {
      return {
        data: mockData,
        fromFallback: true,
        fallbackStrategy: 'mock',
        timestamp: new Date(),
        warning: `Service ${service} unavailable, using mock data`,
      };
    }

    // Try offline data
    try {
      const offlineData = this.getOfflineData(service);
      if (offlineData) {
        return {
          data: offlineData.data as T,
          fromFallback: true,
          fallbackStrategy: 'offline',
          timestamp: new Date(),
          warning: `Service ${service} unavailable, using offline data`,
        };
      }
    } catch (offlineError) {
      console.error(`[38;5;196m[FallbackManager] Offline data fallback failed:[0m`, offlineError);
    }

    // No fallback available
    throw new Error(`[38;5;196mService ${service} unavailable and no fallback available: ${lastError?.message}[0m`);
  }

  // ==========================================================================
  // [38;5;220mSPECIFIC FALLBACKS[0m
  // ==========================================================================

  /**
   * [38;5;220mFallback for Flowsint service[0m
   */
  async withFlowsintFallback<T>(
    primaryFn: () => Promise<T>,
    options?: {
      cacheKey?: string;
      mockData?: T;
      offlineDataType?: string;
    }
  ): Promise<FallbackResult<T>> {
    return this.executeWithFallback(
      'flowsint',
      primaryFn,
      undefined,
      {
        ...options,
        cacheKey: options?.cacheKey || this.generateFlowsintCacheKey(),
      }
    );
  }

  /**
   * [38;5;220mFallback for Graph service[0m
   */
  async withGraphFallback<T>(
    graphId: string,
    primaryFn: () => Promise<T>,
    options?: {
      cacheKey?: string;
      mockData?: T;
    }
  ): Promise<FallbackResult<T>> {
    const cacheKey = options?.cacheKey || this.cacheManager.generateGraphKey(graphId, 'metadata');
    
    return this.executeWithFallback(
      'graph-service',
      primaryFn,
      undefined,
      {
        ...options,
        cacheKey,
      }
    );
  }

  /**
   * [38;5;220mFallback for TDA service[0m
   */
  async withTdaFallback<T>(
    graphId: string,
    analysisId: string,
    primaryFn: () => Promise<T>,
    options?: {
      cacheKey?: string;
      mockData?: T;
    }
  ): Promise<FallbackResult<T>> {
    const cacheKey = options?.cacheKey || this.cacheManager.generateTdaKey(graphId, analysisId);
    
    return this.executeWithFallback(
      'tda-service',
      primaryFn,
      undefined,
      {
        ...options,
        cacheKey,
      }
    );
  }

  // ==========================================================================
  // [38;5;220mOFFLINE DATA MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mLoad offline data from storage[0m
   */
  private async loadOfflineData(): Promise<void> {
    // This would load from localStorage, IndexedDB, or filesystem
    // For now, we'll implement a simple in-memory storage
    
    try {
      // Try to load from localStorage
      const storedData = localStorage.getItem('osint_offline_data');
      if (storedData) {
        const entries: OfflineDataEntry[] = JSON.parse(storedData);
        for (const entry of entries) {
          this.offlineData.set(entry.id, entry);
        }
      }
    } catch {
      // localStorage not available
    }
  }

  /**
   * [38;5;220mSave offline data[0m
   */
  async saveOfflineData(
    id: string,
    type: 'graph' | 'pipeline' | 'tda' | 'enrichment',
    data: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const entry: OfflineDataEntry = {
      id,
      type,
      data,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    };
    
    this.offlineData.set(id, entry);
    
    try {
      // Save to localStorage
      const entries = Array.from(this.offlineData.values());
      localStorage.setItem('osint_offline_data', JSON.stringify(entries));
    } catch {
      // localStorage not available
    }
  }

  /**
   * [38;5;220mGet offline data by ID or type[0m
   */
  getOfflineData(idOrType: string): OfflineDataEntry | undefined {
    // Try by ID first
    let entry = this.offlineData.get(idOrType);
    if (entry) return entry;
    
    // Try by type
    for (const [, e] of this.offlineData) {
      if (e.type === idOrType || e.metadata.service === idOrType) {
        return e;
      }
    }
    
    return undefined;
  }

  /**
   * [38;5;220mGet offline data by type and identifier[0m
   */
  getOfflineDataByType(
    type: 'graph' | 'pipeline' | 'tda' | 'enrichment',
    identifier?: string
  ): OfflineDataEntry[] {
    const results: OfflineDataEntry[] = [];
    
    for (const [, entry] of this.offlineData) {
      if (entry.type === type) {
        if (!identifier || entry.id === identifier || entry.metadata.id === identifier) {
          results.push(entry);
        }
      }
    }
    
    return results;
  }

  /**
   * [38;5;220mDelete offline data[0m
   */
  deleteOfflineData(id: string): boolean {
    const deleted = this.offlineData.delete(id);
    
    if (deleted) {
      try {
        const entries = Array.from(this.offlineData.values());
        localStorage.setItem('osint_offline_data', JSON.stringify(entries));
      } catch {
        // localStorage not available
      }
    }
    
    return deleted;
  }

  /**
   * [38;5;220mClear offline data[0m
   */
  clearOfflineData(): void {
    this.offlineData.clear();
    
    try {
      localStorage.removeItem('osint_offline_data');
    } catch {
      // localStorage not available
    }
  }

  // ==========================================================================
  // [38;5;220mMOCK DATA GENERATORS[0m
  // ==========================================================================

  /**
   * [38;5;220mGenerate mock graph data[0m
   */
  generateMockGraph(nodeCount: number = 10, edgeCount: number = 15): StandardGraphData {
    const nodes: StandardGraphNode[] = [];
    const edges: StandardGraphEdge[] = [];
    
    // Generate nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node_${i}`,
        stixType: 'identity',
        name: `Mock Node ${i}`,
        description: `Generated mock node for fallback`,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      });
    }
    
    // Generate edges
    for (let i = 0; i < edgeCount && i < nodes.length * nodes.length; i++) {
      const sourceIndex = Math.floor(Math.random() * nodes.length);
      const targetIndex = Math.floor(Math.random() * nodes.length);
      
      if (sourceIndex !== targetIndex) {
        edges.push({
          id: `edge_${i}`,
          source: nodes[sourceIndex].id,
          target: nodes[targetIndex].id,
          relationshipType: 'related-to',
          label: `related to`,
          confidence: Math.floor(Math.random() * 100),
        });
      }
    }
    
    return {
      nodes,
      edges,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        source: 'mock',
        schema: 'stix21',
      },
    };
  }

  /**
   * [38;5;220mGenerate mock pipeline result[0m
   */
  generateMockPipelineResult(
    taskType: PipelineTaskType,
    target: string
  ): PipelineResult {
    return {
      runId: `mock_${Date.now()}`,
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.floor(Math.random() * 60000),
      nodesCollected: Math.floor(Math.random() * 100),
      edgesCollected: Math.floor(Math.random() * 50),
      errors: [],
      warnings: ['Mock data - service unavailable'],
      metadata: {
        taskType,
        target,
        fromFallback: true,
      },
    };
  }

  // ==========================================================================
  // [38;5;220mUTILITY METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mGenerate cache key for Flowsint[0m
   */
  private generateFlowsintCacheKey(): string {
    return this.cacheManager.generateKey(['flowsint', Date.now().toString()]);
  }

  /**
   * [38;5;220mEnsure the manager is initialized[0m
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ============================================================================
// [38;5;220mDECORATORS FOR FALLBACK[0m
// ============================================================================

/**
 * [38;5;220mDecorator for adding fallback to functions[0m
 */
export function withFallback<T extends (...args: unknown[]) => Promise<unknown>>(
  service: string,
  fallbackFn?: () => Promise<ReturnType<T>>,
  options?: {
    retries?: number;
    retryDelay?: number;
    cacheKey?: string;
    mockData?: ReturnType<T>;
  }
): (fn: T) => (...args: Parameters<T>) => Promise<FallbackResult<ReturnType<T>>> {
  return (fn: T) => {
    const fallbackManager = new FallbackManager();
    
    return async (...args: Parameters<T>) => {
      return fallbackManager.executeWithFallback(
        service,
        () => fn(...args),
        fallbackFn,
        options
      );
    };
  };
}

/**
 * [38;5;220mDecorator for Flowsint fallback[0m
 */
export function withFlowsintFallback<T extends (...args: unknown[]) => Promise<unknown>>(
  options?: {
    cacheKey?: string;
    mockData?: ReturnType<T>;
  }
): (fn: T) => (...args: Parameters<T>) => Promise<FallbackResult<ReturnType<T>>> {
  return withFallback('flowsint', undefined, options);
}

/**
 * [38;5;220mDecorator for Graph service fallback[0m
 */
export function withGraphFallback<T extends (...args: unknown[]) => Promise<unknown>>(
  graphId: string,
  options?: {
    cacheKey?: string;
    mockData?: ReturnType<T>;
  }
): (fn: T) => (...args: Parameters<T>) => Promise<FallbackResult<ReturnType<T>>> {
  return (fn: T) => {
    const fallbackManager = new FallbackManager();
    
    return async (...args: Parameters<T>) => {
      return fallbackManager.withGraphFallback(
        graphId,
        () => fn(...args),
        options
      );
    };
  };
}

// ============================================================================
// [38;5;220mSINGLETON INSTANCE[0m
// ============================================================================

let fallbackManager: FallbackManager | null = null;

export function getFallbackManager(config?: Partial<FallbackConfig>): FallbackManager {
  if (!fallbackManager) {
    fallbackManager = new FallbackManager(config);
  }
  return fallbackManager;
}

export function resetFallbackManager(): void {
  if (fallbackManager) {
    fallbackManager.cleanup();
    fallbackManager = null;
  }
}

// ============================================================================
// [38;5;220mEXPORTS[0m
// ============================================================================

export {
  FallbackManager,
  getFallbackManager,
  resetFallbackManager,
  withFallback,
  withFlowsintFallback,
  withGraphFallback,
};

export type {
  FallbackStrategy,
  FallbackConfig,
  ServiceStatus,
  FallbackResult,
  OfflineDataEntry,
};
