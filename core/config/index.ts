/**
 * COGNITIVE PLATFORM - UNIFIED CONFIGURATION SYSTEM
 * ====================================================
 * 
 * [38;5;240mSingle Configuration for All Services[0m
 * 
 * Features:
 * - Environment variable management
 * - Validation with Joi/Zod
 * - Default values
 * - Multi-environment support
 * - Hot reloading (development)
 */

import { z } from 'zod';

// ============================================================================
// ENVIRONMENT SCHEMA
// ============================================================================

/** Environment variables schema */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  HOST: z.string().default('0.0.0.0'),
  
  // Frontend
  VITE_API_URL: z.string().default('http://localhost:8000'),
  VITE_WS_URL: z.string().default('ws://localhost:8000'),
  VITE_APP_NAME: z.string().default('COGNITIVE Platform'),
  VITE_APP_VERSION: z.string().default('2.0.0'),
  
  // Backend
  API_PREFIX: z.string().default('/api/v1'),
  API_TIMEOUT: z.coerce.number().default(30000),
  
  // Neo4j
  NEO4J_URI: z.string().default('bolt://neo4j:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('password'),
  NEO4J_DATABASE: z.string().optional(),
  NEO4J_MAX_CONNECTION_POOL_SIZE: z.coerce.number().default(50),
  NEO4J_CONNECTION_TIMEOUT: z.coerce.number().default(30000),
  
  // Redis
  REDIS_URL: z.string().default('redis://redis:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_MAX_MEMORY: z.string().default('256mb'),
  
  // Cesium (Globe)
  CESIUM_TOKEN: z.string().optional(),
  CESIUM_BASE_URL: z.string().default('https://cesium.com'),
  
  // Authentication
  JWT_SECRET: z.string().default('cognitive-secret-key-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Cache
  CACHE_BACKEND: z.enum(['memory', 'localStorage', 'redis', 'hybrid']).default('hybrid'),
  CACHE_TTL: z.coerce.number().default(3600), // 1 hour
  CACHE_MAX_SIZE: z.coerce.number().default(256), // 256MB
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_FILE: z.string().optional(),
  
  // Monitoring
  METRICS_ENABLED: z.coerce.boolean().default(false),
  METRICS_PORT: z.coerce.number().default(9090),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_METHODS: z.string().default('GET,POST,PUT,PATCH,DELETE,OPTIONS'),
  CORS_HEADERS: z.string().default('*'),
  
  // Pipeline
  PIPELINE_WORKERS: z.coerce.number().default(4),
  PIPELINE_MAX_QUEUE_SIZE: z.coerce.number().default(100),
  PIPELINE_RETRY_ATTEMPTS: z.coerce.number().default(3),
  
  // TDA
  TDA_MAX_SIMPLICES: z.coerce.number().default(10000),
  TDA_DEFAULT_RADIUS: z.coerce.number().default(1.0),
  TDA_PERSISTENCE_THRESHOLD: z.coerce.number().default(0.5),
  
  // AI/Factory
  AI_MAX_CONCURRENT_REQUESTS: z.coerce.number().default(10),
  AI_REQUEST_TIMEOUT: z.coerce.number().default(60000),
  
  // Storage
  STORAGE_TYPE: z.enum(['neo4j', 'redis', 'local', 's3', 'mongo']).default('neo4j'),
  STORAGE_PATH: z.string().default('./data/storage'),
  
  // Security
  SESSION_SECRET: z.string().default('cognitive-session-secret'),
  CSRF_ENABLED: z.coerce.boolean().default(true),
  HELMET_ENABLED: z.coerce.boolean().default(true),
  
  // Features
  FEATURE_TDA_ENABLED: z.coerce.boolean().default(true),
  FEATURE_AI_ENABLED: z.coerce.boolean().default(true),
  FEATURE_GLOBE_ENABLED: z.coerce.boolean().default(true),
  FEATURE_PIPELINE_ENABLED: z.coerce.boolean().default(true),
  
  // Debug
  DEBUG: z.coerce.boolean().default(false),
  DEBUG_PORT: z.coerce.number().default(9229),
});

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/** Database configuration */
export interface DatabaseConfig {
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database?: string;
    maxConnectionPoolSize: number;
    connectionTimeout: number;
  };
  redis: {
    url: string;
    password?: string;
    db: number;
    maxMemory: string;
  };
}

/** Cache configuration */
export interface CacheConfig {
  backend: 'memory' | 'localStorage' | 'redis' | 'hybrid';
  ttl: number;
  maxSize: number;
  primary?: 'memory' | 'localStorage' | 'redis';
  fallback?: ('memory' | 'localStorage' | 'redis')[];
}

/** Authentication configuration */
export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  session: {
    secret: string;
  };
  csrf: {
    enabled: boolean;
  };
}

/** API configuration */
export interface ApiConfig {
  prefix: string;
  timeout: number;
  cors: {
    origin: string;
    methods: string;
    headers: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

/** Cesium/Globe configuration */
export interface GlobeConfig {
  token?: string;
  baseUrl: string;
  defaultView?: {
    position: { x: number; y: number; z: number };
    target?: { x: number; y: number; z: number };
    zoom?: number;
  };
  maxNodes: number;
}

/** Pipeline configuration */
export interface PipelineConfig {
  workers: number;
  maxQueueSize: number;
  retryAttempts: number;
}

/** TDA configuration */
export interface TdaConfig {
  maxSimplices: number;
  defaultRadius: number;
  persistenceThreshold: number;
}

/** AI/Factory configuration */
export interface AiConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  models: {
    embedding?: {
      provider: string;
      model: string;
      apiKey?: string;
    };
    classification?: {
      provider: string;
      model: string;
      apiKey?: string;
    };
  };
}

/** Logging configuration */
export interface LogConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  format: 'json' | 'pretty';
  file?: string;
}

/** Monitoring configuration */
export interface MonitorConfig {
  enabled: boolean;
  port: number;
}

/** Feature flags */
export interface FeatureConfig {
  tda: boolean;
  ai: boolean;
  globe: boolean;
  pipeline: boolean;
  analytics: boolean;
}

/** Storage configuration */
export interface StorageConfig {
  type: 'neo4j' | 'redis' | 'local' | 's3' | 'mongo';
  path?: string;
  // Additional config for specific storage types
  [key: string]: unknown;
}

/** Main configuration */
export interface Config {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  
  // Service configurations
  database: DatabaseConfig;
  cache: CacheConfig;
  auth: AuthConfig;
  api: ApiConfig;
  globe: GlobeConfig;
  pipeline: PipelineConfig;
  tda: TdaConfig;
  ai: AiConfig;
  log: LogConfig;
  monitor: MonitorConfig;
  features: FeatureConfig;
  storage: StorageConfig;
  
  // Frontend
  frontend: {
    apiUrl: string;
    wsUrl: string;
    appName: string;
    appVersion: string;
  };
  
  // Security
  security: {
    helmet: boolean;
    csrf: boolean;
    debug: boolean;
    debugPort: number;
  };
}

// ============================================================================
// CONFIGURATION CLASS
// ============================================================================

/** Unified configuration manager */
export class CognitiveConfig {
  private static instance: CognitiveConfig;
  private config: Config;
  
  private constructor() {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);
    
    // Build configuration
    this.config = {
      env: env.NODE_ENV,
      host: env.HOST,
      port: env.PORT,
      
      database: {
        neo4j: {
          uri: env.NEO4J_URI,
          user: env.NEO4J_USER,
          password: env.NEO4J_PASSWORD,
          database: env.NEO4J_DATABASE,
          maxConnectionPoolSize: env.NEO4J_MAX_CONNECTION_POOL_SIZE,
          connectionTimeout: env.NEO4J_CONNECTION_TIMEOUT,
        },
        redis: {
          url: env.REDIS_URL,
          password: env.REDIS_PASSWORD,
          db: env.REDIS_DB,
          maxMemory: env.REDIS_MAX_MEMORY,
        },
      },
      
      cache: {
        backend: env.CACHE_BACKEND,
        ttl: env.CACHE_TTL,
        maxSize: env.CACHE_MAX_SIZE,
        primary: env.CACHE_BACKEND,
        fallback: env.CACHE_BACKEND === 'hybrid' ? ['memory', 'localStorage', 'redis'] : undefined,
      },
      
      auth: {
        jwt: {
          secret: env.JWT_SECRET,
          expiresIn: env.JWT_EXPIRES_IN,
          refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
        },
        session: {
          secret: env.SESSION_SECRET,
        },
        csrf: {
          enabled: env.CSRF_ENABLED,
        },
      },
      
      api: {
        prefix: env.API_PREFIX,
        timeout: env.API_TIMEOUT,
        cors: {
          origin: env.CORS_ORIGIN,
          methods: env.CORS_METHODS,
          headers: env.CORS_HEADERS,
        },
        rateLimit: {
          windowMs: env.RATE_LIMIT_WINDOW_MS,
          maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
        },
      },
      
      globe: {
        token: env.CESIUM_TOKEN,
        baseUrl: env.CESIUM_BASE_URL,
        maxNodes: 10000,
      },
      
      pipeline: {
        workers: env.PIPELINE_WORKERS,
        maxQueueSize: env.PIPELINE_MAX_QUEUE_SIZE,
        retryAttempts: env.PIPELINE_RETRY_ATTEMPTS,
      },
      
      tda: {
        maxSimplices: env.TDA_MAX_SIMPLICES,
        defaultRadius: env.TDA_DEFAULT_RADIUS,
        persistenceThreshold: env.TDA_PERSISTENCE_THRESHOLD,
      },
      
      ai: {
        maxConcurrentRequests: env.AI_MAX_CONCURRENT_REQUESTS,
        requestTimeout: env.AI_REQUEST_TIMEOUT,
        models: {},
      },
      
      log: {
        level: env.LOG_LEVEL,
        format: env.LOG_FORMAT,
        file: env.LOG_FILE,
      },
      
      monitor: {
        enabled: env.METRICS_ENABLED,
        port: env.METRICS_PORT,
      },
      
      features: {
        tda: env.FEATURE_TDA_ENABLED,
        ai: env.FEATURE_AI_ENABLED,
        globe: env.FEATURE_GLOBE_ENABLED,
        pipeline: env.FEATURE_PIPELINE_ENABLED,
        analytics: true,
      },
      
      storage: {
        type: env.STORAGE_TYPE,
        path: env.STORAGE_PATH,
      },
      
      frontend: {
        apiUrl: env.VITE_API_URL,
        wsUrl: env.VITE_WS_URL,
        appName: env.VITE_APP_NAME,
        appVersion: env.VITE_APP_VERSION,
      },
      
      security: {
        helmet: env.HELMET_ENABLED,
        csrf: env.CSRF_ENABLED,
        debug: env.DEBUG,
        debugPort: env.DEBUG_PORT,
      },
    };
  }
  
  /** Get singleton instance */
  public static getInstance(): CognitiveConfig {
    if (!CognitiveConfig.instance) {
      CognitiveConfig.instance = new CognitiveConfig();
    }
    return CognitiveConfig.instance;
  }
  
  /** Get full configuration */
  public get(): Config {
    return this.config;
  }
  
  /** Get configuration by key */
  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }
  
  /** Check if in development */
  public isDev(): boolean {
    return this.config.env === 'development';
  }
  
  /** Check if in production */
  public isProd(): boolean {
    return this.config.env === 'production';
  }
  
  /** Check if in test */
  public isTest(): boolean {
    return this.config.env === 'test';
  }
  
  /** Check if feature is enabled */
  public isFeatureEnabled(feature: keyof FeatureConfig): boolean {
    return this.config.features[feature];
  }
  
  /** Get service URL */
  public getServiceUrl(service: 'api' | 'ws' | 'frontend'): string {
    switch (service) {
      case 'api':
        return `${this.config.api.prefix}`;
      case 'ws':
        return this.config.frontend.wsUrl;
      case 'frontend':
        return this.config.frontend.apiUrl;
      default:
        return '';
    }
  }
  
  /** Get database connection string */
  public getDatabaseConnection(service: 'neo4j' | 'redis'): string {
    switch (service) {
      case 'neo4j':
        const { uri, user, password, database } = this.config.database.neo4j;
        return database 
          ? `neo4j://${user}:${password}@${uri}/${database}`
          : `neo4j://${user}:${password}@${uri}`;
      case 'redis':
        const { url, password, db } = this.config.database.redis;
        return password 
          ? `redis://:${password}@${url}/${db}`
          : `redis://${url}/${db}`;
      default:
        return '';
    }
  }
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/** Default configuration for development */
export const defaultConfig: Config = {
  env: 'development',
  host: '0.0.0.0',
  port: 8000,
  
  database: {
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
    },
    redis: {
      url: 'redis://localhost:6379',
      db: 0,
      maxMemory: '256mb',
    },
  },
  
  cache: {
    backend: 'hybrid',
    ttl: 3600,
    maxSize: 256,
    primary: 'memory',
    fallback: ['localStorage', 'redis'],
  },
  
  auth: {
    jwt: {
      secret: 'cognitive-secret-key-change-in-production',
      expiresIn: '24h',
      refreshExpiresIn: '7d',
    },
    session: {
      secret: 'cognitive-session-secret',
    },
    csrf: {
      enabled: true,
    },
  },
  
  api: {
    prefix: '/api/v1',
    timeout: 30000,
    cors: {
      origin: '*',
      methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      headers: '*',
    },
    rateLimit: {
      windowMs: 900000,
      maxRequests: 1000,
    },
  },
  
  globe: {
    baseUrl: 'https://cesium.com',
    maxNodes: 10000,
  },
  
  pipeline: {
    workers: 4,
    maxQueueSize: 100,
    retryAttempts: 3,
  },
  
  tda: {
    maxSimplices: 10000,
    defaultRadius: 1.0,
    persistenceThreshold: 0.5,
  },
  
  ai: {
    maxConcurrentRequests: 10,
    requestTimeout: 60000,
    models: {},
  },
  
  log: {
    level: 'info',
    format: 'json',
  },
  
  monitor: {
    enabled: false,
    port: 9090,
  },
  
  features: {
    tda: true,
    ai: true,
    globe: true,
    pipeline: true,
    analytics: true,
  },
  
  storage: {
    type: 'neo4j',
    path: './data/storage',
  },
  
  frontend: {
    apiUrl: 'http://localhost:8000',
    wsUrl: 'ws://localhost:8000',
    appName: 'COGNITIVE Platform',
    appVersion: '2.0.0',
  },
  
  security: {
    helmet: true,
    csrf: true,
    debug: false,
    debugPort: 9229,
  },
};

// ============================================================================
// EXPORT
// ============================================================================

export const config = CognitiveConfig.getInstance();
export default config;
