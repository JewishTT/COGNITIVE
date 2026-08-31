/**
 * COGNITIVE PLATFORM - CORE INDEX (UPDATED)
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

export { ConfigManager, getConfigManager, resetConfigManager } from './config/config-manager';

// Base Service
export { BaseService } from './services/base-service';

// Logger
export { Logger } from './logging/logger';

// Data Sources
export {
  DataSourceManager,
  OpenSkyDataSource,
  CelesTrakDataSource,
  USGSDataSource,
  AISStreamDataSource,
  DataSourceFactory,
  getDataSourceFactory,
} from './data-sources/data-source-manager';
