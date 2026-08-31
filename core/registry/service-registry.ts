/**
 * COGNITIVE PLATFORM - SERVICE REGISTRY
 * 
 * Central registry for all services. Handles discovery, health checks,
 * routing, circuit breaking, and retry logic.
 */

import {
  IServiceNode,
  UnifiedRequest,
  UnifiedResponse,
  ServiceHealth,
  ServiceError,
  createId,
  createTimestamp,
  ID,
  Timestamp,
} from '../types/unified-contract';
import { ErrorCode, ErrorStatusMap } from '../types/error-codes';

interface ServiceEntry {
  service: IServiceNode;
  health: ServiceHealth;
  lastHealthCheck: Timestamp;
  failureCount: number;
  successCount: number;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt?: Timestamp;
}

interface RegistryConfig {
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Circuit breaker: max failures before opening */
  circuitBreakerThreshold: number;
  /** Circuit breaker: timeout before attempting recovery (ms) */
  circuitBreakerTimeoutMs: number;
  /** Retry attempts for failed requests */
  maxRetries: number;
  /** Retry backoff multiplier */
  retryBackoffMs: number;
}

const DEFAULT_CONFIG: RegistryConfig = {
  healthCheckIntervalMs: 30000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
  maxRetries: 3,
  retryBackoffMs: 1000,
};

/**
 * Central service registry and discovery
 */
export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();
  private config: RegistryConfig;
  private healthCheckInterval?: NodeJS.Timer;

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a service
   */
  register(name: string, service: IServiceNode): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, {
      service,
      health: {
        ready: false,
        status: 'down',
        latency: 0,
        lastCheck: createTimestamp(),
      },
      lastHealthCheck: createTimestamp(),
      failureCount: 0,
      successCount: 0,
      circuitBreakerOpen: false,
    });

    // Perform initial health check
    this.checkHealth(name);
  }

  /**
   * Unregister a service
   */
  unregister(name: string): void {
    this.services.delete(name);
  }

  /**
   * Get registered service names
   */
  getServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service health status
   */
  getHealth(name: string): ServiceHealth | null {
    const entry = this.services.get(name);
    return entry?.health ?? null;
  }

  /**
   * Get all services health
   */
  getAllHealth(): Record<string, ServiceHealth> {
    const result: Record<string, ServiceHealth> = {};
    for (const [name, entry] of this.services) {
      result[name] = entry.health;
    }
    return result;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const name of this.services.keys()) {
        await this.checkHealth(name);
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Check single service health
   */
  private async checkHealth(name: string): Promise<void> {
    const entry = this.services.get(name);
    if (!entry) return;

    try {
      const start = Date.now();
      const health = await entry.service.health();
      const latency = Date.now() - start;

      entry.health = {
        ...health,
        latency,
        lastCheck: createTimestamp(),
      };
      entry.lastHealthCheck = createTimestamp();

      // Update circuit breaker state
      if (health.ready && entry.circuitBreakerOpen) {
        entry.circuitBreakerOpen = false;
      }
    } catch (error) {
      entry.health = {
        ready: false,
        status: 'down',
        latency: 0,
        lastCheck: createTimestamp(),
        details: { error: String(error) },
      };
    }
  }

  /**
   * Execute request with retry logic and circuit breaking
   */
  async call<T = any>(
    req: UnifiedRequest<T>
  ): Promise<UnifiedResponse> {
    const entry = this.services.get(req.service);

    if (!entry) {
      return this.errorResponse(
        req.id,
        ErrorCode.SERVICE_NOT_FOUND,
        `Service '${req.service}' not registered`,
        req.context.startTime
      );
    }

    // Check circuit breaker
    if (entry.circuitBreakerOpen) {
      const now = Date.now() as Timestamp;
      const timeSinceOpen = now - (entry.circuitBreakerOpenedAt || now);

      if (timeSinceOpen < this.config.circuitBreakerTimeoutMs) {
        return this.errorResponse(
          req.id,
          ErrorCode.CIRCUIT_BREAKER_OPEN,
          `Service '${req.service}' circuit breaker is open`,
          req.context.startTime
        );
      }

      // Attempt to recover
      entry.circuitBreakerOpen = false;
      entry.failureCount = 0;
    }

    // Retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Check timeout
        const elapsed = Date.now() - (req.context.startTime as unknown as number);
        if (elapsed > req.context.timeout) {
          return this.errorResponse(
            req.id,
            ErrorCode.SERVICE_TIMEOUT,
            `Request timeout after ${elapsed}ms (limit: ${req.context.timeout}ms)`,
            req.context.startTime
          );
        }

        // Execute request
        const response = await entry.service.execute(req);

        // Success: reset failure count
        if (response.ok) {
          entry.failureCount = 0;
          entry.successCount++;
        } else {
          entry.failureCount++;
          throw new Error(response.error?.message || 'Service returned error');
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        entry.failureCount++;

        // Open circuit breaker on threshold
        if (entry.failureCount >= this.config.circuitBreakerThreshold) {
          entry.circuitBreakerOpen = true;
          entry.circuitBreakerOpenedAt = createTimestamp();

          return this.errorResponse(
            req.id,
            ErrorCode.CIRCUIT_BREAKER_OPEN,
            `Service '${req.service}' exceeded failure threshold`,
            req.context.startTime
          );
        }

        // Retry with backoff
        if (attempt < this.config.maxRetries) {
          const delayMs = this.config.retryBackoffMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
    }

    // All retries exhausted
    return this.errorResponse(
      req.id,
      ErrorCode.SERVICE_UNAVAILABLE,
      `Service '${req.service}' unavailable after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      req.context.startTime
    );
  }

  /**
   * Create error response
   */
  private errorResponse(
    id: ID,
    code: string,
    message: string,
    startTime: Timestamp
  ): UnifiedResponse {
    return {
      id,
      ok: false,
      error: { code, message },
      meta: {
        duration: Date.now() - (startTime as unknown as number),
        cached: false,
      },
    };
  }
}

/**
 * Singleton registry instance
 */
let registry: ServiceRegistry | null = null;

/**
 * Get or create global registry
 */
export function getRegistry(config?: Partial<RegistryConfig>): ServiceRegistry {
  if (!registry) {
    registry = new ServiceRegistry(config);
  }
  return registry;
}

/**
 * Reset registry (for testing)
 */
export function resetRegistry(): void {
  registry = null;
}
