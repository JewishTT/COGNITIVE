/**
 * COGNITIVE PLATFORM - BASE SERVICE CLASS
 * 
 * Abstract base class for all services with common functionality.
 */

import {
  IServiceNode,
  UnifiedRequest,
  UnifiedResponse,
  ServiceHealth,
  ServiceError,
  ServiceContext,
  createTimestamp,
  ID,
} from '../types/unified-contract';
import { ErrorCode } from '../types/error-codes';
import { Logger } from '../logging/logger';

/**
 * Base service implementation
 */
export abstract class BaseService implements IServiceNode {
  readonly name: string;
  readonly version: string;
  protected logger: Logger;
  protected metrics = {
    requests: 0,
    successCount: 0,
    errorCount: 0,
    totalDuration: 0,
  };

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
    this.logger = new Logger(name);
  }

  /**
   * Service health check - override in subclasses
   */
  async health(): Promise<ServiceHealth> {
    return {
      ready: true,
      status: 'up',
      latency: 0,
      lastCheck: createTimestamp(),
      version: this.version,
    };
  }

  /**
   * Execute request - routes to specific handler
   */
  async execute<T = any>(req: UnifiedRequest<T>): Promise<UnifiedResponse> {
    const start = Date.now();
    this.metrics.requests++;

    try {
      this.logger.debug(`Executing ${req.action}`, {
        traceId: req.context.traceId,
        service: req.service,
        action: req.action,
      });

      // Get handler method
      const handler = (this as any)[`handle${this.capitalize(req.action)}`];

      if (!handler || typeof handler !== 'function') {
        return this.errorResponse(
          req.id,
          ErrorCode.INVALID_REQUEST,
          `Unknown action: ${req.action}`,
          start
        );
      }

      // Call handler
      const data = await handler.call(this, req.payload, req.context);

      this.metrics.successCount++;
      const duration = Date.now() - start;
      this.metrics.totalDuration += duration;

      this.logger.debug(`Request completed`, {
        traceId: req.context.traceId,
        duration,
        action: req.action,
      });

      return {
        id: req.id,
        ok: true,
        data,
        meta: {
          duration,
          cached: false,
          version: this.version,
          metrics: {
            totalRequests: this.metrics.requests,
            avgDuration: Math.round(
              this.metrics.totalDuration / this.metrics.requests
            ),
          },
        },
      };
    } catch (error) {
      this.metrics.errorCount++;
      const duration = Date.now() - start;

      this.logger.error(`Request failed`, {
        traceId: req.context.traceId,
        error: String(error),
        duration,
      });

      return this.errorResponse(
        req.id,
        ErrorCode.INTERNAL_ERROR,
        String(error),
        start,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgDuration:
        this.metrics.requests > 0
          ? Math.round(this.metrics.totalDuration / this.metrics.requests)
          : 0,
    };
  }

  /**
   * Create error response
   */
  protected errorResponse(
    id: ID,
    code: string,
    message: string,
    startTime: number,
    stack?: string
  ): UnifiedResponse {
    const error: ServiceError = { code, message };
    if (stack) {
      error.stack = stack;
    }

    return {
      id,
      ok: false,
      error,
      meta: {
        duration: Date.now() - startTime,
        cached: false,
        version: this.version,
      },
    };
  }

  /**
   * Create success response
   */
  protected successResponse<T>(
    id: ID,
    data: T,
    startTime: number,
    cached = false
  ): UnifiedResponse<T> {
    return {
      id,
      ok: true,
      data,
      meta: {
        duration: Date.now() - startTime,
        cached,
        version: this.version,
      },
    };
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
