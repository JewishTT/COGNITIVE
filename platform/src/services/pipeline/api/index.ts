// platform/src/services/pipeline/api/index.ts
// [38;5;240mPipeline Service API Client[0m
// [38;5;240mREST API client for pipeline operations[0m

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
import { getFallbackManager } from '../../shared/lib/fallback';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mPipeline API Configuration[0m
 */
export interface PipelineApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  cacheTtl?: number;
}

/**
 * [38;5;220mCreate Pipeline Request[0m
 */
export interface CreatePipelineRequest {
  taskType: PipelineTaskType;
  target: string;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * [38;5;220mCreate Pipeline Response[0m
 */
export interface CreatePipelineResponse {
  taskId: string;
  status: PipelineStatus;
  message?: string;
}

/**
 * [38;5;220mPipeline API Client Options[0m
 */
export interface PipelineApiClientOptions {
  config?: PipelineApiConfig;
  useCache?: boolean;
  useFallback?: boolean;
}

// ============================================================================
// [38;5;220mPIPELINE API CLIENT[0m
// ============================================================================

/**
 * [38;5;220mPipeline API Client[0m
 */
export class PipelineApiClient {
  private config: PipelineApiConfig;
  private cacheManager = getCacheManager();
  private fallbackManager = getFallbackManager();
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
      useFallback: options.useFallback !== false,
      ...options,
    };
  }

  // ==========================================================================
  // [38;5;220mPIPELINE OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a new pipeline task[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              taskId: `mock_${Date.now()}`,
              status: 'pending',
              message: 'Fallback: Task created in offline mode',
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet pipeline task by ID[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              id: taskId,
              type: 'enrichment',
              status: 'failed',
              error: 'Service unavailable',
              createdAt: new Date().toISOString(),
            } as PipelineTask,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mGet all pipeline tasks[0m
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
   * [38;5;220mCancel a pipeline task[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              id: taskId,
              type: 'enrichment',
              status: 'cancelled',
              error: 'Service unavailable',
              createdAt: new Date().toISOString(),
            } as PipelineTask,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mRetry a failed pipeline task[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              id: taskId,
              type: 'enrichment',
              status: 'pending',
              createdAt: new Date().toISOString(),
            } as PipelineTask,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDelete a pipeline task[0m
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
      if (this.options.useFallback) {
        // Just log the error in fallback mode
        console.warn(`[38;5;208m[PipelineApiClient] Failed to delete task ${taskId}:[0m`, error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // [38;5;220mENRICHMENT OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mExecute enrichment on a target[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            cacheKey,
            mockData: {
              success: false,
              data: {},
              errors: ['Service unavailable'],
              warnings: ['Using fallback data'],
              metadata: {
                fromFallback: true,
              },
            },
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mExecute multiple enrichments sequentially[0m
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
   * [38;5;220mExecute multiple enrichments in parallel[0m
   */
  async enrichInParallel(
    inputs: EnrichmentInput[]
  ): Promise<EnrichmentOutput[]> {
    const promises = inputs.map(input => this.enrich(input));
    return Promise.all(promises);
  }

  // ==========================================================================
  // [38;5;220mPLUGIN OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mGet all available plugins[0m
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
   * [38;5;220mGet plugin by name[0m
   */
  async getPlugin(name: string): Promise<PluginMetadata | undefined> {
    try {
      const plugin = await this.get<PluginMetadata>(`/plugins/${name}`);
      return plugin;
    } catch (error) {
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              name,
              description: 'Mock plugin - service unavailable',
              version: '1.0.0',
              enabled: true,
              type: 'enrichment',
              config: {},
            } as PluginMetadata,
          }
        );
        return result.data;
      }
      return undefined;
    }
  }

  /**
   * [38;5;220mEnable a plugin[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              name,
              description: 'Mock plugin - service unavailable',
              version: '1.0.0',
              enabled: true,
              type: 'enrichment',
              config: {},
            } as PluginMetadata,
          }
        );
        return result.data;
      }
      throw error;
    }
  }

  /**
   * [38;5;220mDisable a plugin[0m
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
      if (this.options.useFallback) {
        const result = await this.fallbackManager.withFlowsintFallback(
          () => Promise.reject(error),
          {
            mockData: {
              name,
              description: 'Mock plugin - service unavailable',
              version: '1.0.0',
              enabled: false,
              type: 'enrichment',
              config: {},
            } as PluginMetadata,
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
// [38;5;220mEXPORTS[0m
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
