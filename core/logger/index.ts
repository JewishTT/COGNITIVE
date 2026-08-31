/**
 * COGNITIVE PLATFORM - UNIFIED LOGGING SYSTEM
 * ============================================
 * 
 * [38;5;240mCentralized Logging with Multiple Transports[0m
 * 
 * Features:
 * - Multiple log levels
 * - Multiple transports (console, file, external)
 * - Structured logging
 * - Context support
 * - Performance metrics
 * - Error tracking
 */

import { config } from '../config';
import { ID, ISODateString } from '../types';
import { CognitiveError } from '../errors';

// ============================================================================
// LOG LEVELS
// ============================================================================

/** Log level */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

/** Log level priority */
export const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// ============================================================================
// LOG ENTRY
// ============================================================================

/** Log entry */
export interface LogEntry {
  id: ID;
  level: LogLevel;
  message: string;
  timestamp: ISODateString;
  context?: Record<string, unknown>;
  error?: Error | CognitiveError;
  duration?: number;
  service?: string;
  method?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

/** Serialized log entry */
export interface SerializedLogEntry extends Omit<LogEntry, 'error'> {
  error?: string;
  stack?: string;
}

// ============================================================================
// LOG TRANSPORT
// ============================================================================

/** Log transport interface */
export interface LogTransport {
  log(entry: SerializedLogEntry): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/** Console transport */
export class ConsoleTransport implements LogTransport {
  private format: 'json' | 'pretty';
  
  constructor(format: 'json' | 'pretty' = 'json') {
    this.format = format;
  }
  
  async log(entry: SerializedLogEntry): Promise<void> {
    const formatted = this.formatEntry(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      case 'trace':
        console.trace(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
  
  private formatEntry(entry: SerializedLogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }
    
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const message = entry.message;
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? ` error="${entry.error}"` : '';
    
    return `[${timestamp}] [${level}] ${message}${context}${error}`;
  }
}

/** File transport */
export class FileTransport implements LogTransport {
  private path: string;
  private format: 'json' | 'text';
  private stream: NodeJS.WritableStream | null = null;
  
  constructor(path: string, format: 'json' | 'text' = 'json') {
    this.path = path;
    this.format = format;
    this.open();
  }
  
  private open(): void {
    const fs = require('fs');
    const path = require('path');
    
    // Ensure directory exists
    const dir = path.dirname(this.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Open stream
    this.stream = fs.createWriteStream(this.path, { flags: 'a' });
    
    // Handle errors
    this.stream.on('error', (error: Error) => {
      console.error('File transport error:', error);
    });
  }
  
  async log(entry: SerializedLogEntry): Promise<void> {
    if (!this.stream) {
      this.open();
    }
    
    if (this.stream) {
      const formatted = this.format === 'json' 
        ? JSON.stringify(entry) + '\n'
        : this.formatText(entry) + '\n';
      
      this.stream.write(formatted);
    }
  }
  
  private formatText(entry: SerializedLogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const message = entry.message;
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? ` error="${entry.error}"` : '';
    
    return `[${timestamp}] [${level}] ${message}${context}${error}`;
  }
  
  async flush(): Promise<void> {
    if (this.stream) {
      await new Promise<void>((resolve) => {
        this.stream!.end(resolve);
      });
    }
  }
  
  async close(): Promise<void> {
    await this.flush();
    this.stream = null;
  }
}

/** External transport (for log aggregation services) */
export class ExternalTransport implements LogTransport {
  private url: string;
  private headers: Record<string, string>;
  private queue: SerializedLogEntry[] = [];
  private isSending: boolean = false;
  
  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = { 'Content-Type': 'application/json', ...headers };
  }
  
  async log(entry: SerializedLogEntry): Promise<void> {
    this.queue.push(entry);
    
    if (!this.isSending) {
      this.sendQueue();
    }
  }
  
  private async sendQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    
    this.isSending = true;
    
    try {
      const batch = this.queue.splice(0, 100); // Send in batches of 100
      
      // In a real implementation, use fetch or axios
      // For now, just log to console
      console.log(`Sending ${batch.length} log entries to ${this.url}`);
    } catch (error) {
      console.error('Failed to send logs:', error);
    } finally {
      this.isSending = false;
      
      // Process remaining queue
      if (this.queue.length > 0) {
        setImmediate(() => this.sendQueue());
      }
    }
  }
  
  async flush(): Promise<void> {
    await this.sendQueue();
  }
  
  async close(): Promise<void> {
    await this.flush();
  }
}

// ============================================================================
// LOGGER CLASS
// ============================================================================

/** Logger configuration */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  transports: ('console' | 'file' | 'external')[];
  filePath?: string;
  externalUrl?: string;
  include: {
    timestamp: boolean;
    level: boolean;
    message: boolean;
    context: boolean;
    error: boolean;
    service: boolean;
    method: boolean;
    userId: boolean;
    sessionId: boolean;
    requestId: boolean;
  };
  performance: boolean;
}

/** Logger */
export class Logger {
  private config: LoggerConfig;
  private transports: LogTransport[];
  private context: Record<string, unknown> = {};
  
  constructor(config: Partial<LoggerConfig> = {}) {
    const dbConfig = config.get().log;
    
    this.config = {
      level: dbConfig.level || 'info',
      format: dbConfig.format || 'json',
      transports: ['console'],
      include: {
        timestamp: true,
        level: true,
        message: true,
        context: true,
        error: true,
        service: true,
        method: true,
        userId: true,
        sessionId: true,
        requestId: true,
      },
      performance: false,
      ...config,
    };
    
    this.transports = this.createTransports();
  }
  
  /** Create transports based on configuration */
  private createTransports(): LogTransport[] {
    const transports: LogTransport[] = [];
    
    for (const transport of this.config.transports) {
      switch (transport) {
        case 'console':
          transports.push(new ConsoleTransport(this.config.format));
          break;
        case 'file':
          if (this.config.filePath) {
            transports.push(new FileTransport(this.config.filePath, this.config.format));
          }
          break;
        case 'external':
          if (this.config.externalUrl) {
            transports.push(new ExternalTransport(this.config.externalUrl));
          }
          break;
      }
    }
    
    return transports;
  }
  
  /** Log a message */
  public async log(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    // Check if level is enabled
    if (LOG_LEVELS[level] > LOG_LEVELS[this.config.level]) {
      return;
    }
    
    const entry: LogEntry = {
      id: this.generateId(),
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context },
    };
    
    const serialized = this.serialize(entry);
    
    // Log to all transports
    for (const transport of this.transports) {
      try {
        await transport.log(serialized);
      } catch (error) {
        console.error('Transport error:', error);
      }
    }
  }
  
  /** Serialize log entry */
  private serialize(entry: LogEntry): SerializedLogEntry {
    const serialized: SerializedLogEntry = {
      ...entry,
    };
    
    // Serialize error
    if (entry.error) {
      serialized.error = entry.error.message;
      if (this.config.format === 'json') {
        serialized.stack = entry.error.stack;
      }
    }
    
    // Remove undefined values
    Object.keys(serialized).forEach(key => {
      if (serialized[key as keyof SerializedLogEntry] === undefined) {
        delete serialized[key as keyof SerializedLogEntry];
      }
    });
    
    return serialized;
  }
  
  /** Generate unique ID */
  private generateId(): ID {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Add context to logger */
  public withContext(context: Record<string, unknown>): Logger {
    const newLogger = new Logger(this.config);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }
  
  /** Create a child logger with additional context */
  public child(context: Record<string, unknown>): Logger {
    return this.withContext(context);
  }
  
  /** Measure execution time */
  public async measure<T>(
    message: string,
    fn: () => Promise<T> | T,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await Promise.resolve(fn());
      const duration = performance.now() - start;
      
      if (this.config.performance) {
        await this.log('debug', message, { ...context, duration });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      if (this.config.performance) {
        await this.log('error', `${message} failed`, { 
          ...context, 
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      throw error;
    }
  }
  
  /** Error method */
  public async error(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log('error', message, context);
  }
  
  /** Warn method */
  public async warn(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log('warn', message, context);
  }
  
  /** Info method */
  public async info(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log('info', message, context);
  }
  
  /** Debug method */
  public async debug(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log('debug', message, context);
  }
  
  /** Trace method */
  public async trace(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log('trace', message, context);
  }
  
  /** Flush all transports */
  public async flush(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.flush) {
        await transport.flush();
      }
    }
  }
  
  /** Close all transports */
  public async close(): Promise<void> {
    await this.flush();
    
    for (const transport of this.transports) {
      if (transport.close) {
        await transport.close();
      }
    }
  }
}

// ============================================================================
// SINGLETON LOGGER
// ============================================================================

let loggerInstance: Logger | null = null;

/** Get or create singleton logger */
export function getLogger(context?: Record<string, unknown>): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  
  if (context) {
    return loggerInstance.child(context);
  }
  
  return loggerInstance;
}

/** Global logger instance */
export const logger = getLogger();

// ============================================================================
// LOG UTILITY FUNCTIONS
// ============================================================================

/** Create a logger for a specific service */
export function createServiceLogger(service: string): Logger {
  return getLogger().child({ service });
}

/** Create a logger for a specific request */
export function createRequestLogger(requestId: string): Logger {
  return getLogger().child({ requestId });
}

/** Create a logger for a specific user */
export function createUserLogger(userId: string): Logger {
  return getLogger().child({ userId });
}

/** Log an error */
export function logError(
  error: Error | CognitiveError,
  context: Record<string, unknown> = {}
): void {
  if (error instanceof CognitiveError) {
    logger.error(error.message, { ...context, error: error.toJSON() });
  } else {
    logger.error(error.message, { 
      ...context, 
      error: error.message,
      stack: error.stack,
    });
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  Logger,
  ConsoleTransport,
  FileTransport,
  ExternalTransport,
  LoggerConfig,
  LogEntry,
  SerializedLogEntry,
  getLogger,
  createServiceLogger,
  createRequestLogger,
  createUserLogger,
  logError,
};

// Re-export from types
export type { ID, ISODateString };
