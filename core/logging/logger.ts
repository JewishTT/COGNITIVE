/**
 * COGNITIVE PLATFORM - LOGGER
 * 
 * Structured logging with trace ID support.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  service: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Structured logger with trace context
 */
export class Logger {
  constructor(private service: string) {}

  debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, any>): void {
    this.log('error', message, data);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, any>
  ): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      service: this.service,
      message,
      data,
    };

    const logFn = console[level as any] || console.log;
    logFn(JSON.stringify(entry));
  }
}
