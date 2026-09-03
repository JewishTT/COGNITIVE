// platform/src/services/graph/api/index.ts
// Graph Service API Client
// REST API client for graph operations

import {
  StandardGraphData,
  StandardGraphNode,
  StandardGraphEdge,
  GraphVersion,
  GraphMetadata,
} from '../../shared/types';
import { getConfig } from '../../shared/config';
import { getCacheManager } from '../../shared/lib/cache';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Graph API Configuration
 */
export interface GraphApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * Create Graph Request
 */
export interface CreateGraphRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create Graph Response
 */
export interface CreateGraphResponse {
  id: string;
  name: string;
  message?: string;
}

/**
 * Graph API Client Options
 */
export interface GraphApiClientOptions {
  config?: GraphApiConfig;
  useCache?: boolean;
}

/**
 * Node Query Options
 */
export interface QueryNodesOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Edge Query Options
 */
export interface QueryEdgesOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// GRAPH API CLIENT
// ============================================================================

/**
 * Graph API Client
 */
export class GraphApiClient {
  private config: GraphApiConfig;
  private cacheManager = getCacheManager();
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
      ...options,
    };
  }

  // ==========================================================================
  // GRAPH OPERATIONS
  // ==========================================================================

  /**
   * Create a new graph
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
      throw error;
    }
  }

  /**
   * Get graph by ID
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
      throw error;
    }
  }

  /**
   * Get all graphs
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
      throw error;
    }
  }

  /**
   * Update graph metadata
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
      throw error;
    }
  }

  /**
   * Delete a graph
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
      throw error;
    }
  }

  // ==========================================================================
  // NODE OPERATIONS
  // ==========================================================================

  /**
   * Add a node to a graph
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
      throw error;
    }
  }

  /**
   * Add multiple nodes to a graph
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
      throw error;
    }
  }

  /**
   * Get node by ID from a graph
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
      throw error;
    }
  }

  /**
   * Get all nodes from a graph
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
      throw error;
    }
  }

  /**
   * Update a node in a graph
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
      throw error;
    }
  }

  /**
   * Delete a node from a graph
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
      throw error;
    }
  }

  // ==========================================================================
  // EDGE OPERATIONS
  // ==========================================================================

  /**
   * Add an edge to a graph
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
      throw error;
    }
  }

  /**
   * Add multiple edges to a graph
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
      throw error;
    }
  }

  /**
   * Get edge by ID from a graph
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
      throw error;
    }
  }

  /**
   * Get all edges from a graph
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
      throw error;
    }
  }

  /**
   * Update an edge in a graph
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
      throw error;
    }
  }

  /**
   * Delete an edge from a graph
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
      throw error;
    }
  }

  // ==========================================================================
  // VERSION OPERATIONS
  // ==========================================================================

  /**
   * Get all versions of a graph
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
      throw error;
    }
  }

  /**
   * Create a version of a graph
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
      throw error;
    }
  }

  /**
   * Restore a graph to a specific version
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
      throw error;
    }
  }

  // ==========================================================================
  // SEARCH OPERATIONS
  // ==========================================================================

  /**
   * Search nodes in a graph
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
      throw error;
    }
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
   * Generic PATCH request
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
// EXPORTS
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
