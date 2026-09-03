// platform/src/services/tda/api/index.ts
// TDA Service API Client
// REST API client for Topological Data Analysis operations

import {
  TdaConfiguration,
  TdaResult,
  TdaStatus,
  Simplex,
  PersistenceInterval,
  BettiNumbers,
  Barcode,
  CentralityMetrics,
  Community,
} from '../../shared/types';
import { getConfig } from '../../shared/config';
import { getCacheManager } from '../../shared/lib/cache';

// ============================================================================
// TYPES
// ============================================================================

/**
 * TDA API Configuration
 */
export interface TdaApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * Create TDA Analysis Request
 */
export interface CreateTdaAnalysisRequest {
  graphId: string;
  configuration?: TdaConfiguration;
}

/**
 * Create TDA Analysis Response
 */
export interface CreateTdaAnalysisResponse {
  analysisId: string;
  status: TdaStatus;
  message?: string;
}

/**
 * TDA API Client Options
 */
export interface TdaApiClientOptions {
  config?: TdaApiConfig;
  useCache?: boolean;
}

/**
 * TDA Analysis Options
 */
export interface TdaAnalysisOptions {
  dimension?: number;
  radius?: number;
  distanceMetric?: 'euclidean' | 'cosine' | 'manhattan';
  filterEpsilon?: number;
  persistenceThreshold?: number;
}

// ============================================================================
// TDA API CLIENT
// ============================================================================

/**
 * TDA API Client
 */
export class TdaApiClient {
  private config: TdaApiConfig;
  private cacheManager = getCacheManager();
  private options: TdaApiClientOptions;

  constructor(options: TdaApiClientOptions = {}) {
    const envConfig = getConfig();
    
    this.config = {
      baseUrl: options.config?.baseUrl || envConfig.TDA_API_URL,
      apiKey: options.config?.apiKey || envConfig.TDA_API_KEY,
      timeout: options.config?.timeout || 60000, // TDA analysis can take longer
      cacheTtl: options.config?.cacheTtl || 3600, // Cache TDA results for 1 hour
    };
    
    this.options = {
      useCache: options.useCache !== false,
      ...options,
    };
  }

  // ==========================================================================
  // ANALYSIS OPERATIONS
  // ==========================================================================

  /**
   * Create a new TDA analysis for a graph
   */
  async createAnalysis(
    graphId: string,
    configuration?: TdaConfiguration
  ): Promise<CreateTdaAnalysisResponse> {
    const cacheKey = this.cacheManager.generateTdaKey(
      graphId,
      `create_${Date.now()}`
    );

    try {
      const response = await this.post<CreateTdaAnalysisRequest, CreateTdaAnalysisResponse>(
        '/analyses',
        {
          graphId,
          configuration: configuration || this.getDefaultConfiguration(),
        }
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get TDA analysis by ID
   */
  async getAnalysis(
    graphId: string,
    analysisId: string
  ): Promise<TdaResult> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, analysisId);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as TdaResult;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<TdaResult>(
        `/analyses/${graphId}/${analysisId}`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          result,
          this.config.cacheTtl
        );
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all TDA analyses for a graph
   */
  async getAllAnalyses(graphId: string): Promise<TdaResult[]> {
    const cacheKey = this.cacheManager.generateKey(
      ['tda', graphId, 'analyses'],
      { prefix: 'osint' }
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as TdaResult[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const results = await this.get<TdaResult[]>(
        `/analyses/${graphId}`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          results,
          this.config.cacheTtl
        );
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a TDA analysis
   */
  async cancelAnalysis(
    graphId: string,
    analysisId: string
  ): Promise<TdaResult> {
    try {
      const result = await this.post<unknown, TdaResult>(
        `/analyses/${graphId}/${analysisId}/cancel`
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateTdaKey(graphId, analysisId);
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a TDA analysis
   */
  async deleteAnalysis(
    graphId: string,
    analysisId: string
  ): Promise<void> {
    try {
      await this.delete(`/analyses/${graphId}/${analysisId}`);

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateTdaKey(graphId, analysisId);
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // COMPONENT OPERATIONS
  // ==========================================================================

  /**
   * Get connected components from a TDA analysis
   */
  async getComponents(
    graphId: string,
    analysisId: string
  ): Promise<Simplex[]> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_components`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as Simplex[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const components = await this.get<Simplex[]>(
        `/analyses/${graphId}/${analysisId}/components`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          components,
          this.config.cacheTtl
        );
      }

      return components;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // CYCLE OPERATIONS
  // ==========================================================================

  /**
   * Get cycles from a TDA analysis
   */
  async getCycles(
    graphId: string,
    analysisId: string
  ): Promise<Simplex[]> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_cycles`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as Simplex[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const cycles = await this.get<Simplex[]>(
        `/analyses/${graphId}/${analysisId}/cycles`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          cycles,
          this.config.cacheTtl
        );
      }

      return cycles;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // PERSISTENCE OPERATIONS
  // ==========================================================================

  /**
   * Get persistence diagram from a TDA analysis
   */
  async getPersistenceDiagram(
    graphId: string,
    analysisId: string
  ): Promise<PersistenceInterval[]> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_persistence`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as PersistenceInterval[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const diagram = await this.get<PersistenceInterval[]>(
        `/analyses/${graphId}/${analysisId}/persistence`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          diagram,
          this.config.cacheTtl
        );
      }

      return diagram;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get barcode from a TDA analysis
   */
  async getBarcode(
    graphId: string,
    analysisId: string
  ): Promise<Barcode> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_barcode`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as Barcode;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const barcode = await this.get<Barcode>(
        `/analyses/${graphId}/${analysisId}/barcode`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          barcode,
          this.config.cacheTtl
        );
      }

      return barcode;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get Betti numbers from a TDA analysis
   */
  async getBettiNumbers(
    graphId: string,
    analysisId: string
  ): Promise<BettiNumbers> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_betti`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as BettiNumbers;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const betti = await this.get<BettiNumbers>(
        `/analyses/${graphId}/${analysisId}/betti`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          betti,
          this.config.cacheTtl
        );
      }

      return betti;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // CRITICAL POINTS OPERATIONS
  // ==========================================================================

  /**
   * Get critical points from a TDA analysis
   */
  async getCriticalPoints(
    graphId: string,
    analysisId: string
  ): Promise<{ points: unknown[]; threshold: number }> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_critical`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as { points: unknown[]; threshold: number };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<{ points: unknown[]; threshold: number }>(
        `/analyses/${graphId}/${analysisId}/critical`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          result,
          this.config.cacheTtl
        );
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // CENTRALITY OPERATIONS
  // ==========================================================================

  /**
   * Get centrality metrics from a TDA analysis
   */
  async getCentrality(
    graphId: string,
    analysisId: string
  ): Promise<CentralityMetrics> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_centrality`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as CentralityMetrics;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const centrality = await this.get<CentralityMetrics>(
        `/analyses/${graphId}/${analysisId}/centrality`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          centrality,
          this.config.cacheTtl
        );
      }

      return centrality;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // COMMUNITY OPERATIONS
  // ==========================================================================

  /**
   * Get communities from a TDA analysis
   */
  async getCommunities(
    graphId: string,
    analysisId: string
  ): Promise<Community[]> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_communities`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as Community[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const communities = await this.get<Community[]>(
        `/analyses/${graphId}/${analysisId}/communities`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          communities,
          this.config.cacheTtl
        );
      }

      return communities;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // 3D VISUALIZATION OPERATIONS
  // ==========================================================================

  /**
   * Get 3D visualization data for a TDA analysis
   */
  async get3DVisualization(
    graphId: string,
    analysisId: string
  ): Promise<{
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      z: number;
      color: string;
      size: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      color: string;
      width: number;
    }>;
  }> {
    const cacheKey = this.cacheManager.generateTdaKey(graphId, `${analysisId}_3d`);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as {
            nodes: Array<{ id: string; x: number; y: number; z: number; color: string; size: number }>;
            edges: Array<{ source: string; target: string; color: string; width: number }>;
          };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const visualization = await this.get<{
        nodes: Array<{ id: string; x: number; y: number; z: number; color: string; size: number }>;
        edges: Array<{ source: string; target: string; color: string; width: number }>;
      }>(
        `/analyses/${graphId}/${analysisId}/3d`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          visualization,
          this.config.cacheTtl
        );
      }

      return visualization;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get default TDA configuration
   */
  private getDefaultConfiguration(): TdaConfiguration {
    return {
      dimension: 2,
      radius: 1.0,
      maxSimplices: 1000,
      distanceMetric: 'euclidean',
      filterEpsilon: 0.1,
      persistenceThreshold: 0.5,
      includeBarcode: true,
      includePersistenceDiagram: true,
      includeBettiNumbers: true,
    };
  }

  // ==========================================================================
  // HTTP METHODS
  // ==========================================================================

  /**
   * Generic GET request
   */
  private async get<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders();
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    });
    
    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json() as Promise<T>;
  }

  /**
   * Generic POST request
   */
  private async post<TRequest, TResponse>(
    path: string,
    body?: TRequest
  ): Promise<TResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders();
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout),
    });
    
    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json() as Promise<TResponse>;
  }

  /**
   * Generic DELETE request
   */
  private async delete(path: string): Promise<void> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders();
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    });
    
    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Parse error response
   */
  private async parseError(response: Response): Promise<{ message: string; code?: string }> {
    try {
      return await response.json();
    } catch {
      return {
        message: response.statusText,
        code: String(response.status),
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let tdaApiClient: TdaApiClient | null = null;

export function getTdaApiClient(options?: TdaApiClientOptions): TdaApiClient {
  if (!tdaApiClient) {
    tdaApiClient = new TdaApiClient(options);
  }
  return tdaApiClient;
}

export function resetTdaApiClient(): void {
  tdaApiClient = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TdaApiClient,
  getTdaApiClient,
  resetTdaApiClient,
};

export type {
  TdaApiConfig,
  CreateTdaAnalysisRequest,
  CreateTdaAnalysisResponse,
  TdaApiClientOptions,
  TdaAnalysisOptions,
};
