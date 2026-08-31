/**
 * COGNITIVE PLATFORM - CONFIGURATION LOADER
 * 
 * Loads configuration from YAML files and environment variables.
 * Supports hierarchical config with environment-specific overrides.
 */

import { resolve } from 'path';

export interface ServiceConfig {
  url?: string;
  host?: string;
  port?: number;
  timeout?: number;
  retry?: number;
  auth?: {
    username?: string;
    password?: string;
    token?: string;
  };
  [key: string]: any;
}

export interface CacheConfig {
  backend: 'redis' | 'memory' | 'hybrid';
  url?: string;
  ttl?: number;
  maxSize?: number;
}

export interface DatabaseConfig {
  url: string;
  pool?: {
    min: number;
    max: number;
  };
  ssl?: boolean;
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  services: {
    osint?: ServiceConfig;
    graph?: ServiceConfig;
    globe?: ServiceConfig;
    tda?: ServiceConfig;
    cache?: ServiceConfig;
    pipeline?: ServiceConfig;
  };
  database?: DatabaseConfig;
  cache?: CacheConfig;
  [key: string]: any;
}

/**
 * Configuration loader
 */
export class ConfigLoader {
  private config: AppConfig;

  constructor() {
    this.config = this.load();
  }

  /**
   * Load configuration from environment and files
   */
  private load(): AppConfig {
    const env = process.env.NODE_ENV || 'development';

    return {
      environment: env as any,
      port: parseInt(process.env.PORT || '3000'),
      logLevel: (process.env.LOG_LEVEL || 'info') as any,
      services: {
        osint: {
          url: process.env.OSINT_URL || 'http://localhost:5001',
          timeout: parseInt(process.env.OSINT_TIMEOUT || '30000'),
          retry: parseInt(process.env.OSINT_RETRY || '3'),
        },
        graph: {
          url: process.env.NEO4J_URL || 'bolt://localhost:7687',
          auth: {
            username: process.env.NEO4J_USER || 'neo4j',
            password: process.env.NEO4J_PASSWORD,
          },
        },
        globe: {
          url: process.env.GLOBE_URL || 'http://localhost:8080',
          timeout: parseInt(process.env.GLOBE_TIMEOUT || '30000'),
        },
        cache: {
          backend: (process.env.CACHE_BACKEND || 'redis') as any,
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          ttl: parseInt(process.env.CACHE_TTL || '3600'),
        },
        pipeline: {
          url: process.env.PIPELINE_URL || 'http://localhost:5001',
          timeout: parseInt(process.env.PIPELINE_TIMEOUT || '120000'),
        },
      },
      cache: {
        backend: (process.env.CACHE_BACKEND || 'redis') as any,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: parseInt(process.env.CACHE_TTL || '3600'),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
      },
      database: {
        url: process.env.DATABASE_URL || '',
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '2'),
          max: parseInt(process.env.DB_POOL_MAX || '10'),
        },
        ssl: process.env.DB_SSL === 'true',
      },
    };
  }

  /**
   * Get entire configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get service configuration
   */
  getServiceConfig(service: string): ServiceConfig | undefined {
    return this.config.services[service as keyof typeof this.config.services];
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig | undefined {
    return this.config.cache;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig | undefined {
    return this.config.database;
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.config.environment;
  }

  /**
   * Check if production
   */
  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Check if development
   */
  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  /**
   * Get configuration value with dot notation
   */
  get(path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        return defaultValue;
      }
    }

    return value;
  }
}

/**
 * Singleton config instance
 */
let configLoader: ConfigLoader | null = null;

/**
 * Get or create config loader
 */
export function getConfig(): ConfigLoader {
  if (!configLoader) {
    configLoader = new ConfigLoader();
  }
  return configLoader;
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  configLoader = null;
}
