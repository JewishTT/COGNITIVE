// platform/src/services/graph/api/index.ts
// [38;5;240mGraph Service API Client[0m
// [38;5;240mREST API client for graph operations[0m

import {
  StandardGraphData,
  StandardGraphNode,
  StandardGraphEdge,
  GraphVersion,
  GraphMetadata,
} from '../../shared/types';
import { getConfig } from '../../shared/config';
import { getCacheManager } from '../../shared/lib/cache';
import { getFallbackManager } from '../../shared/lib/fallback';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mGraph API Configuration[0m
 */
export interface GraphApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * [38;5;220mCreate Graph Request[0m
 */
export interface CreateGraphRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * [38;5;220mCreate Graph Response[0m
 */
export interface CreateGraphResponse {
  id: string;
  name: string;
  message?: string;
}

/**
 * [38;5;220mGraph API Client Options[0m
 */
export interface GraphApiClientOptions {
  config?: GraphApiConfig;
  useCache?: boolean;
  useFallback?: boolean;
}

/**
 * [38;5;220mNode Query Options[0m
 */
export interface QueryNodesOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * [38;5;220mEdge Query Options[0m
 */
export interface QueryEdgesOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// [38;5;220mGRAPH API CLIENT[0m
// ============================================================================

/**
 * [38;5;220mGraph API Client[0m
 */
export class GraphApiClient {
  private config: GraphApiConfig;
  private cacheManager = getCacheManager();
  private fallbackManager = getFallbackManager();
  private options: GraphApiClientOptions;

  constructor(options: GraphApiClientOptions = {}) {
    const envConfig = getConfig();
    
    this.config = {
      baseUrl: options.config?.baseUrl || envConfig.GRAPH_API_URL,
      apiKey: options.config?.apiKey || envConfig.GRAPH_API_KEY,
      timeout: options.config?.timeout || 30000,
      cacheTtl: options.config?.cacheTtl || 300,
    };
    
    this.options = {
      useCache: options.useCache !== false,
      useFallback: options.useFallback !== false,
      ...options,
    };
  }

  // ==========================================================================
  // [38;5;220mGRAPH OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a new graph[0m
   */
  async createGraph(
    request: CreateGraphRequest
  ): Promise<CreateGraphResponse> {
    try {
      const response = await this.post<CreateGraphRequest, CreateGraphResponse>(
        '/graphs',
        request
      );

      // Invalidate graphs cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateKey(
          ['graphs'],
          { prefix: 'osint' }
        );
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return response;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              id: `mock_${Date.now()}`,
              name: request.name,
              message: 'Fallback: Graph created in offline mode',
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet graph by ID[0m
   */
  async getGraph(graphId: string): Promise<StandardGraphData> {
    const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as StandardGraphData;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const graph = await this.get<StandardGraphData>(`/graphs/${graphId}`);

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          graph,
          this.config.cacheTtl
        );
      }

      return graph;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: this.fallbackManager.generateMockGraph(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet all graphs[0m
   */
  async getAllGraphs(
    options?: {
      limit?: number;
      offset?: number;
      search?: string;
    }
  ): Promise<{ graphs: GraphMetadata[]; total: number }> {
    const queryParams = new URLSearchParams();
    
    if (options?.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.offset) {
      queryParams.append('offset', String(options.offset));
    }
    if (options?.search) {
      queryParams.append('search', options.search);
    }

    const cacheKey = this.cacheManager.generateKey(
      ['graphs', queryParams.toString()],
      { prefix: 'osint' }
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as { graphs: GraphMetadata[]; total: number };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<{ graphs: GraphMetadata[]; total: number }>(
        `/graphs?${queryParams.toString()}`
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
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              graphs: [],
              total: 0,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mUpdate graph metadata[0m
   */
  async updateGraph(
    graphId: string,
    updates: Partial<CreateGraphRequest>
  ): Promise<StandardGraphData> {
    try {
      const graph = await this.patch<Partial<CreateGraphRequest>, StandardGraphData>(
        `/graphs/${graphId}`,
        updates
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return graph;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: this.fallbackManager.generateMockGraph(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDelete a graph[0m
   */
  async deleteGraph(graphId: string): Promise<void> {
    try {
      await this.delete(`/graphs/${graphId}`);

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }
    } catch (error) {
      if (this.options.useFallback) {
        // Just log the error in fallback mode
        console.warn(`[38;5;208m[GraphApiClient] Failed to delete graph ${graphId}:[0m`, error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // [38;5;220mNODE OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mAdd a node to a graph[0m
   */
  async addNode(
    graphId: string,
    node: StandardGraphNode
  ): Promise<StandardGraphNode> {
    try {
      const createdNode = await this.post<StandardGraphNode, StandardGraphNode>(
        `/graphs/${graphId}/nodes`,
        node
      );

      // Invalidate graph cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return createdNode;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: {
              ...node,
              id: `mock_${Date.now()}`,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mAdd multiple nodes to a graph[0m
   */
  async addNodes(
    graphId: string,
    nodes: StandardGraphNode[]
  ): Promise<StandardGraphNode[]> {
    try {
      const createdNodes = await this.post<StandardGraphNode[], StandardGraphNode[]>(
        `/graphs/${graphId}/nodes/batch`,
        nodes
      );

      // Invalidate graph cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return createdNodes;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: nodes.map((node, index) => ({
              ...node,
              id: `mock_${Date.now()}_${index}`,
            })),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet node by ID from a graph[0m
   */
  async getNode(
    graphId: string,
    nodeId: string
  ): Promise<StandardGraphNode> {
    const cacheKey = this.cacheManager.generateGraphKey(graphId, 'nodes', nodeId);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as StandardGraphNode;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const node = await this.get<StandardGraphNode>(
        `/graphs/${graphId}/nodes/${nodeId}`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          node,
          this.config.cacheTtl
        );
      }

      return node;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              id: nodeId,
              name: `Mock Node ${nodeId}`,
              stixType: 'identity',
              description: 'Fallback node',
            } as StandardGraphNode,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet all nodes from a graph[0m
   */
  async getNodes(
    graphId: string,
    options?: QueryNodesOptions
  ): Promise<{ nodes: StandardGraphNode[]; total: number }> {
    const queryParams = new URLSearchParams();
    
    if (options?.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.offset) {
      queryParams.append('offset', String(options.offset));
    }
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        queryParams.append(`filter.${key}`, String(value));
      }
    }
    if (options?.sortBy) {
      queryParams.append('sortBy', options.sortBy);
    }
    if (options?.sortOrder) {
      queryParams.append('sortOrder', options.sortOrder);
    }

    const cacheKey = this.cacheManager.generateGraphKey(
      graphId,
      'nodes',
      queryParams.toString()
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as { nodes: StandardGraphNode[]; total: number };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<{ nodes: StandardGraphNode[]; total: number }>(
        `/graphs/${graphId}/nodes?${queryParams.toString()}`
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
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              nodes: [],
              total: 0,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mUpdate a node in a graph[0m
   */
  async updateNode(
    graphId: string,
    nodeId: string,
    updates: Partial<StandardGraphNode>
  ): Promise<StandardGraphNode> {
    try {
      const node = await this.patch<Partial<StandardGraphNode>, StandardGraphNode>(
        `/graphs/${graphId}/nodes/${nodeId}`,
        updates
      );

      // Invalidate cache
      if (this.options.useCache) {
        const nodeCacheKey = this.cacheManager.generateGraphKey(graphId, 'nodes', nodeId);
        const graphCacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(nodeCacheKey);
        await this.cacheManager.getDefaultBackend().delete(graphCacheKey);
      }

      return node;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: {
              id: nodeId,
              ...updates,
            } as StandardGraphNode,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDelete a node from a graph[0m
   */
  async deleteNode(
    graphId: string,
    nodeId: string
  ): Promise<void> {
    try {
      await this.delete(`/graphs/${graphId}/nodes/${nodeId}`);

      // Invalidate cache
      if (this.options.useCache) {
        const nodeCacheKey = this.cacheManager.generateGraphKey(graphId, 'nodes', nodeId);
        const graphCacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(nodeCacheKey);
        await this.cacheManager.getDefaultBackend().delete(graphCacheKey);
      }
    } catch (error) {
      if (this.options.useFallback) {
        // Just log the error in fallback mode
        console.warn(`[38;5;208m[GraphApiClient] Failed to delete node ${nodeId}:[0m`, error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // [38;5;220mEDGE OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mAdd an edge to a graph[0m
   */
  async addEdge(
    graphId: string,
    edge: StandardGraphEdge
  ): Promise<StandardGraphEdge> {
    try {
      const createdEdge = await this.post<StandardGraphEdge, StandardGraphEdge>(
        `/graphs/${graphId}/edges`,
        edge
      );

      // Invalidate graph cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return createdEdge;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: {
              ...edge,
              id: `mock_${Date.now()}`,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mAdd multiple edges to a graph[0m
   */
  async addEdges(
    graphId: string,
    edges: StandardGraphEdge[]
  ): Promise<StandardGraphEdge[]> {
    try {
      const createdEdges = await this.post<StandardGraphEdge[], StandardGraphEdge[]>(
        `/graphs/${graphId}/edges/batch`,
        edges
      );

      // Invalidate graph cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return createdEdges;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: edges.map((edge, index) => ({
              ...edge,
              id: `mock_${Date.now()}_${index}`,
            })),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet edge by ID from a graph[0m
   */
  async getEdge(
    graphId: string,
    edgeId: string
  ): Promise<StandardGraphEdge> {
    const cacheKey = this.cacheManager.generateGraphKey(graphId, 'edges', edgeId);

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as StandardGraphEdge;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const edge = await this.get<StandardGraphEdge>(
        `/graphs/${graphId}/edges/${edgeId}`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          edge,
          this.config.cacheTtl
        );
      }

      return edge;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              id: edgeId,
              source: 'mock_source',
              target: 'mock_target',
              relationshipType: 'related-to',
            } as StandardGraphEdge,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet all edges from a graph[0m
   */
  async getEdges(
    graphId: string,
    options?: QueryEdgesOptions
  ): Promise<{ edges: StandardGraphEdge[]; total: number }> {
    const queryParams = new URLSearchParams();
    
    if (options?.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.offset) {
      queryParams.append('offset', String(options.offset));
    }
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        queryParams.append(`filter.${key}`, String(value));
      }
    }
    if (options?.sortBy) {
      queryParams.append('sortBy', options.sortBy);
    }
    if (options?.sortOrder) {
      queryParams.append('sortOrder', options.sortOrder);
    }

    const cacheKey = this.cacheManager.generateGraphKey(
      graphId,
      'edges',
      queryParams.toString()
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as { edges: StandardGraphEdge[]; total: number };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<{ edges: StandardGraphEdge[]; total: number }>(
        `/graphs/${graphId}/edges?${queryParams.toString()}`
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
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              edges: [],
              total: 0,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mUpdate an edge in a graph[0m
   */
  async updateEdge(
    graphId: string,
    edgeId: string,
    updates: Partial<StandardGraphEdge>
  ): Promise<StandardGraphEdge> {
    try {
      const edge = await this.patch<Partial<StandardGraphEdge>, StandardGraphEdge>(
        `/graphs/${graphId}/edges/${edgeId}`,
        updates
      );

      // Invalidate cache
      if (this.options.useCache) {
        const edgeCacheKey = this.cacheManager.generateGraphKey(graphId, 'edges', edgeId);
        const graphCacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(edgeCacheKey);
        await this.cacheManager.getDefaultBackend().delete(graphCacheKey);
      }

      return edge;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: {
              id: edgeId,
              ...updates,
            } as StandardGraphEdge,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDelete an edge from a graph[0m
   */
  async deleteEdge(
    graphId: string,
    edgeId: string
  ): Promise<void> {
    try {
      await this.delete(`/graphs/${graphId}/edges/${edgeId}`);

      // Invalidate cache
      if (this.options.useCache) {
        const edgeCacheKey = this.cacheManager.generateGraphKey(graphId, 'edges', edgeId);
        const graphCacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(edgeCacheKey);
        await this.cacheManager.getDefaultBackend().delete(graphCacheKey);
      }
    } catch (error) {
      if (this.options.useFallback) {
        // Just log the error in fallback mode
        console.warn(`[38;5;208m[GraphApiClient] Failed to delete edge ${edgeId}:[0m`, error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // [38;5;220mVERSION OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mGet all versions of a graph[0m
   */
  async getVersions(graphId: string): Promise<GraphVersion[]> {
    const cacheKey = this.cacheManager.generateGraphKey(graphId, 'versions');

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as GraphVersion[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const versions = await this.get<GraphVersion[]>(
        `/graphs/${graphId}/versions`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          versions,
          this.config.cacheTtl
        );
      }

      return versions;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
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
   * [38;5;220mCreate a version of a graph[0m
   */
  async createVersion(
    graphId: string,
    versionData: Omit<GraphVersion, 'id' | 'timestamp'>
  ): Promise<GraphVersion> {
    try {
      const version = await this.post<Omit<GraphVersion, 'id' | 'timestamp'>, GraphVersion>(
        `/graphs/${graphId}/versions`,
        versionData
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'versions');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return version;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: {
              id: `version_${Date.now()}`,
              graphId,
              timestamp: new Date().toISOString(),
              ...versionData,
            } as GraphVersion,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mRestore a graph to a specific version[0m
   */
  async restoreVersion(
    graphId: string,
    versionId: string
  ): Promise<StandardGraphData> {
    try {
      const graph = await this.post<unknown, StandardGraphData>(
        `/graphs/${graphId}/versions/${versionId}/restore`
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateGraphKey(graphId, 'metadata');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return graph;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            mockData: this.fallbackManager.generateMockGraph(),
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mSEARCH OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mSearch nodes in a graph[0m
   */
  async searchNodes(
    graphId: string,
    query: string,
    options?: QueryNodesOptions
  ): Promise<{ nodes: StandardGraphNode[]; total: number }> {
    const queryParams = new URLSearchParams({
      q: query,
    });
    
    if (options?.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.offset) {
      queryParams.append('offset', String(options.offset));
    }

    const cacheKey = this.cacheManager.generateGraphKey(
      graphId,
      'search_nodes',
      query
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as { nodes: StandardGraphNode[]; total: number };
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const result = await this.get<{ nodes: StandardGraphNode[]; total: number }>(
        `/graphs/${graphId}/search/nodes?${queryParams.toString()}`
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
        const result = await this.fallbackManager.withGraphFallback(
          graphId,
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              nodes: [],
              total: 0,
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  // ==========================================================================
  // [38;5;220mHTTP METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mGeneric GET request[0m
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
   * [38;5;220mGeneric POST request[0m
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
   * [38;5;220mGeneric PATCH request[0m
   */
  private async patch<TRequest, TResponse>(
    path: string,
    body?: TRequest
  ): Promise<TResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders();
    
    const response = await fetch(url, {
      method: 'PATCH',
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
   * [38;5;220mGeneric DELETE request[0m
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
   * [38;5;220mGet request headers[0m
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
   * [38;5;220mParse error response[0m
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
// [38;5;220mSINGLETON INSTANCE[0m
// ============================================================================

let graphApiClient: GraphApiClient | null = null;

export function getGraphApiClient(options?: GraphApiClientOptions): GraphApiClient {
  if (!graphApiClient) {
    graphApiClient = new GraphApiClient(options);
  }
  return graphApiClient;
}

export function resetGraphApiClient(): void {
  graphApiClient = null;
}

// ============================================================================
// [38;5;220mEXPORTS[0m
// ============================================================================

export {
  GraphApiClient,
  getGraphApiClient,
  resetGraphApiClient,
};

export type {
  GraphApiConfig,
  CreateGraphRequest,
  CreateGraphResponse,
  GraphApiClientOptions,
  QueryNodesOptions,
  QueryEdgesOptions,
};
