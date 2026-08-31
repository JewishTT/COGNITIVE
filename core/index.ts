/**
 * COGNITIVE PLATFORM - UNIFIED CORE
 * 
 * Central export of all core components.
 */

// Types
export * from './types/unified-contract';
export * from './types/error-codes';

// Registry
export { ServiceRegistry, getRegistry, resetRegistry } from './registry/service-registry';

// Configuration
export { ConfigLoader, getConfig, resetConfig } from './config/config-loader';
export type { ServiceConfig, CacheConfig, DatabaseConfig, AppConfig } from './config/config-loader';

// Base Service
export { BaseService } from './services/base-service';

// Logger
export { Logger } from './logging/logger';
