/**
 * COGNITIVE PLATFORM - EXTENDED CONFIG MANAGER
 * 
 * High-level configuration management with YAML support.
 */

import { ConfigLoader, AppConfig } from './config-loader';
import { YAMLConfigLoader } from '../config/yaml-loader';
import { getRegistry, ServiceRegistry } from './service-registry';

export class ConfigManager {
  private envConfig: ConfigLoader;
  private yamlLoader: YAMLConfigLoader;
  private servicesConfig: any;
  private dataSourcesConfig: any;

  constructor() {
    this.envConfig = new ConfigLoader();
    this.yamlLoader = new YAMLConfigLoader();
    this.loadConfigs();
  }

  private loadConfigs(): void {
    try {
      // Load service configurations from YAML
      const servicesPath = process.env.SERVICES_CONFIG || './config/services.yaml';
      this.servicesConfig = this.yamlLoader.load(servicesPath);
    } catch (error) {
      console.warn(`Could not load services.yaml: ${error}. Using defaults.`);
      this.servicesConfig = { services: {}, data_sources: {} };
    }
  }

  /**
   * Get service configuration (merged from env + YAML)
   */
  getServiceConfig(service: string): any {
    // YAML takes precedence
    if (this.servicesConfig.services?.[service]) {
      return this.servicesConfig.services[service];
    }
    // Fallback to env-based config
    return this.envConfig.getServiceConfig(service);
  }

  /**
   * Get all services configuration
   */
  getAllServices(): Record<string, any> {
    return this.servicesConfig.services || {};
  }

  /**
   * Get data source configuration
   */
  getDataSource(name: string): any {
    return this.servicesConfig.data_sources?.[name];
  }

  /**
   * Get all data sources
   */
  getAllDataSources(): Record<string, any> {
    return this.servicesConfig.data_sources || {};
  }

  /**
   * Get pipeline configuration
   */
  getPipelineConfig(): any {
    return this.servicesConfig.pipeline || {};
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): any {
    return (
      this.servicesConfig.cache ||
      this.envConfig.getCacheConfig()
    );
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): any {
    return this.servicesConfig.logging || {
      level: 'info',
      format: 'json',
      outputs: ['console'],
    };
  }

  /**
   * Get metrics configuration
   */
  getMetricsConfig(): any {
    return this.servicesConfig.metrics || {
      enabled: false,
    };
  }

  /**
   * Check if service is configured
   */
  hasService(service: string): boolean {
    return Boolean(
      this.servicesConfig.services?.[service] ||
      this.envConfig.getServiceConfig(service)
    );
  }

  /**
   * Check if data source is configured
   */
  hasDataSource(name: string): boolean {
    return Boolean(this.servicesConfig.data_sources?.[name]);
  }

  /**
   * Initialize service registry from config
   */
  async initializeServiceRegistry(registry: ServiceRegistry): Promise<void> {
    const services = this.getAllServices();

    for (const [name, config] of Object.entries(services)) {
      if (!config || typeof config !== 'object') continue;

      const serviceConfig = config as any;
      console.log(`Configuring service: ${name} (${serviceConfig.url || 'N/A'})`);

      // Service-specific initialization would happen here
      // For now, services are expected to be pre-registered
    }
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.envConfig.getEnvironment();
  }

  /**
   * Check if production
   */
  isProduction(): boolean {
    return this.envConfig.isProduction();
  }

  /**
   * Get raw config value with path
   */
  get(path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let value: any = this.servicesConfig;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        return this.envConfig.get(path, defaultValue);
      }
    }

    return value ?? defaultValue;
  }
}

/**
 * Singleton instance
 */
let configManager: ConfigManager | null = null;

/**
 * Get or create config manager
 */
export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

/**
 * Reset config manager (for testing)
 */
export function resetConfigManager(): void {
  configManager = null;
}
