// platform/src/services/pipeline/api/index.ts
// Pipeline Service API Client
// REST API client for pipeline operations

import {
  PipelineTask,
  PipelineTaskType,
  PipelineResult,
  PipelineStatus,
  EnrichmentInput,
  EnrichmentOutput,
  PluginMetadata,
} from '../../shared/types';
import { getConfig } from '../../shared/config';
import { getCacheManager } from '../../shared/lib/cache';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Pipeline API Configuration
 */
export interface PipelineApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * Create Pipeline Request
 */
export interface CreatePipelineRequest {
  taskType: PipelineTaskType;
  target: string;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Create Pipeline Response
 */
export interface CreatePipelineResponse {
  taskId: string;
  status: PipelineStatus;
  message?: string;
}

/**
 * Pipeline API Client Options
 */
export interface PipelineApiClientOptions {
  config?: PipelineApiConfig;
  useCache?: boolean;
}

// ============================================================================
// PIPELINE API CLIENT
// ============================================================================

/**
 * Pipeline API Client
 */
export class PipelineApiClient {
  private config: PipelineApiConfig;
  private cacheManager = getCacheManager();
  private options: PipelineApiClientOptions;

  constructor(options: PipelineApiClientOptions = {}) {
    const envConfig = getConfig();
    
    this.config = {
      baseUrl: options.config?.baseUrl || envConfig.PIPELINE_API_URL,
      apiKey: options.config?.apiKey || envConfig.PIPELINE_API_KEY,
      timeout: options.config?.timeout || 30000,
      cacheTtl: options.config?.cacheTtl || 300,
    };
    
    this.options = {
      useCache: options.useCache !== false,
      ...options,
    };
  }

  // ==========================================================================
  // PIPELINE OPERATIONS
  // ==========================================================================

  /**
   * Create a new pipeline task
   */
  async createTask(
    request: CreatePipelineRequest
  ): Promise<CreatePipelineResponse> {
    const cacheKey = this.cacheManager.generatePipelineKey(
      `create_${request.taskType}_${request.target}`,
      'results'
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as CreatePipelineResponse;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const response = await this.post<CreatePipelineRequest, CreatePipelineResponse>(
        '/tasks',
        request
      );

      if (this.options.useCache && response.taskId) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          response,
          this.config.cacheTtl
        );
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pipeline task by ID
   */
  async getTask(taskId: string): Promise<PipelineTask> {
    const cacheKey = this.cacheManager.generatePipelineKey(taskId, 'status');

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as PipelineTask;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const task = await this.get<PipelineTask>(`/tasks/${taskId}`);

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          task,
          this.config.cacheTtl
        );
      }

      return task;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all pipeline tasks
   */
  async getAllTasks(
    filters?: {
      status?: PipelineStatus;
      taskType?: PipelineTaskType;
      limit?: number;
      offset?: number;
    }
  ): Promise<PipelineTask[]> {
    const queryParams = new URLSearchParams();
    
    if (filters?.status) {
      queryParams.append('status', filters.status);
    }
    if (filters?.taskType) {
      queryParams.append('type', filters.taskType);
    }
    if (filters?.limit) {
      queryParams.append('limit', String(filters.limit));
    }
    if (filters?.offset) {
      queryParams.append('offset', String(filters.offset));
    }

    const cacheKey = this.cacheManager.generateKey(
      ['pipeline', 'tasks', queryParams.toString()],
      { prefix: 'osint' }
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as PipelineTask[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const tasks = await this.get<PipelineTask[]>(
        `/tasks?${queryParams.toString()}`
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          tasks,
          this.config.cacheTtl
        );
      }

      return tasks;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a pipeline task
   */
  async cancelTask(taskId: string): Promise<PipelineTask> {
    try {
      const task = await this.post<unknown, PipelineTask>(
        `/tasks/${taskId}/cancel`
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generatePipelineKey(taskId, 'status');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return task;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retry a failed pipeline task
   */
  async retryTask(taskId: string): Promise<PipelineTask> {
    try {
      const task = await this.post<unknown, PipelineTask>(
        `/tasks/${taskId}/retry`
      );

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generatePipelineKey(taskId, 'status');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return task;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a pipeline task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.delete(`/tasks/${taskId}`);

      // Invalidate cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generatePipelineKey(taskId, 'status');
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // ENRICHMENT OPERATIONS
  // ==========================================================================

  /**
   * Execute enrichment on a target
   */
  async enrich(
    input: EnrichmentInput
  ): Promise<EnrichmentOutput> {
    const cacheKey = this.cacheManager.generateKey(
      ['enrichment', input.type, JSON.stringify(input.data)],
      { prefix: 'osint' }
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as EnrichmentOutput;
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const output = await this.post<EnrichmentInput, EnrichmentOutput>(
        '/enrich',
        input
      );

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          output,
          this.config.cacheTtl
        );
      }

      return output;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute multiple enrichments sequentially
   */
  async enrichSequentially(
    inputs: EnrichmentInput[]
  ): Promise<EnrichmentOutput[]> {
    const results: EnrichmentOutput[] = [];

    for (const input of inputs) {
      const output = await this.enrich(input);
      results.push(output);
    }

    return results;
  }

  /**
   * Execute multiple enrichments in parallel
   */
  async enrichInParallel(
    inputs: EnrichmentInput[]
  ): Promise<EnrichmentOutput[]> {
    const promises = inputs.map(input => this.enrich(input));
    return Promise.all(promises);
  }

  // ==========================================================================
  // PLUGIN OPERATIONS
  // ==========================================================================

  /**
   * Get all available plugins
   */
  async getPlugins(): Promise<PluginMetadata[]> {
    const cacheKey = this.cacheManager.generateKey(
      ['pipeline', 'plugins'],
      { prefix: 'osint' }
    );

    if (this.options.useCache) {
      try {
        const cached = await this.cacheManager.getDefaultBackend().get(cacheKey);
        if (cached) {
          return cached as PluginMetadata[];
        }
      } catch {
        // Cache read failed, continue with API call
      }
    }

    try {
      const plugins = await this.get<PluginMetadata[]>('/plugins');

      if (this.options.useCache) {
        await this.cacheManager.getDefaultBackend().set(
          cacheKey,
          plugins,
          this.config.cacheTtl * 10 // Cache plugins for longer
        );
      }

      return plugins;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get plugin by name
   */
  async getPlugin(name: string): Promise<PluginMetadata | undefined> {
    try {
      const plugin = await this.get<PluginMetadata>(`/plugins/${name}`);
      return plugin;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(name: string): Promise<PluginMetadata> {
    try {
      const plugin = await this.post<unknown, PluginMetadata>(
        `/plugins/${name}/enable`
      );

      // Invalidate plugins cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateKey(
          ['pipeline', 'plugins'],
          { prefix: 'osint' }
        );
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return plugin;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(name: string): Promise<PluginMetadata> {
    try {
      const plugin = await this.post<unknown, PluginMetadata>(
        `/plugins/${name}/disable`
      );

      // Invalidate plugins cache
      if (this.options.useCache) {
        const cacheKey = this.cacheManager.generateKey(
          ['pipeline', 'plugins'],
          { prefix: 'osint' }
        );
        await this.cacheManager.getDefaultBackend().delete(cacheKey);
      }

      return plugin;
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

let pipelineApiClient: PipelineApiClient | null = null;

export function getPipelineApiClient(options?: PipelineApiClientOptions): PipelineApiClient {
  if (!pipelineApiClient) {
    pipelineApiClient = new PipelineApiClient(options);
  }
  return pipelineApiClient;
}

export function resetPipelineApiClient(): void {
  pipelineApiClient = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PipelineApiClient,
  getPipelineApiClient,
  resetPipelineApiClient,
};

export type {
  PipelineApiConfig,
  CreatePipelineRequest,
  CreatePipelineResponse,
  PipelineApiClientOptions,
};
