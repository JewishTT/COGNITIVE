// platform/src/services/tda/api/index.ts
// [38;5;240mTDA Service API Client[0m]
// [38;5;240mREST API client for Topological Data Analysis operations[0m

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
import { getFallbackManager } from '../../shared/lib/fallback';

// ============================================================================
// [38;5;220mTYPES[0m]
// ============================================================================

/**
 * [38;5;220mTDA API Configuration[0m]
 */
export interface TdaApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * [38;5;220mCreate TDA Analysis Request[0m]
 */
export interface CreateTdaAnalysisRequest {
  graphId: string;
  configuration?: TdaConfiguration;
}

/**
 * [38;5;220mCreate TDA Analysis Response[0m]
 */
export interface CreateTdaAnalysisResponse {
  analysisId: string;
  status: TdaStatus;
  message?: string;
}

/**
 * [38;5;220mTDA API Client Options[0m]
 */
export interface TdaApiClientOptions {
  config?: TdaApiConfig;
  useCache?: boolean;
  useFallback?: boolean;
}

/**
 * [38;5;220mTDA Analysis Options[0m]
 */
export interface TdaAnalysisOptions {
  dimension?: number;
  radius?: number;
  distanceMetric?: 'euclidean' | 'cosine' | 'manhattan';
  filterEpsilon?: number;
  persistenceThreshold?: number;
}

// ============================================================================
// [38;5;220mTDA API CLIENT[0m]
// ============================================================================

/**
 * [38;5;220mTDA API Client[0m]
 */
export class TdaApiClient {
  private config: TdaApiConfig;
  private cacheManager = getCacheManager();
  private fallbackManager = getFallbackManager();
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
      useFallback: options.useFallback !== false,
      ...options,
    };
  }

  // ==========================================================================
  // [38;5;220mANALYSIS OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mCreate a new TDA analysis for a graph[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          `analysis_${Date.now()}`,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              analysisId: `mock_analysis_${Date.now()}`,
              status: 'pending',
              message: 'Fallback: TDA analysis created in offline mode',
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet TDA analysis by ID[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockTdaResult(graphId, analysisId),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet all TDA analyses for a graph[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: [],
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mCancel a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            mockData: {
              id: analysisId,
              graphId,
              status: 'cancelled',
              createdAt: new Date().toISOString(),
            } as TdaResult,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDelete a TDA analysis[0m]
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
      if (this.options.useFallback) {
        // Just log the error in fallback mode
        console.warn(`[38;5;208m[TdaApiClient] Failed to delete analysis ${analysisId}:[0m`, error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // [38;5;220mCOMPONENT OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet connected components from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockComponents(graphId),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mCYCLE OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet cycles from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: [],
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mPERSISTENCE OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet persistence diagram from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockPersistenceDiagram(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet barcode from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockBarcode(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet Betti numbers from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockBettiNumbers(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mCRITICAL POINTS OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet critical points from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              points: [],
              threshold: 0.5,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mCENTRALITY OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet centrality metrics from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockCentrality(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mCOMMUNITY OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet communities from a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMockCommunities(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220m3D VISUALIZATION OPERATIONS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet 3D visualization data for a TDA analysis[0m]
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withTdaFallback(
          graphId,
          analysisId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.generateMock3DVisualization(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mUTILITY METHODS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGet default TDA configuration[0m]
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

  /**
   * [38;5;220mGenerate mock TDA result[0m]
   */
  private generateMockTdaResult(graphId: string, analysisId: string): TdaResult {
    return {
      id: analysisId,
      graphId,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      configuration: this.getDefaultConfiguration(),
      bettiNumbers: this.generateMockBettiNumbers(),
      persistenceDiagram: this.generateMockPersistenceDiagram(),
      barcode: this.generateMockBarcode(),
      components: this.generateMockComponents(graphId),
      cycles: [],
      criticalPoints: [],
      centrality: this.generateMockCentrality(),
      communities: this.generateMockCommunities(),
    };
  }

  /**
   * [38;5;220mGenerate mock components[0m]
   */
  private generateMockComponents(graphId: string): Simplex[] {
    return [
      {
        id: `component_1`,
        dimension: 0,
        nodes: [`node_1_${graphId}`, `node_2_${graphId}`, `node_3_${graphId}`],
        birth: 0,
        death: Infinity,
      },
      {
        id: `component_2`,
        dimension: 0,
        nodes: [`node_4_${graphId}`, `node_5_${graphId}`],
        birth: 0,
        death: Infinity,
      },
    ];
  }

  /**
   * [38;5;220mGenerate mock persistence diagram[0m]
   */
  private generateMockPersistenceDiagram(): PersistenceInterval[] {
    return [
      { birth: 0, death: 10, dimension: 0 },
      { birth: 5, death: 15, dimension: 0 },
      { birth: 0, death: 20, dimension: 1 },
      { birth: 10, death: Infinity, dimension: 0 },
    ];
  }

  /**
   * [38;5;220mGenerate mock barcode[0m]
   */
  private generateMockBarcode(): Barcode {
    return {
      intervals: [
        { start: 0, end: 10, dimension: 0 },
        { start: 5, end: 15, dimension: 0 },
        { start: 0, end: 20, dimension: 1 },
        { start: 10, end: 100, dimension: 0 },
      ],
    };
  }

  /**
   * [38;5;220mGenerate mock Betti numbers[0m]
   */
  private generateMockBettiNumbers(): BettiNumbers {
    return {
      0: 3,  // Connected components
      1: 1,  // Holes
      2: 0,  // Voids
    };
  }

  /**
   * [38;5;220mGenerate mock centrality metrics[0m]
   */
  private generateMockCentrality(): CentralityMetrics {
    return {
      degree: {
        `node_1`: 0.8,
        `node_2`: 0.6,
        `node_3`: 0.4,
        `node_4`: 0.2,
        `node_5`: 0.1,
      },
      betweenness: {
        `node_1`: 0.5,
        `node_2`: 0.3,
        `node_3`: 0.2,
        `node_4`: 0.1,
        `node_5`: 0.05,
      },
      closeness: {
        `node_1`: 0.7,
        `node_2`: 0.6,
        `node_3`: 0.5,
        `node_4`: 0.4,
        `node_5`: 0.3,
      },
      eigenvector: {
        `node_1`: 0.4,
        `node_2`: 0.3,
        `node_3`: 0.2,
        `node_4`: 0.1,
        `node_5`: 0.05,
      },
    };
  }

  /**
   * [38;5;220mGenerate mock communities[0m]
   */
  private generateMockCommunities(): Community[] {
    return [
      {
        id: 'community_1',
        nodes: ['node_1', 'node_2', 'node_3'],
        size: 3,
        modularity: 0.8,
      },
      {
        id: 'community_2',
        nodes: ['node_4', 'node_5'],
        size: 2,
        modularity: 0.6,
      },
    ];
  }

  /**
   * [38;5;220mGenerate mock 3D visualization[0m]
   */
  private generateMock3DVisualization(): {
    nodes: Array<{ id: string; x: number; y: number; z: number; color: string; size: number }>;
    edges: Array<{ source: string; target: string; color: string; width: number }>;
  } {
    return {
      nodes: [
        { id: 'node_1', x: 0, y: 0, z: 0, color: '#ff0000', size: 10 },
        { id: 'node_2', x: 10, y: 0, z: 0, color: '#00ff00', size: 8 },
        { id: 'node_3', x: 5, y: 10, z: 0, color: '#0000ff', size: 6 },
        { id: 'node_4', x: -10, y: 0, z: 0, color: '#ffff00', size: 8 },
        { id: 'node_5', x: 0, y: -10, z: 0, color: '#ff00ff', size: 6 },
      ],
      edges: [
        { source: 'node_1', target: 'node_2', color: '#888888', width: 2 },
        { source: 'node_1', target: 'node_3', color: '#888888', width: 2 },
        { source: 'node_2', target: 'node_3', color: '#888888', width: 2 },
        { source: 'node_4', target: 'node_5', color: '#888888', width: 2 },
      ],
    };
  }

  // ==========================================================================
  // [38;5;220mHTTP METHODS[0m]
  // ==========================================================================

  /**
   * [38;5;220mGeneric GET request[0m]
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
   * [38;5;220mGeneric POST request[0m]
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
   * [38;5;220mGeneric DELETE request[0m]
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
   * [38;5;220mGet request headers[0m]
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
   * [38;5;220mParse error response[0m]
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
// [38;5;220mSINGLETON INSTANCE[0m]
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
// [38;5;220mEXPORTS[0m]
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
