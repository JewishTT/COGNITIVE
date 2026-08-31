/**
 * COGNITIVE PLATFORM - UNIFIED ERROR HANDLING
 * ===============================================
 * 
 * [38;5;240mCentralized Error Management System[0m
 * 
 * Features:
 * - Custom error class with context
 * - Error codes and types
 * - Stack traces
 * - Error serialization
 * - Error logging integration
 */

import { ServiceType, ErrorCode } from '../types';
import { logger } from '../logger';

// ============================================================================
// ERROR INTERFACES
// ============================================================================

/** Error context */
export interface ErrorContext {
  [key: string]: unknown;
  service?: ServiceType;
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

/** Serialized error */
export interface SerializedError {
  name: string;
  code: ErrorCode;
  message: string;
  statusCode: number;
  isOperational: boolean;
  timestamp: string;
  context: ErrorContext;
  stack?: string;
}

/** Error options */
export interface ErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  isOperational?: boolean;
  context?: ErrorContext;
  cause?: Error;
}

// ============================================================================
// ERROR CODES AND STATUS CODES
// ============================================================================

/** Error code to status code mapping */
export const ERROR_CODES: Record<ErrorCode, number> = {
  // Authentication errors
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  
  // Validation errors
  VALIDATION_ERROR: 400,
  
  // Resource errors
  NOT_FOUND: 404,
  CONFLICT: 409,
  
  // Rate limiting
  RATE_LIMITED: 429,
  
  // Server errors
  INTERNAL_ERROR: 500,
  CONNECTION_ERROR: 503,
  TIMEOUT_ERROR: 504,
  
  // Database errors
  DATABASE_NOT_CONNECTED: 503,
  DATABASE_CONNECTION_FAILED: 503,
  DATABASE_QUERY_FAILED: 500,
  DATABASE_WRITE_FAILED: 500,
  DATABASE_TRANSACTION_FAILED: 500,
  
  // Graph errors
  GRAPH_NOT_FOUND: 404,
  GRAPH_QUERY_FAILED: 400,
  GRAPH_WRITE_FAILED: 400,
  GRAPH_TRANSACTION_FAILED: 400,
  
  // Pipeline errors
  PIPELINE_NOT_FOUND: 404,
  PIPELINE_INACTIVE: 400,
  PIPELINE_EXECUTION_FAILED: 500,
  STEP_HANDLER_NOT_FOUND: 400,
  
  // TDA errors
  TDA_ANALYSIS_FAILED: 500,
  NO_NODES: 400,
  
  // AI errors
  AI_REQUEST_FAILED: 500,
  AI_MODEL_NOT_FOUND: 404,
  
  // Storage errors
  STORAGE_ERROR: 500,
  STORAGE_NOT_CONFIGURED: 500,
  
  // Cache errors
  CACHE_ERROR: 500,
  CACHE_NOT_CONFIGURED: 500,
  
  // Event bus errors
  EVENT_BUS_ERROR: 500,
  EVENT_BUS_NOT_CONFIGURED: 500,
  
  // Auth errors
  AUTH_ERROR: 500,
  AUTH_NOT_CONFIGURED: 500,
  
  // API errors
  API_ERROR: 500,
  API_NOT_AVAILABLE: 503,
};

/** Default error codes */
export const DEFAULT_ERROR_CODES = {
  UNKNOWN: 'INTERNAL_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
  CONNECTION: 'CONNECTION_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
} as const;

// ============================================================================
// COGNITIVE ERROR CLASS
// ============================================================================

/** Custom error class for COGNITIVE platform */
export class CognitiveError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context: ErrorContext;
  public readonly timestamp: string;
  public readonly service?: ServiceType;
  
  constructor(
    code: ErrorCode,
    message: string,
    service?: ServiceType,
    context: ErrorContext = {},
    options: ErrorOptions = {}
  ) {
    // Call parent constructor
    super(message);
    
    // Set name
    this.name = this.constructor.name;
    
    // Set error properties
    this.code = code;
    this.statusCode = options.statusCode || ERROR_CODES[code] || 500;
    this.isOperational = options.isOperational ?? true;
    this.context = { ...context, service };
    this.timestamp = new Date().toISOString();
    this.service = service;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /** Serialize error to JSON */
  public toJSON(): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      context: this.context,
      stack: config.get().env === 'development' ? this.stack : undefined,
    };
  }
  
  /** Convert to string */
  public toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
  
  /** Log the error */
  public log(): void {
    logger.error(this.message, {
      error: this,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      service: this.service,
    });
  }
  
  /** Check if error is of a specific type */
  public is(code: ErrorCode | ErrorCode[]): boolean {
    if (Array.isArray(code)) {
      return code.includes(this.code);
    }
    return this.code === code;
  }
  
  /** Create error from existing error */
  public static fromError(
    error: Error,
    code: ErrorCode = DEFAULT_ERROR_CODES.UNKNOWN,
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    const message = error.message || 'Unknown error';
    const cause = error.cause ? CognitiveError.fromError(error.cause as Error) : undefined;
    
    return new CognitiveError(
      code,
      message,
      service,
      { ...context, originalError: error.name, cause },
      { cause }
    );
  }
  
  /** Create validation error */
  public static validation(
    message: string,
    context: ErrorContext = {},
    service?: ServiceType
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.VALIDATION,
      message,
      service,
      context,
      { statusCode: 400 }
    );
  }
  
  /** Create not found error */
  public static notFound(
    resource: string,
    identifier?: string | number,
    service?: ServiceType
  ): CognitiveError {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    return new CognitiveError(
      DEFAULT_ERROR_CODES.NOT_FOUND,
      message,
      service,
      { resource, identifier },
      { statusCode: 404 }
    );
  }
  
  /** Create unauthorized error */
  public static unauthorized(
    message: string = 'Unauthorized',
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.UNAUTHORIZED,
      message,
      service,
      context,
      { statusCode: 401 }
    );
  }
  
  /** Create forbidden error */
  public static forbidden(
    message: string = 'Forbidden',
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.FORBIDDEN,
      message,
      service,
      context,
      { statusCode: 403 }
    );
  }
  
  /** Create conflict error */
  public static conflict(
    message: string,
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.CONFLICT,
      message,
      service,
      context,
      { statusCode: 409 }
    );
  }
  
  /** Create rate limited error */
  public static rateLimited(
    message: string = 'Rate limit exceeded',
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.RATE_LIMITED,
      message,
      service,
      context,
      { statusCode: 429 }
    );
  }
  
  /** Create internal error */
  public static internal(
    message: string = 'Internal server error',
    service?: ServiceType,
    context: ErrorContext = {}
  ): CognitiveError {
    return new CognitiveError(
      DEFAULT_ERROR_CODES.INTERNAL,
      message,
      service,
      context,
      { statusCode: 500, isOperational: false }
    );
  }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

/** Error handler configuration */
export interface ErrorHandlerConfig {
  logErrors: boolean;
  includeStack: boolean;
  format: 'json' | 'html' | 'text';
}

/** Error handler */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  
  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      logErrors: true,
      includeStack: config.get().env === 'development',
      format: 'json',
      ...config,
    };
  }
  
  /** Handle an error */
  public handle(error: Error | CognitiveError): SerializedError {
    // Convert to CognitiveError if needed
    const cognitiveError = error instanceof CognitiveError 
      ? error 
      : CognitiveError.fromError(error);
    
    // Log the error
    if (this.config.logErrors) {
      cognitiveError.log();
    }
    
    // Serialize
    const serialized = cognitiveError.toJSON();
    
    // Remove stack if not included
    if (!this.config.includeStack) {
      delete serialized.stack;
    }
    
    return serialized;
  }
  
  /** Handle async error */
  public async handleAsync<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.handle(error as Error);
    }
  }
  
  /** Create error response for HTTP */
  public createResponse(error: Error | CognitiveError): {
    statusCode: number;
    body: SerializedError;
  } {
    const serialized = this.handle(error);
    
    return {
      statusCode: serialized.statusCode,
      body: serialized,
    };
  }
}

// ============================================================================
// ERROR UTILITY FUNCTIONS
// ============================================================================

/** Check if error is a CognitiveError */
export function isCognitiveError(error: Error): error is CognitiveError {
  return error instanceof CognitiveError;
}

/** Convert any error to CognitiveError */
export function toCognitiveError(
  error: Error,
  code: ErrorCode = DEFAULT_ERROR_CODES.UNKNOWN,
  service?: ServiceType,
  context: ErrorContext = {}
): CognitiveError {
  if (isCognitiveError(error)) {
    return error;
  }
  return CognitiveError.fromError(error, code, service, context);
}

/** Wrap function to catch and convert errors */
export function wrapErrors<T extends unknown[], R>(
  fn: (...args: T) => R,
  service?: ServiceType
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      throw toCognitiveError(error as Error, DEFAULT_ERROR_CODES.INTERNAL, service);
    }
  };
}

/** Wrap async function to catch and convert errors */
export function wrapAsyncErrors<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  service?: ServiceType
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw toCognitiveError(error as Error, DEFAULT_ERROR_CODES.INTERNAL, service);
    }
  };
}

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

let globalErrorHandler: ErrorHandler | null = null;

/** Get or create global error handler */
export function getErrorHandler(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(config);
  }
  return globalErrorHandler;
}

/** Handle error globally */
export function handleError(error: Error | CognitiveError): SerializedError {
  return getErrorHandler().handle(error);
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  CognitiveError,
  ErrorHandler,
  ErrorContext,
  SerializedError,
  ErrorOptions,
  ERROR_CODES,
  DEFAULT_ERROR_CODES,
  isCognitiveError,
  toCognitiveError,
  wrapErrors,
  wrapAsyncErrors,
  getErrorHandler,
  handleError,
};

// Re-export from types
export type { ErrorCode, ServiceType };
