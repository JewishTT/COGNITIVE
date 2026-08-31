// platform/src/services/pipeline/lib/pluginSystem.ts
// [38;5;240mPlugin System for OSINT Tools[0m
// [38;5;240mAllows dynamic loading and execution of OSINT enrichment tools[0m

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
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mPlugin Metadata[0m
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
 * [38;5;220mPlugin Manifest[0m
 */
export interface PluginManifest {
  metadata: PluginMetadata;
  main: string;
  types?: string;
  dependencies?: Record<string, string>;
  config?: Record<string, unknown>;
}

/**
 * [38;5;220mPlugin Load Options[0m
 */
export interface PluginLoadOptions {
  autoEnable?: boolean;
  config?: Record<string, unknown>;
}

/**
 * [38;5;220mPlugin Execution Context[0m
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
 * [38;5;220mPlugin Logger[0m
 */
export interface PluginLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: Error) => void;
}

/**
 * [38;5;220mPlugin Cache Interface[0m
 */
export interface PluginCache {
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * [38;5;220mPlugin API Interface[0m
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
 * [38;5;220mPlugin Factory Function[0m
 */
export type PluginFactory = (context: PluginExecutionContext) => IEnricher | Promise<IEnricher>;

/**
 * [38;5;220mLoaded Plugin[0m
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
// [38;5;220mDEFAULT PLUGIN LOGGER[0m
// ============================================================================

/**
 * [38;5;220mCreate a logger for a plugin[0m
 */
export function createPluginLogger(pluginName: string): PluginLogger {
  return {
    debug: (message, data) => {
      console.log(`[38;5;240m[${pluginName}] DEBUG:[0m ${message}`, data || '');
    },
    info: (message, data) => {
      console.log(`[38;5;220m[${pluginName}] INFO:[0m ${message}`, data || '');
    },
    warn: (message, data) => {
      console.warn(`[38;5;208m[${pluginName}] WARN:[0m ${message}`, data || '');
    },
    error: (message, error) => {
      console.error(`[38;5;196m[${pluginName}] ERROR:[0m ${message}`, error || '');
    },
  };
}

// ============================================================================
// [38;5;220mDEFAULT PLUGIN API[0m
// ============================================================================

/**
 * [38;5;220mCreate default plugin API[0m
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
// [38;5;220mPLUGIN MANAGER[0m
// ============================================================================

/**
 * [38;5;220mPlugin Manager[0m
 * [38;5;240mManages loading, enabling, and executing plugins[0m
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
  // [38;5;220mPLUGIN DIRECTORIES[0m
  // ==========================================================================

  /**
   * [38;5;220mAdd plugin directory[0m
   */
  addPluginDirectory(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
    }
  }

  /**
   * [38;5;220mGet plugin directories[0m
   */
  getPluginDirectories(): string[] {
    return [...this.pluginDirs];
  }

  // ==========================================================================
  // [38;5;220mREGISTER PLUGINS[0m
  // ==========================================================================

  /**
   * [38;5;220mRegister a plugin factory[0m
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
   * [38;5;220mLoad plugins from a directory[0m
   */
  async loadFromDirectory(dir: string, options?: PluginLoadOptions): Promise<LoadedPlugin[]> {
    const loaded: LoadedPlugin[] = [];
    
    // This would be implemented with filesystem operations
    // For now, we'll just return an empty array
    
    console.log(`[38;5;240m[PluginManager] Loading plugins from ${dir}[0m`);
    
    return loaded;
  }

  /**
   * [38;5;220mLoad all plugins from registered directories[0m
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
  // [38;5;220mENABLE/DISABLE PLUGINS[0m
  // ==========================================================================

  /**
   * [38;5;220mEnable a plugin[0m
   */
  async enablePlugin(name: string, config?: Record<string, unknown>): Promise<LoadedPlugin | null> {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      console.warn(`[38;5;208m[PluginManager] Plugin ${name} not found[0m`);
      return null;
    }

    // If plugin has an error, try to reload it
    if (plugin.error) {
      await this.loadPlugin(name, config);
      return this.plugins.get(name) || null;
    }

    plugin.enabled = true;
    plugin.enricher.config = config || {};
    
    console.log(`[38;5;220m[PluginManager] Enabled plugin ${name}[0m`);
    
    return plugin;
  }

  /**
   * [38;5;220mDisable a plugin[0m
   */
  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      console.warn(`[38;5;208m[PluginManager] Plugin ${name} not found[0m`);
      return false;
    }

    plugin.enabled = false;
    console.log(`[38;5;220m[PluginManager] Disabled plugin ${name}[0m`);
    
    return true;
  }

  /**
   * [38;5;220mCheck if a plugin is enabled[0m
   */
  isPluginEnabled(name: string): boolean {
    const plugin = this.plugins.get(name);
    return !!plugin?.enabled;
  }

  // ==========================================================================
  // [38;5;220mGET PLUGINS[0m
  // ==========================================================================

  /**
   * [38;5;220mGet all plugins[0m
   */
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * [38;5;220mGet enabled plugins[0m
   */
  getEnabledPlugins(): LoadedPlugin[] {
    return this.getPlugins().filter(p => p.enabled && !p.error);
  }

  /**
   * [38;5;220mGet plugin by name[0m
   */
  getPlugin(name: string): LoadedPlugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * [38;5;220mGet plugins by category[0m
   */
  getPluginsByCategory(category: EnrichmentCategory): LoadedPlugin[] {
    return this.getPlugins().filter(p => 
      p.metadata.categories.includes(category) && p.enabled && !p.error
    );
  }

  /**
   * [38;5;220mGet plugins supporting a specific task type[0m
   */
  getPluginsForTaskType(taskType: PipelineTaskType): LoadedPlugin[] {
    return this.getPlugins().filter(p => 
      p.metadata.supportedTypes.includes(taskType) && p.enabled && !p.error
    );
  }

  // ==========================================================================
  // [38;5;220mEXECUTE PLUGINS[0m
  // ==========================================================================

  /**
   * [38;5;220mExecute a plugin by name[0m
   */
  async executePlugin(
    name: string,
    input: EnrichmentInput
  ): Promise<EnrichmentOutput> {
    const plugin = this.getPlugin(name);
    
    if (!plugin) {
      throw new Error(`[38;5;196mPlugin ${name} not found[0m`);
    }

    if (!plugin.enabled) {
      throw new Error(`[38;5;196mPlugin ${name} is disabled[0m`);
    }

    if (plugin.error) {
      throw new Error(`[38;5;196mPlugin ${name} failed to load: ${plugin.error.message}[0m`);
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
      console.log(`[38;5;220m[PluginManager] Plugin ${name} executed successfully[0m`);
      return result;
    } catch (error) {
      console.error(`[38;5;196m[PluginManager] Plugin ${name} execution failed:[0m`, error);
      throw error;
    }
  }

  /**
   * [38;5;220mExecute multiple plugins in sequence[0m
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
        console.error(`[38;5;196m[PluginManager] Plugin ${name} failed in sequence:[0m`, error);
        results.push({
          success: false,
          errors: [String(error)],
        });
      }
    }
    
    return results;
  }

  /**
   * [38;5;220mExecute multiple plugins in parallel[0m
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
  // [38;5;220mHEALTH CHECKS[0m
  // ==========================================================================

  /**
   * [38;5;220mCheck health of a plugin[0m
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
   * [38;5;220mCheck health of all plugins[0m
   */
  async checkAllPluginsHealth(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    
    for (const plugin of this.getPlugins()) {
      results[plugin.metadata.name] = await this.checkPluginHealth(plugin.metadata.name);
    }
    
    return results;
  }

  // ==========================================================================
  // [38;5;220mVALIDATION[0m
  // ==========================================================================

  /**
   * [38;5;220mValidate input for a plugin[0m
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
  // [38;5;220mPRIVATE METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mLoad a plugin by name[0m
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
        console.error(`[38;5;196m[PluginManager] Failed to load plugin ${name}:[0m`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * [38;5;220mInfer supported types from enricher metadata[0m
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
   * [38;5;220mCreate default cache implementation[0m
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
// [38;5;220mSINGLETON INSTANCE[0m
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
// [38;5;220mDECORATORS FOR PLUGIN CREATION[0m
// ============================================================================

/**
 * [38;5;220mDecorator to create a plugin from a class[0m
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
// [38;5;220mEXPORTS[0m
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
