/**
 * COGNITIVE PLATFORM - UNIFIED SERVICE CONTRACT
 * 
 * Single interface for all services across the platform.
 * Every service (OSINT, Graph, Globe, TDA, Cache, Pipeline) implements this.
 */

/**
 * Unique identifier
 */
export type ID = string & { readonly __brand: 'ID' };
export function createId(value: string): ID {
  return value as ID;
}

/**
 * ISO 8601 date string
 */
export type ISODateString = string & { readonly __brand: 'ISO8601' };
export function createISODate(date: Date = new Date()): ISODateString {
  return date.toISOString() as ISODateString;
}

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' };
export function createTimestamp(ms: number = Date.now()): Timestamp {
  return ms as Timestamp;
}

/**
 * Service execution context - attached to every request
 */
export interface ServiceContext {
  /** Unique request trace ID for distributed tracing */
  traceId: ID;
  /** User ID if authenticated */
  userId?: ID;
  /** Tenant ID for multi-tenant deployments */
  tenantId?: ID;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Request start time */
  startTime: Timestamp;
  /** Correlation ID for related requests */
  correlationId?: ID;
  /** Custom metadata passed by caller */
  metadata?: Record<string, unknown>;
}

/**
 * Standard unified request format across all services
 */
export interface UnifiedRequest<T = any> {
  /** Unique request ID */
  id: ID;
  /** Target service name (osint, graph, globe, tda, cache, pipeline) */
  service: string;
  /** Action/method to execute */
  action: string;
  /** Request payload - service-specific */
  payload: T;
  /** Execution context */
  context: ServiceContext;
}

/**
 * Standard unified response format across all services
 */
export interface UnifiedResponse<T = any> {
  /** Request ID echo */
  id: ID;
  /** Success flag */
  ok: boolean;
  /** Response data (when ok=true) */
  data?: T;
  /** Error info (when ok=false) */
  error?: ServiceError;
  /** Response metadata */
  meta: ResponseMetadata;
}

/**
 * Structured error response
 */
export interface ServiceError {
  /** Error code (SERVICE_NOT_FOUND, TIMEOUT, VALIDATION_ERROR, etc.) */
  code: string;
  /** Human-readable message */
  message: string;
  /** Error details for debugging */
  details?: Record<string, unknown>;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Total execution time in milliseconds */
  duration: number;
  /** Whether result came from cache */
  cached: boolean;
  /** Service version that handled the request */
  version?: string;
  /** Additional metrics */
  metrics?: {
    dbQueries?: number;
    cacheHits?: number;
    cacheMisses?: number;
    externalCalls?: number;
  };
}

/**
 * Service health status
 */
export interface ServiceHealth {
  /** Is service ready */
  ready: boolean;
  /** Current status (up, degraded, down) */
  status: 'up' | 'degraded' | 'down';
  /** Latency in milliseconds */
  latency: number;
  /** Last check timestamp */
  lastCheck: Timestamp;
  /** Service version */
  version?: string;
  /** Additional health info */
  details?: Record<string, unknown>;
}

/**
 * Core service interface - implemented by all services
 */
export interface IServiceNode {
  /** Service name */
  readonly name: string;
  
  /** Service version */
  readonly version: string;
  
  /**
   * Check service health
   */
  health(): Promise<ServiceHealth>;
  
  /**
   * Execute a unified request
   * @param req Unified request
   * @returns Promise resolving to unified response
   */
  execute<T = any>(req: UnifiedRequest<T>): Promise<UnifiedResponse>;
  
  /**
   * Subscribe to service events (optional)
   */
  subscribe?(event: string, listener: (data: any) => void): void;
  
  /**
   * Unsubscribe from service events (optional)
   */
  unsubscribe?(event: string, listener: (data: any) => void): void;
}

/**
 * Request builder for type safety
 */
export class RequestBuilder {
  private request: Partial<UnifiedRequest> = {};
  
  forService(service: string): this {
    this.request.service = service;
    return this;
  }
  
  action(action: string): this {
    this.request.action = action;
    return this;
  }
  
  payload(payload: any): this {
    this.request.payload = payload;
    return this;
  }
  
  withContext(context: Partial<ServiceContext>): this {
    const now = Date.now() as Timestamp;
    this.request.context = {
      traceId: createId(context.traceId || `trace-${now}-${Math.random()}`),
      timeout: context.timeout || 30000,
      startTime: now,
      ...context,
    };
    return this;
  }
  
  build(): UnifiedRequest {
    if (!this.request.id) {
      this.request.id = createId(`req-${Date.now()}-${Math.random()}`);
    }
    if (!this.request.service) {
      throw new Error('Service name is required');
    }
    if (!this.request.action) {
      throw new Error('Action is required');
    }
    if (!this.request.context) {
      this.withContext({});
    }
    
    return this.request as UnifiedRequest;
  }
}
