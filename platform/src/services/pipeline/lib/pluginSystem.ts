// platform/src/services/pipeline/lib/pluginSystem.ts
// Plugin System for OSINT Tools
// Allows dynamic loading and execution of OSINT enrichment tools

import {
  IEnricher,
  EnrichmentInput,
  EnrichmentOutput,
  EnrichmentCategory,
  PipelineTaskType,
  HealthCheckResult,
  ValidationResult,
} from '../../shared/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Plugin Metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  categories: EnrichmentCategory[];
  supportedTypes: PipelineTaskType[];
}

/**
 * Plugin Manifest
 */
export interface PluginManifest {
  metadata: PluginMetadata;
  main: string;
  types?: string;
  dependencies?: Record<string, string>;
  config?: Record<string, unknown>;
}

/**
 * Plugin Load Options
 */
export interface PluginLoadOptions {
  autoEnable?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Plugin Execution Context
 */
export interface PluginExecutionContext {
  pluginName: string;
  input: EnrichmentInput;
  config: Record<string, unknown>;
  logger: PluginLogger;
  cache: PluginCache;
  api: PluginApi;
}

/**
 * Plugin Logger
 */
export interface PluginLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: Error) => void;
}

/**
 * Plugin Cache Interface
 */
export interface PluginCache {
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Plugin API Interface
 */
export interface PluginApi {
  // HTTP requests
  fetch: (url: string, options?: RequestInit) => Promise<Response>;
  
  // Utility functions
  sleep: (ms: number) => Promise<void>;
  retry: <T>(
    fn: () => Promise<T>,
    options?: { retries?: number; delay?: number }
  ) => Promise<T>;
  
  // Data validation
  validateEmail: (email: string) => boolean;
  validateDomain: (domain: string) => boolean;
  validateIP: (ip: string) => boolean;
  validatePhone: (phone: string) => boolean;
  validateUsername: (username: string) => boolean;
  
  // Date/time utilities
  now: () => Date;
  timestamp: () => string;
  
  // ID generation
  generateId: () => string;
  
  // Cryptography
  hash: (data: string, algorithm?: string) => Promise<string>;
  encrypt: (data: string, key: string) => Promise<string>;
  decrypt: (data: string, key: string) => Promise<string>;
}

/**
 * Plugin Factory Function
 */
export type PluginFactory = (context: PluginExecutionContext) => IEnricher | Promise<IEnricher>;

/**
 * Loaded Plugin
 */
export interface LoadedPlugin {
  metadata: PluginMetadata;
  manifest: PluginManifest;
  enricher: IEnricher;
  enabled: boolean;
  loadedAt: Date;
  error?: Error;
}

// ============================================================================
// DEFAULT PLUGIN LOGGER
// ============================================================================

/**
 * Create a logger for a plugin
 */
export function createPluginLogger(pluginName: string): PluginLogger {
  return {
    debug: (message, data) => {
      console.log(`[${pluginName}] DEBUG: ${message}`, data || '');
    },
    info: (message, data) => {
      console.log(`[${pluginName}] INFO: ${message}`, data || '');
    },
    warn: (message, data) => {
      console.warn(`[${pluginName}] WARN: ${message}`, data || '');
    },
    error: (message, error) => {
      console.error(`[${pluginName}] ERROR: ${message}`, error || '');
    },
  };
}

// ============================================================================
// DEFAULT PLUGIN API
// ============================================================================

/**
 * Create default plugin API
 */
export function createPluginApi(): PluginApi {
  return {
    // HTTP requests
    fetch: async (url, options) => {
      return fetch(url, options);
    },
    
    // Utility functions
    sleep: async (ms) => {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    retry: async <T>(fn, options = {}) => {
      const { retries = 3, delay = 1000 } = options;
      let lastError: Error | undefined;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error as Error;
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
          }
        }
      }
      
      throw lastError;
    },
    
    // Data validation
    validateEmail: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
    
    validateDomain: (domain) => {
      const domainRegex = /^(?!:\/\/)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}\.?$/;
      return domainRegex.test(domain);
    },
    
    validateIP: (ip) => {
      // IPv4
      const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      
      // IPv6
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    },
    
    validatePhone: (phone) => {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
      return phoneRegex.test(phone);
    },
    
    validateUsername: (username) => {
      const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;
      return usernameRegex.test(username);
    },
    
    // Date/time utilities
    now: () => new Date(),
    timestamp: () => new Date().toISOString(),
    
    // ID generation
    generateId: () => {
      return Math.random().toString(36).substring(2, 9) + 
             Math.random().toString(36).substring(2, 9);
    },
    
    // Cryptography
    hash: async (data, algorithm = 'SHA-256') => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    encrypt: async (data, key) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      const encodedKey = encoder.encode(key);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        await crypto.subtle.importKey('raw', encodedKey, { name: 'AES-GCM' }, false, ['encrypt']),
        encodedData
      );
      
      return Buffer.from(iv).toString('base64') + ':' + 
             Buffer.from(encrypted).toString('base64');
    },
    
    decrypt: async (data, key) => {
      const parts = data.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = Buffer.from(parts[1], 'base64');
      const encodedKey = new TextEncoder().encode(key);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        await crypto.subtle.importKey('raw', encodedKey, { name: 'AES-GCM' }, false, ['decrypt']),
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    },
  };
}

// ============================================================================
// PLUGIN MANAGER
// ============================================================================

/**
 * Plugin Manager
 * Manages loading, enabling, and executing plugins
 */
export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginFactories: Map<string, PluginFactory> = new Map();
  private cache: PluginCache;
  private api: PluginApi;
  private pluginDirs: string[] = [];
  
  constructor(cache?: PluginCache, api?: PluginApi) {
    this.cache = cache || this.createDefaultCache();
    this.api = api || createPluginApi();
  }

  // ==========================================================================
  // PLUGIN DIRECTORIES
  // ==========================================================================

  /**
   * Add plugin directory
   */
  addPluginDirectory(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
    }
  }

  /**
   * Get plugin directories
   */
  getPluginDirectories(): string[] {
    return [...this.pluginDirs];
  }

  // ==========================================================================
  // REGISTER PLUGINS
  // ==========================================================================

  /**
   * Register a plugin factory
   */
  registerPlugin(name: string, factory: PluginFactory, metadata?: Partial<PluginMetadata>): void {
    this.pluginFactories.set(name, factory);
    
    if (metadata) {
      this.plugins.set(name, {
        metadata: {
          name,
          version: '1.0.0',
          description: '',
          author: 'unknown',
          categories: [],
          supportedTypes: [],
          ...metadata,
        },
        manifest: {
          metadata: {
            name,
            version: '1.0.0',
            description: '',
            author: 'unknown',
            categories: [],
            supportedTypes: [],
            ...metadata,
          },
          main: '',
        },
        enricher: {} as IEnricher,
        enabled: false,
        loadedAt: new Date(),
      });
    }
  }

  /**
   * Load plugins from a directory
   */
  async loadFromDirectory(dir: string, options?: PluginLoadOptions): Promise<LoadedPlugin[]> {
    const loaded: LoadedPlugin[] = [];
    
    // This would be implemented with filesystem operations
    // For now, we'll just return an empty array
    
    console.log(`[PluginManager] Loading plugins from ${dir}`);
    
    return loaded;
  }

  /**
   * Load all plugins from registered directories
   */
  async loadAll(options?: PluginLoadOptions): Promise<LoadedPlugin[]> {
    const allLoaded: LoadedPlugin[] = [];
    
    for (const dir of this.pluginDirs) {
      const loaded = await this.loadFromDirectory(dir, options);
      allLoaded.push(...loaded);
    }
    
    return allLoaded;
  }

  // ==========================================================================
  // ENABLE/DISABLE PLUGINS
  // ==========================================================================

  /**
   * Enable a plugin
   */
  async enablePlugin(name: string, config?: Record<string, unknown>): Promise<LoadedPlugin | null> {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      console.warn(`[PluginManager] Plugin ${name} not found`);
      return null;
    }

    // If plugin has an error, try to reload it
    if (plugin.error) {
      await this.loadPlugin(name, config);
      return this.plugins.get(name) || null;
    }

    plugin.enabled = true;
    plugin.enricher.config = config || {};
    
    console.log(`[PluginManager] Enabled plugin ${name}`);
    
    return plugin;
  }

  /**
   * Disable a plugin
   */
  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      console.warn(`[PluginManager] Plugin ${name} not found`);
      return false;
    }

    plugin.enabled = false;
    console.log(`[PluginManager] Disabled plugin ${name}`);
    
    return true;
  }

  /**
   * Check if a plugin is enabled
   */
  isPluginEnabled(name: string): boolean {
    const plugin = this.plugins.get(name);
    return !!plugin?.enabled;
  }

  // ==========================================================================
  // GET PLUGINS
  // ==========================================================================

  /**
   * Get all plugins
   */
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): LoadedPlugin[] {
    return this.getPlugins().filter(p => p.enabled && !p.error);
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): LoadedPlugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: EnrichmentCategory): LoadedPlugin[] {
    return this.getPlugins().filter(p => 
      p.metadata.categories.includes(category) && p.enabled && !p.error
    );
  }

  /**
   * Get plugins supporting a specific task type
   */
  getPluginsForTaskType(taskType: PipelineTaskType): LoadedPlugin[] {
    return this.getPlugins().filter(p => 
      p.metadata.supportedTypes.includes(taskType) && p.enabled && !p.error
    );
  }

  // ==========================================================================
  // EXECUTE PLUGINS
  // ==========================================================================

  /**
   * Execute a plugin by name
   */
  async executePlugin(
    name: string,
    input: EnrichmentInput
  ): Promise<EnrichmentOutput> {
    const plugin = this.getPlugin(name);
    
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin ${name} is disabled`);
    }

    if (plugin.error) {
      throw new Error(`Plugin ${name} failed to load: ${plugin.error.message}`);
    }

    const context: PluginExecutionContext = {
      pluginName: name,
      input,
      config: plugin.enricher.config || {},
      logger: createPluginLogger(name),
      cache: this.cache,
      api: this.api,
    };

    try {
      const result = await plugin.enricher.execute(input, context);
      console.log(`[PluginManager] Plugin ${name} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[PluginManager] Plugin ${name} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute multiple plugins in sequence
   */
  async executePluginsSequentially(
    pluginNames: string[],
    input: EnrichmentInput
  ): Promise<EnrichmentOutput[]> {
    const results: EnrichmentOutput[] = [];
    
    for (const name of pluginNames) {
      try {
        const result = await this.executePlugin(name, input);
        results.push(result);
        
        // Update input with results for next plugin
        input = {
          ...input,
          context: {
            ...input.context,
            previousResults: [...(input.context?.previousResults || []), result],
          },
        };
      } catch (error) {
        console.error(`[PluginManager] Plugin ${name} failed in sequence:`, error);
        results.push({
          success: false,
          errors: [String(error)],
        });
      }
    }
    
    return results;
  }

  /**
   * Execute multiple plugins in parallel
   */
  async executePluginsParallel(
    pluginNames: string[],
    input: EnrichmentInput
  ): Promise<EnrichmentOutput[]> {
    const promises = pluginNames.map(name => 
      this.executePlugin(name, input).catch(error => ({
        success: false,
        errors: [String(error)],
      }))
    );
    
    return Promise.all(promises);
  }

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  /**
   * Check health of a plugin
   */
  async checkPluginHealth(name: string): Promise<HealthCheckResult> {
    const plugin = this.getPlugin(name);
    
    if (!plugin) {
      return {
        healthy: false,
        message: `Plugin ${name} not found`,
      };
    }

    if (!plugin.enabled) {
      return {
        healthy: false,
        message: `Plugin ${name} is disabled`,
      };
    }

    if (plugin.error) {
      return {
        healthy: false,
        message: `Plugin ${name} failed to load: ${plugin.error.message}`,
      };
    }

    try {
      if (plugin.enricher.healthCheck) {
        return await plugin.enricher.healthCheck();
      }
      
      return {
        healthy: true,
        message: `Plugin ${name} has no health check`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Plugin ${name} health check failed: ${String(error)}`,
      };
    }
  }

  /**
   * Check health of all plugins
   */
  async checkAllPluginsHealth(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    
    for (const plugin of this.getPlugins()) {
      results[plugin.metadata.name] = await this.checkPluginHealth(plugin.metadata.name);
    }
    
    return results;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate input for a plugin
   */
  async validatePluginInput(
    name: string,
    input: EnrichmentInput
  ): Promise<ValidationResult> {
    const plugin = this.getPlugin(name);
    
    if (!plugin) {
      return {
        valid: false,
        errors: [`Plugin ${name} not found`],
      };
    }

    if (!plugin.enabled) {
      return {
        valid: false,
        errors: [`Plugin ${name} is disabled`],
      };
    }

    if (plugin.error) {
      return {
        valid: false,
        errors: [`Plugin ${name} failed to load: ${plugin.error.message}`],
      };
    }

    try {
      if (plugin.enricher.validateInput) {
        return await plugin.enricher.validateInput(input);
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [`Plugin ${name} validation failed: ${String(error)}`],
      };
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Load a plugin by name
   */
  private async loadPlugin(name: string, config?: Record<string, unknown>): Promise<LoadedPlugin | null> {
    // Check if already loaded
    const existing = this.plugins.get(name);
    if (existing && !existing.error) {
      return existing;
    }

    // Check if it's a registered factory
    const factory = this.pluginFactories.get(name);
    if (factory) {
      try {
        const context: PluginExecutionContext = {
          pluginName: name,
          input: {} as EnrichmentInput,
          config: config || {},
          logger: createPluginLogger(name),
          cache: this.cache,
          api: this.api,
        };
        
        const enricher = await factory(context);
        
        const plugin: LoadedPlugin = {
          metadata: {
            name,
            version: '1.0.0',
            description: enricher.description || '',
            author: enricher.author || 'unknown',
            categories: [enricher.category],
            supportedTypes: this.inferSupportedTypes(enricher),
          },
          manifest: {
            metadata: {
              name,
              version: '1.0.0',
              description: enricher.description || '',
              author: enricher.author || 'unknown',
              categories: [enricher.category],
              supportedTypes: this.inferSupportedTypes(enricher),
            },
            main: '',
          },
          enricher,
          enabled: false,
          loadedAt: new Date(),
        };
        
        this.plugins.set(name, plugin);
        return plugin;
      } catch (error) {
        const plugin: LoadedPlugin = {
          metadata: {
            name,
            version: '1.0.0',
            description: '',
            author: 'unknown',
            categories: [],
            supportedTypes: [],
          },
          manifest: {
            metadata: {
              name,
              version: '1.0.0',
              description: '',
              author: 'unknown',
              categories: [],
              supportedTypes: [],
            },
            main: '',
          },
          enricher: {} as IEnricher,
          enabled: false,
          loadedAt: new Date(),
          error: error as Error,
        };
        
        this.plugins.set(name, plugin);
        console.error(`[PluginManager] Failed to load plugin ${name}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Infer supported types from enricher metadata
   */
  private inferSupportedTypes(enricher: IEnricher): PipelineTaskType[] {
    // This is a simple inference based on enricher name and category
    const supportedTypes: PipelineTaskType[] = [];
    
    const name = enricher.name.toLowerCase();
    const category = enricher.category;

    if (name.includes('domain') || category === 'domain') {
      supportedTypes.push('domain');
    }
    if (name.includes('ip') || category === 'ip') {
      supportedTypes.push('ip');
    }
    if (name.includes('email') || category === 'email') {
      supportedTypes.push('email');
    }
    if (name.includes('username') || category === 'identity') {
      supportedTypes.push('username');
    }
    if (name.includes('phone') || category === 'phone') {
      supportedTypes.push('phone');
    }
    if (name.includes('company') || category === 'company') {
      supportedTypes.push('company');
    }
    if (name.includes('wallet') || name.includes('crypto') || category === 'financial') {
      supportedTypes.push('cryptowallet');
    }

    // Always add custom as fallback
    if (supportedTypes.length === 0) {
      supportedTypes.push('custom');
    }

    return supportedTypes;
  }

  /**
   * Create default cache implementation
   */
  private createDefaultCache(): PluginCache {
    const cacheMap = new Map<string, { value: unknown; expiresAt: number }>();
    
    return {
      get: async <T>(key: string) => {
        const entry = cacheMap.get(key);
        if (!entry) return undefined;
        
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          cacheMap.delete(key);
          return undefined;
        }
        
        return entry.value as T;
      },
      
      set: async <T>(key: string, value: T, ttl?: number) => {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : 0;
        cacheMap.set(key, { value, expiresAt });
      },
      
      delete: async (key: string) => {
        cacheMap.delete(key);
      },
      
      clear: async () => {
        cacheMap.clear();
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let pluginManager: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    pluginManager = new PluginManager();
  }
  return pluginManager;
}

export function resetPluginManager(): void {
  if (pluginManager) {
    pluginManager = null;
  }
}

// ============================================================================
// DECORATORS FOR PLUGIN CREATION
// ============================================================================

/**
 * Decorator to create a plugin from a class
 */
export function createPlugin(metadata: PluginMetadata) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor implements IEnricher {
      name = metadata.name;
      label = metadata.name;
      description = metadata.description;
      version = metadata.version;
      author = metadata.author;
      category = metadata.categories[0];
      
      async execute(input: EnrichmentInput): Promise<EnrichmentOutput> {
        const instance = new constructor() as any;
        if (typeof instance.execute === 'function') {
          return instance.execute(input);
        }
        throw new Error(`Plugin ${metadata.name} does not have an execute method`);
      }
    };
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PluginManager,
  getPluginManager,
  resetPluginManager,
  createPluginLogger,
  createPluginApi,
  createPlugin,
};

export type {
  PluginMetadata,
  PluginManifest,
  PluginLoadOptions,
  PluginExecutionContext,
  PluginLogger,
  PluginCache,
  PluginApi,
  PluginFactory,
  LoadedPlugin,
};
