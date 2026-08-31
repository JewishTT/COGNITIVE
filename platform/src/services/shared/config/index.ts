// platform/src/services/shared/config/index.ts
// [38;5;240mShared Configuration for OSINT Microservices Architecture[0m

import { CacheStrategy, CacheConfig } from '../types';

// ============================================================================
// [38;5;220mENVIRONMENT CONFIGURATION[0m
// ============================================================================

export interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  
  // Services
  PIPELINE_SERVICE_URL: string;
  GRAPH_SERVICE_URL: string;
  TDA_SERVICE_URL: string;
  UI_SERVICE_URL: string;
  
  // Databases
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
  NEO4J_DATABASE: string;
  
  REDIS_URI: string;
  REDIS_PASSWORD?: string;
  
  // External APIs
  FLOWSINT_API_URL: string;
  FLOWSINT_API_KEY?: string;
  
  OPENCTI_API_URL?: string;
  OPENCTI_API_KEY?: string;
  
  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // CORS
  CORS_ORIGIN: string;
  CORS_METHODS: string;
  CORS_HEADERS: string;
  
  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  LOG_FORMAT: 'json' | 'pretty';
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: number; // in milliseconds
  RATE_LIMIT_MAX: number;
  
  // Cache
  CACHE_STRATEGY: CacheStrategy;
  CACHE_TTL: number; // in seconds
  CACHE_MAX_SIZE: number;
}

// ============================================================================
// [38;5;220mDEFAULT CONFIGURATION[0m
// ============================================================================

export const DEFAULT_CONFIG: EnvironmentConfig = {
  // Application
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  HOST: process.env.HOST || 'localhost',
  
  // Services
  PIPELINE_SERVICE_URL: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3001',
  GRAPH_SERVICE_URL: process.env.GRAPH_SERVICE_URL || 'http://localhost:3002',
  TDA_SERVICE_URL: process.env.TDA_SERVICE_URL || 'http://localhost:3003',
  UI_SERVICE_URL: process.env.UI_SERVICE_URL || 'http://localhost:5173',
  
  // Databases
  NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
  NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'password',
  NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'osint',
  
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  
  // External APIs
  FLOWSINT_API_URL: process.env.FLOWSINT_API_URL || 'http://localhost:8080',
  FLOWSINT_API_KEY: process.env.FLOWSINT_API_KEY,
  
  OPENCTI_API_URL: process.env.OPENCTI_API_URL || 'https://demo.opencti.io',
  OPENCTI_API_KEY: process.env.OPENCTI_API_KEY,
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CORS_METHODS: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  CORS_HEADERS: process.env.CORS_HEADERS || 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
  
  // Logging
  LOG_LEVEL: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  LOG_FORMAT: (process.env.LOG_FORMAT as 'json' | 'pretty') || 'pretty',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  
  // Cache
  CACHE_STRATEGY: (process.env.CACHE_STRATEGY as CacheStrategy) || 'memory',
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
  CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
};

// ============================================================================
// [38;5;220mCONFIGURATION LOADER[0m
// ============================================================================

/**
 * [38;5;220mLoad configuration from environment variables[0m
 */
export function loadConfig(): EnvironmentConfig {
  return {
    ...DEFAULT_CONFIG,
    // Override with environment variables
    ...Object.entries(DEFAULT_CONFIG).reduce((acc, [key, value]) => {
      const envKey = key as keyof EnvironmentConfig;
      const envValue = process.env[key];
      
      if (envValue !== undefined) {
        // Handle numeric values
        if (typeof value === 'number') {
          acc[envKey] = parseInt(envValue) as any;
        }
        // Handle boolean values
        else if (envValue.toLowerCase() === 'true' || envValue.toLowerCase() === 'false') {
          acc[envKey] = envValue.toLowerCase() === 'true' as any;
        }
        // Handle string values
        else {
          acc[envKey] = envValue as any;
        }
      }
      
      return acc;
    }, {} as Partial<EnvironmentConfig>),
  };
}

/**
 * [38;5;220mGet configuration instance[0m
 */
let configInstance: EnvironmentConfig | null = null;

export function getConfig(): EnvironmentConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * [38;5;220mReset configuration (useful for testing)[0m
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * [38;5;220mValidate configuration[0m
 */
export function validateConfig(config: EnvironmentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required configuration for production
  if (config.NODE_ENV === 'production') {
    if (!config.JWT_SECRET || config.JWT_SECRET === DEFAULT_CONFIG.JWT_SECRET) {
      errors.push('JWT_SECRET must be set in production');
    }
    
    if (!config.NEO4J_PASSWORD || config.NEO4J_PASSWORD === DEFAULT_CONFIG.NEO4J_PASSWORD) {
      errors.push('NEO4J_PASSWORD must be set in production');
    }
  }
  
  // Check port ranges
  if (config.PORT < 1024 || config.PORT > 65535) {
    errors.push('PORT must be between 1024 and 65535');
  }
  
  // Check cache TTL
  if (config.CACHE_TTL < 0) {
    errors.push('CACHE_TTL must be non-negative');
  }
  
  // Check rate limit values
  if (config.RATE_LIMIT_WINDOW < 0) {
    errors.push('RATE_LIMIT_WINDOW must be non-negative');
  }
  
  if (config.RATE_LIMIT_MAX < 1) {
    errors.push('RATE_LIMIT_MAX must be at least 1');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// [38;5;220mSERVICE-SPECIFIC CONFIGURATION[0m
// ============================================================================

/**
 * [38;5;220mPipeline Service Configuration[0m
 */
export interface PipelineServiceConfig {
  maxConcurrentRuns: number;
  defaultTimeout: number; // in seconds
  maxRetries: number;
  queueName: string;
  resultStoragePath: string;
  tempDir: string;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineServiceConfig = {
  maxConcurrentRuns: parseInt(process.env.PIPELINE_MAX_CONCURRENT_RUNS || '5'),
  defaultTimeout: parseInt(process.env.PIPELINE_DEFAULT_TIMEOUT || '3600'), // 1 hour
  maxRetries: parseInt(process.env.PIPELINE_MAX_RETRIES || '3'),
  queueName: process.env.PIPELINE_QUEUE_NAME || 'pipeline-queue',
  resultStoragePath: process.env.PIPELINE_RESULT_STORAGE || './storage/pipeline',
  tempDir: process.env.PIPELINE_TEMP_DIR || './temp/pipeline',
};

/**
 * [38;5;220mGraph Service Configuration[0m
 */
export interface GraphServiceConfig {
  maxGraphSize: number; // max nodes per graph
  maxEdgeCount: number; // max edges per graph
  backupEnabled: boolean;
  backupInterval: number; // in seconds
  backupPath: string;
  versioningEnabled: boolean;
}

export const DEFAULT_GRAPH_CONFIG: GraphServiceConfig = {
  maxGraphSize: parseInt(process.env.GRAPH_MAX_SIZE || '10000'),
  maxEdgeCount: parseInt(process.env.GRAPH_MAX_EDGES || '100000'),
  backupEnabled: process.env.GRAPH_BACKUP_ENABLED?.toLowerCase() === 'true',
  backupInterval: parseInt(process.env.GRAPH_BACKUP_INTERVAL || '86400'), // 24 hours
  backupPath: process.env.GRAPH_BACKUP_PATH || './storage/graph-backups',
  versioningEnabled: process.env.GRAPH_VERSIONING_ENABLED?.toLowerCase() !== 'false',
};

/**
 * [38;5;220mTDA Service Configuration[0m
 */
export interface TdaServiceConfig {
  maxGraphSize: number; // max nodes for TDA analysis
  maxDimension: number; // max homology dimension
  defaultMode: string;
  resultCacheEnabled: boolean;
  resultCacheTTL: number; // in seconds
}

export const DEFAULT_TDA_CONFIG: TdaServiceConfig = {
  maxGraphSize: parseInt(process.env.TDA_MAX_GRAPH_SIZE || '5000'),
  maxDimension: parseInt(process.env.TDA_MAX_DIMENSION || '3'),
  defaultMode: process.env.TDA_DEFAULT_MODE || 'flag',
  resultCacheEnabled: process.env.TDA_RESULT_CACHE_ENABLED?.toLowerCase() !== 'false',
  resultCacheTTL: parseInt(process.env.TDA_RESULT_CACHE_TTL || '3600'), // 1 hour
};

/**
 * [38;5;220mUI Service Configuration[0m
 */
export interface UiServiceConfig {
  devServerPort: number;
  devServerHost: string;
  buildOutputPath: string;
  publicPath: string;
}

export const DEFAULT_UI_CONFIG: UiServiceConfig = {
  devServerPort: parseInt(process.env.UI_DEV_SERVER_PORT || '5173'),
  devServerHost: process.env.UI_DEV_SERVER_HOST || 'localhost',
  buildOutputPath: process.env.UI_BUILD_OUTPUT_PATH || './dist',
  publicPath: process.env.UI_PUBLIC_PATH || '/',
};

// ============================================================================
// [38;5;220mCONFIGURATION HELPERS[0m
// ============================================================================

/**
 * [38;5;220mGet configuration value with type safety[0m
 */
export function getConfigValue<T>(key: keyof EnvironmentConfig): T {
  const config = getConfig();
  return config[key] as T;
}

/**
 * [38;5;220mCheck if running in development mode[0m
 */
export function isDev(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * [38;5;220mCheck if running in production mode[0m
 */
export function isProd(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * [38;5;220mCheck if running in test mode[0m
 */
export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

// ============================================================================
// [38;5;220mEXPORT ALL CONFIGURATIONS[0m
// ============================================================================

export {
  DEFAULT_CONFIG,
  DEFAULT_PIPELINE_CONFIG,
  DEFAULT_GRAPH_CONFIG,
  DEFAULT_TDA_CONFIG,
  DEFAULT_UI_CONFIG,
  loadConfig,
  getConfig,
  resetConfig,
  validateConfig,
  getConfigValue,
  isDev,
  isProd,
  isTest,
};
