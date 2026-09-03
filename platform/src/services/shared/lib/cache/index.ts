// platform/src/services/shared/lib/cache/index.ts
// Unified Caching System for OSINT Services
// Supports multiple cache backends: Memory, LocalStorage, Redis

import {
  CacheConfig,
  CacheEntry,
  CacheStrategy,
} from '../../types';
import { getConfig } from '../../config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Cache Backend Interface
 */
export interface CacheBackend<T = unknown> {
  get: (key: string) => Promise<T | undefined>;
  set: (key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  has: (key: string) => Promise<boolean>;
  getMany: (keys: string[]) => Promise<Record<string, T | undefined>>;
  deleteMany: (keys: string[]) => Promise<void>;
  size: () => Promise<number>;
}

/**
 * Cache Key Generator Options
 */
export interface CacheKeyOptions {
  prefix?: string;
  separator?: string;
  version?: string;
}

// ============================================================================
// MEMORY CACHE BACKEND
// ============================================================================

/**
 * In-Memory Cache Backend
 */
export class MemoryCacheBackend<T = unknown> implements CacheBackend<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    
    // Setup periodic cleanup
    if (config.ttl > 0) {
      this.cleanupInterval = setInterval(
        () => this.cleanupExpired(),
        Math.min(config.ttl * 1000, 3600000) // Max 1 hour
      );
    }
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Enforce max size
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    const expiresAt = ttl ? Date.now() + ttl * 1000 : 0;
    this.cache.set(key, { key, value, ttl, createdAt: new Date().toISOString(), expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async getMany(keys: string[]): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};
    
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    
    return result;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// ============================================================================
// LOCAL STORAGE CACHE BACKEND
// ============================================================================

/**
 * LocalStorage Cache Backend
 * Uses browser's localStorage with serialization
 */
export class LocalStorageCacheBackend<T = unknown> implements CacheBackend<T> {
  private prefix: string;
  private maxSize: number;

  constructor(config: CacheConfig = {}) {
    this.prefix = config.prefix || 'osint_cache_';
    this.maxSize = config.maxSize || 500;
  }

  private getStorageKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private serialize(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize(data: string | null): T | undefined {
    if (!data) return undefined;
    try {
      return JSON.parse(data) as T;
    } catch {
      return undefined;
    }
  }

  async get(key: string): Promise<T | undefined> {
    const storageKey = this.getStorageKey(key);
    const data = localStorage.getItem(storageKey);
    
    if (!data) return undefined;
    
    try {
      const entry: CacheEntry<T> = JSON.parse(data);
      
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        localStorage.removeItem(storageKey);
        return undefined;
      }
      
      return entry.value;
    } catch {
      localStorage.removeItem(storageKey);
      return undefined;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Enforce max size
    if (localStorage.length >= this.maxSize) {
      // Delete oldest item (simple approach)
      const keys = Object.keys(localStorage);
      if (keys.length > 0) {
        localStorage.removeItem(keys[0]);
      }
    }
    
    const expiresAt = ttl ? Date.now() + ttl * 1000 : 0;
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    
    const storageKey = this.getStorageKey(key);
    localStorage.setItem(storageKey, JSON.stringify(entry));
  }

  async delete(key: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  async clear(): Promise<void> {
    const prefix = this.prefix;
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  async has(key: string): Promise<boolean> {
    const storageKey = this.getStorageKey(key);
    return localStorage.getItem(storageKey) !== null;
  }

  async getMany(keys: string[]): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};
    
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    
    return result;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async size(): Promise<number> {
    const prefix = this.prefix;
    const keys = Object.keys(localStorage);
    return keys.filter(key => key.startsWith(prefix)).length;
  }

  cleanup(): void {
    this.clear();
  }
}

// ============================================================================
// REDIS CACHE BACKEND
// ============================================================================

/**
 * Redis Cache Backend
 * Uses Redis for distributed caching
 */
export class RedisCacheBackend<T = unknown> implements CacheBackend<T> {
  private redis: any = null;
  private prefix: string;
  private connected: boolean = false;

  constructor(config: CacheConfig = {}) {
    this.prefix = config.prefix || 'osint_cache_';
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const config = getConfig();
      const { createClient } = await import('redis');
      
      this.redis = createClient({
        url: config.REDIS_URI,
        password: config.REDIS_PASSWORD,
      });
      
      await this.redis.connect();
      this.connected = true;
    } catch (error) {
      console.error(`[RedisCache] Failed to connect:`, error);
      this.connected = false;
    }
  }

  private getRedisKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.connected) return undefined;
    
    try {
      const redisKey = this.getRedisKey(key);
      const data = await this.redis.get(redisKey);
      
      if (!data) return undefined;
      
      const entry: CacheEntry<T> = JSON.parse(data);
      
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.redis.del(redisKey);
        return undefined;
      }
      
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.connected) return;
    
    const redisKey = this.getRedisKey(key);
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: new Date().toISOString(),
      expiresAt: ttl ? Date.now() + ttl * 1000 : 0,
    };
    
    await this.redis.set(
      redisKey,
      JSON.stringify(entry),
      ttl ? { EX: ttl } : {}
    );
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;
    
    const redisKey = this.getRedisKey(key);
    await this.redis.del(redisKey);
  }

  async clear(): Promise<void> {
    if (!this.connected) return;
    
    const prefix = this.prefix;
    let cursor = '0';
    
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`
      );
      cursor = newCursor;
      
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } while (cursor !== '0');
  }

  async has(key: string): Promise<boolean> {
    if (!this.connected) return false;
    
    const redisKey = this.getRedisKey(key);
    const exists = await this.redis.exists(redisKey);
    return exists === 1;
  }

  async getMany(keys: string[]): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};
    
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    
    return result;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async size(): Promise<number> {
    if (!this.connected) return 0;
    
    const prefix = this.prefix;
    let cursor = '0';
    let count = 0;
    
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`
      );
      cursor = newCursor;
      count += keys.length;
    } while (cursor !== '0');
    
    return count;
  }

  async cleanup(): Promise<void> {
    await this.clear();
    
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    this.connected = false;
  }
}

// ============================================================================
// HYBRID CACHE BACKEND
// ============================================================================

/**
 * Hybrid Cache Backend
 * Uses multiple backends with fallback strategy
 */
export class HybridCacheBackend<T = unknown> implements CacheBackend<T> {
  private backends: CacheBackend<T>[];

  constructor(config: CacheConfig = {}) {
    this.backends = [];
    
    // Add backends based on strategy
    switch (config.strategy) {
      case 'redis':
        this.backends.push(new RedisCacheBackend<T>(config));
        break;
      case 'localStorage':
        this.backends.push(new LocalStorageCacheBackend<T>(config));
        break;
      case 'memory':
        this.backends.push(new MemoryCacheBackend<T>(config));
        break;
      case 'hybrid':
      default:
        // Use Redis first, then LocalStorage, then Memory
        this.backends.push(new RedisCacheBackend<T>(config));
        this.backends.push(new LocalStorageCacheBackend<T>(config));
        this.backends.push(new MemoryCacheBackend<T>(config));
        break;
    }
  }

  async get(key: string): Promise<T | undefined> {
    for (const backend of this.backends) {
      try {
        const value = await backend.get(key);
        if (value !== undefined) {
          return value;
        }
      } catch {
        // Try next backend
      }
    }
    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    for (const backend of this.backends) {
      try {
        await backend.set(key, value, ttl);
      } catch {
        // Try next backend
      }
    }
  }

  async delete(key: string): Promise<void> {
    for (const backend of this.backends) {
      try {
        await backend.delete(key);
      } catch {
        // Try next backend
      }
    }
  }

  async clear(): Promise<void> {
    for (const backend of this.backends) {
      try {
        await backend.clear();
      } catch {
        // Try next backend
      }
    }
  }

  async has(key: string): Promise<boolean> {
    for (const backend of this.backends) {
      try {
        const exists = await backend.has(key);
        if (exists) {
          return true;
        }
      } catch {
        // Try next backend
      }
    }
    return false;
  }

  async getMany(keys: string[]): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};
    
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    
    return result;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async size(): Promise<number> {
    let total = 0;
    
    for (const backend of this.backends) {
      try {
        total += await backend.size();
      } catch {
        // Try next backend
      }
    }
    
    return total;
  }

  async cleanup(): Promise<void> {
    for (const backend of this.backends) {
      try {
        await (backend as any).cleanup?.();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

/**
 * Cache Manager
 * Centralized cache management with namespaces
 */
export class CacheManager {
  private backends: Map<string, CacheBackend> = new Map();
  private defaultBackend: CacheBackend;
  private config: CacheConfig;

  constructor(config: CacheConfig = {}) {
    this.config = {
      strategy: 'memory',
      ttl: 3600,
      maxSize: 1000,
      ...config,
    };
    
    this.defaultBackend = this.createBackend(this.config);
  }

  /**
   * Create a cache backend based on configuration
   */
  private createBackend(config: CacheConfig): CacheBackend {
    switch (config.strategy) {
      case 'redis':
        return new RedisCacheBackend(config);
      case 'localStorage':
        return new LocalStorageCacheBackend(config);
      case 'hybrid':
        return new HybridCacheBackend(config);
      case 'memory':
      default:
        return new MemoryCacheBackend(config);
    }
  }

  /**
   * Get or create a named cache backend
   */
  getBackend(name: string, config?: Partial<CacheConfig>): CacheBackend {
    if (!this.backends.has(name)) {
      const backendConfig = { ...this.config, ...config };
      this.backends.set(name, this.createBackend(backendConfig));
    }
    return this.backends.get(name)!;
  }

  /**
   * Get the default cache backend
   */
  getDefaultBackend(): CacheBackend {
    return this.defaultBackend;
  }

  /**
   * Generate a cache key with optional namespace
   */
  generateKey(
    parts: string[],
    options: CacheKeyOptions = {}
  ): string {
    const { prefix = '', separator = ':', version = '' } = options;
    
    const keyParts = [
      prefix,
      version,
      ...parts.filter(p => p && p.trim() !== ''),
    ].filter(p => p && p.trim() !== '');
    
    return keyParts.join(separator);
  }

  /**
   * Generate a cache key for graph data
   */
  generateGraphKey(
    graphId: string,
    type: 'nodes' | 'edges' | 'metadata' | 'analysis',
    identifier?: string
  ): string {
    const parts = ['graph', graphId, type];
    if (identifier) {
      parts.push(identifier);
    }
    return this.generateKey(parts, { prefix: 'osint' });
  }

  /**
   * Generate a cache key for pipeline results
   */
  generatePipelineKey(
    runId: string,
    type: 'results' | 'status' | 'logs' = 'results'
  ): string {
    return this.generateKey(['pipeline', runId, type], { prefix: 'osint' });
  }

  /**
   * Generate a cache key for TDA analysis
   */
  generateTdaKey(
    graphId: string,
    analysisId: string
  ): string {
    return this.generateKey(['tda', graphId, analysisId], { prefix: 'osint' });
  }

  /**
   * Cleanup all caches
   */
  async cleanup(): Promise<void> {
    for (const backend of this.backends.values()) {
      await (backend as any).cleanup?.();
    }
    await (this.defaultBackend as any).cleanup?.();
    this.backends.clear();
  }
}

// ============================================================================
// DECORATORS FOR CACHING
// ============================================================================

/**
 * Cache Decorator Options
 */
export interface CacheDecoratorOptions {
  ttl?: number;
  key?: string | ((...args: unknown[]) => string);
  backend?: CacheBackend;
  skip?: (...args: unknown[]) => boolean;
}

/**
 * Create a caching decorator for functions
 */
export function cache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CacheDecoratorOptions = {}
): T {
  const {
    ttl = 3600,
    key = (...args: unknown[]) => JSON.stringify(args),
    backend,
    skip,
  } = options;

  const cacheManager = new CacheManager();
  const defaultBackend = cacheManager.getDefaultBackend();
  const targetBackend = backend || defaultBackend;

  return async function (this: unknown, ...args: unknown[]) {
    // Skip caching if skip function returns true
    if (skip && skip(...args)) {
      return fn.apply(this, args);
    }

    // Generate cache key
    const cacheKey = typeof key === 'function' ? key(...args) : key;
    const fullKey = cacheManager.generateKey(['fn', fn.name, cacheKey]);

    // Try to get from cache
    try {
      const cached = await targetBackend.get(fullKey);
      if (cached !== undefined) {
        return cached as ReturnType<T>;
      }
    } catch {
      // Cache read failed, continue with function execution
    }

    // Execute function
    const result = await fn.apply(this, args);

    // Store in cache
    try {
      await targetBackend.set(fullKey, result, ttl);
    } catch {
      // Cache write failed, ignore
    }

    return result;
  } as T;
}

/**
 * Create a caching decorator with custom key generator
 */
export function cacheWithKey<T extends (...args: unknown[]) => Promise<unknown>>(
  keyGenerator: (...args: unknown[]) => string,
  ttl?: number
): (fn: T) => T {
  return (fn: T) => cache(fn, { key: keyGenerator, ttl });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let cacheManager: CacheManager | null = null;

export function getCacheManager(config?: CacheConfig): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(config);
  }
  return cacheManager;
}

export function resetCacheManager(): void {
  if (cacheManager) {
    cacheManager.cleanup();
    cacheManager = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MemoryCacheBackend,
  LocalStorageCacheBackend,
  RedisCacheBackend,
  HybridCacheBackend,
  CacheManager,
  cache,
  cacheWithKey,
  getCacheManager,
  resetCacheManager,
};

export type {
  CacheBackend,
  CacheKeyOptions,
};
