/**
 * COGNITIVE PLATFORM - CACHE SERVICE
 * ====================================
 * 
 * [38;5;240mMulti-Backend Caching System[0m
 * 
 * Features:
 * - Memory cache
 * - LocalStorage cache
 * - Redis cache
 * - Hybrid cache with fallback
 * - TTL support
 * - Tag-based invalidation
 * - LRU eviction
 */

import { config } from '../../config';
import {
  CacheBackendType,
  CacheConfig,
  CacheEntry,
  ID,
  ISODateString,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';

// ============================================================================
// CACHE BACKEND INTERFACE
// ============================================================================

/** Cache backend interface */
export interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

/** Cache options */
export interface CacheOptions {
  ttl?: number; // in seconds
  tags?: string[];
}

// ============================================================================
// MEMORY CACHE BACKEND
// ============================================================================

/** Memory cache entry */
interface MemoryCacheEntry<T = unknown> extends CacheEntry<T> {
  expiresAt: number;
}

/** Memory cache backend */
export class MemoryCacheBackend implements CacheBackend {
  private cache: Map<string, MemoryCacheEntry> = new Map();
  private maxSize: number;
  private lruOrder: string[] = [];
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    // Update LRU order
    this.updateLRU(key);
    
    return entry.value as T;
  }
  
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, { key, value, expiresAt, tags: [] });
    this.updateLRU(key);
  }
  
  async delete(key: string): Promise<boolean> {
    const hadKey = this.cache.has(key);
    this.cache.delete(key);
    this.lruOrder = this.lruOrder.filter(k => k !== key);
    return hadKey;
  }
  
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return allKeys;
    }
    
    const regex = new RegExp(pattern.replace('*', '.*'));
    return allKeys.filter(key => regex.test(key));
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
    this.lruOrder = [];
  }
  
  async size(): Promise<number> {
    return this.cache.size;
  }
  
  /** Update LRU order */
  private updateLRU(key: string): void {
    this.lruOrder = this.lruOrder.filter(k => k !== key);
    this.lruOrder.push(key);
  }
  
  /** Evict least recently used entry */
  private evictLRU(): void {
    if (this.lruOrder.length === 0) return;
    
    const oldestKey = this.lruOrder.shift()!;
    this.cache.delete(oldestKey);
  }
}

// ============================================================================
// LOCAL STORAGE CACHE BACKEND
// ============================================================================

/** LocalStorage cache backend (Node.js compatible) */
export class LocalStorageCacheBackend implements CacheBackend {
  private storage: Map<string, CacheEntry> = new Map();
  private filePath?: string;
  
  constructor(filePath?: string) {
    this.filePath = filePath;
    this.loadFromFile();
  }
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.storage.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.storage.delete(key);
      return null;
    }
    
    return entry.value as T;
  }
  
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    this.storage.set(key, { key, value, expiresAt, tags: [] });
    this.saveToFile();
  }
  
  async delete(key: string): Promise<boolean> {
    const hadKey = this.storage.has(key);
    this.storage.delete(key);
    this.saveToFile();
    return hadKey;
  }
  
  async has(key: string): Promise<boolean> {
    const entry = this.storage.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.storage.delete(key);
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.storage.keys());
    
    if (!pattern) {
      return allKeys;
    }
    
    const regex = new RegExp(pattern.replace('*', '.*'));
    return allKeys.filter(key => regex.test(key));
  }
  
  async clear(): Promise<void> {
    this.storage.clear();
    this.saveToFile();
  }
  
  async size(): Promise<number> {
    return this.storage.size;
  }
  
  /** Load from file */
  private async loadFromFile(): Promise<void> {
    if (!this.filePath) return;
    
    try {
      const fs = require('fs');
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        for (const [key, entry] of Object.entries(parsed)) {
          this.storage.set(key, entry);
        }
      }
    } catch (error) {
      logger.error('Failed to load cache from file', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  /** Save to file */
  private async saveToFile(): Promise<void> {
    if (!this.filePath) return;
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Convert Map to object
      const data = Object.fromEntries(this.storage);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save cache to file', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

// ============================================================================
// REDIS CACHE BACKEND
// ============================================================================

/** Redis cache backend */
export class RedisCacheBackend implements CacheBackend {
  private client: any;
  private connected: boolean = false;
  
  constructor() {
    this.connect();
  }
  
  /** Connect to Redis */
  private async connect(): Promise<void> {
    try {
      const redisConfig = config.get().database.redis;
      const Redis = require('ioredis');
      
      this.client = new Redis({
        host: redisConfig.url.replace(/^redis:\/\//, ''),
        port: redisConfig.url.includes(':') 
          ? parseInt(redisConfig.url.split(':')[2] || '6379') 
          : 6379,
        password: redisConfig.password,
        db: redisConfig.db,
      });
      
      // Test connection
      await this.client.ping();
      this.connected = true;
      logger.info('Redis cache connected');
    } catch (error) {
      logger.error('Redis connection failed', {
        error: error instanceof Error ? error.message : error,
      });
      this.connected = false;
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      logger.error('Redis get failed', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
  
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      logger.error('Redis set failed', {
        key,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  async delete(key: string): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis delete failed', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }
  
  async has(key: string): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis has failed', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }
  
  async keys(pattern: string = '*'): Promise<string[]> {
    if (!this.connected) return [];
    
    try {
      const result = await this.client.keys(pattern);
      return result as string[];
    } catch (error) {
      logger.error('Redis keys failed', {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }
  
  async clear(): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.client.flushdb();
    } catch (error) {
      logger.error('Redis clear failed', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  async size(): Promise<number> {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.dbsize();
      return result as number;
    } catch (error) {
      logger.error('Redis size failed', {
        error: error instanceof Error ? error.message : error,
      });
      return 0;
    }
  }
}

// ============================================================================
// HYBRID CACHE BACKEND
// ============================================================================

/** Hybrid cache backend with fallback */
export class HybridCacheBackend implements CacheBackend {
  private backends: CacheBackend[];
  private primary: CacheBackend;
  private fallbacks: CacheBackend[];
  
  constructor(primary: CacheBackend, fallbacks: CacheBackend[]) {
    this.primary = primary;
    this.fallbacks = fallbacks;
    this.backends = [primary, ...fallbacks];
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Try primary first
    const primaryValue = await this.primary.get<T>(key);
    if (primaryValue !== null) {
      return primaryValue;
    }
    
    // Try fallbacks
    for (const fallback of this.fallbacks) {
      const value = await fallback.get<T>(key);
      if (value !== null) {
        // Set in primary for future requests
        await this.primary.set(key, value);
        return value;
      }
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Set in all backends
    for (const backend of this.backends) {
      try {
        await backend.set(key, value, ttl);
      } catch (error) {
        logger.error('Failed to set in backend', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }
  
  async delete(key: string): Promise<boolean> {
    let deleted = false;
    
    for (const backend of this.backends) {
      try {
        const result = await backend.delete(key);
        deleted = deleted || result;
      } catch (error) {
        logger.error('Failed to delete from backend', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    
    return deleted;
  }
  
  async has(key: string): Promise<boolean> {
    // Check primary first
    const primaryHas = await this.primary.has(key);
    if (primaryHas) return true;
    
    // Check fallbacks
    for (const fallback of this.fallbacks) {
      const has = await fallback.has(key);
      if (has) return true;
    }
    
    return false;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = new Set<string>();
    
    for (const backend of this.backends) {
      try {
        const keys = await backend.keys(pattern);
        keys.forEach(key => allKeys.add(key));
      } catch (error) {
        logger.error('Failed to get keys from backend', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    
    return Array.from(allKeys);
  }
  
  async clear(): Promise<void> {
    for (const backend of this.backends) {
      try {
        await backend.clear();
      } catch (error) {
        logger.error('Failed to clear backend', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }
  
  async size(): Promise<number> {
    let total = 0;
    
    for (const backend of this.backends) {
      try {
        total += await backend.size();
      } catch (error) {
        logger.error('Failed to get size from backend', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    
    return total;
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

/** Cache Service */
export class CacheService {
  private backend: CacheBackend;
  private tagIndex: Map<string, Set<string>> = new Map();
  
  constructor() {
    this.backend = this.createBackend();
  }
  
  /** Create appropriate backend based on configuration */
  private createBackend(): CacheBackend {
    const cacheConfig = config.get().cache;
    const backendType = cacheConfig.backend;
    
    switch (backendType) {
      case 'memory':
        return new MemoryCacheBackend(cacheConfig.maxSize);
      
      case 'localStorage':
        return new LocalStorageCacheBackend(config.get().storage.path);
      
      case 'redis':
        return new RedisCacheBackend();
      
      case 'hybrid':
        const primary = cacheConfig.primary === 'memory'
          ? new MemoryCacheBackend(cacheConfig.maxSize)
          : cacheConfig.primary === 'localStorage'
            ? new LocalStorageCacheBackend(config.get().storage.path)
            : new RedisCacheBackend();
        
        const fallbacks: CacheBackend[] = [];
        
        if (cacheConfig.fallback) {
          for (const fallbackType of cacheConfig.fallback) {
            switch (fallbackType) {
              case 'memory':
                fallbacks.push(new MemoryCacheBackend(cacheConfig.maxSize));
                break;
              case 'localStorage':
                fallbacks.push(new LocalStorageCacheBackend(config.get().storage.path));
                break;
              case 'redis':
                fallbacks.push(new RedisCacheBackend());
                break;
            }
          }
        }
        
        return new HybridCacheBackend(primary, fallbacks);
      
      default:
        return new MemoryCacheBackend();
    }
  }
  
  // ==========================================================================
  // CACHE OPERATIONS
  // ==========================================================================
  
  /** Get value from cache */
  public async get<T>(key: string): Promise<T | null> {
    return this.backend.get<T>(key);
  }
  
  /** Set value in cache */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || config.get().cache.ttl;
    
    // Index by tags
    if (options.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
    
    await this.backend.set(key, value, ttl);
  }
  
  /** Delete value from cache */
  public async delete(key: string): Promise<boolean> {
    // Remove from tag index
    for (const [tag, keys] of this.tagIndex.entries()) {
      if (keys.has(key)) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
    
    return this.backend.delete(key);
  }
  
  /** Check if key exists */
  public async has(key: string): Promise<boolean> {
    return this.backend.has(key);
  }
  
  /** Get all keys matching pattern */
  public async keys(pattern?: string): Promise<string[]> {
    return this.backend.keys(pattern);
  }
  
  /** Clear all cache */
  public async clear(): Promise<void> {
    await this.backend.clear();
    this.tagIndex.clear();
  }
  
  /** Get cache size */
  public async size(): Promise<number> {
    return this.backend.size();
  }
  
  // ==========================================================================
  // TAG-BASED OPERATIONS
  // ==========================================================================
  
  /** Get all keys with a specific tag */
  public async getKeysByTag(tag: string): Promise<string[]> {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }
  
  /** Delete all keys with a specific tag */
  public async deleteByTag(tag: string): Promise<number> {
    const keys = await this.getKeysByTag(tag);
    let count = 0;
    
    for (const key of keys) {
      const deleted = await this.delete(key);
      if (deleted) count++;
    }
    
    this.tagIndex.delete(tag);
    
    return count;
  }
  
  /** Delete all keys with multiple tags */
  public async deleteByTags(tags: string[]): Promise<number> {
    let count = 0;
    
    for (const tag of tags) {
      count += await this.deleteByTag(tag);
    }
    
    return count;
  }
  
  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================
  
  /** Get multiple values */
  public async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    
    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }
    
    return result;
  }
  
  /** Set multiple values */
  public async setMany<T>(entries: Record<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value, { ttl });
    }
  }
  
  /** Delete multiple keys */
  public async deleteMany(keys: string[]): Promise<number> {
    let count = 0;
    
    for (const key of keys) {
      const deleted = await this.delete(key);
      if (deleted) count++;
    }
    
    return count;
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /** Get backend type */
  public getBackendType(): CacheBackendType {
    return config.get().cache.backend;
  }
  
  /** Get cache statistics */
  public async getStats(): Promise<{
    size: number;
    backend: CacheBackendType;
    tags: string[];
  }> {
    return {
      size: await this.size(),
      backend: this.getBackendType(),
      tags: Array.from(this.tagIndex.keys()),
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let cacheServiceInstance: CacheService | null = null;

/** Get singleton instance */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

// Export singleton
export const cacheService = getCacheService();

// Export backends
export {
  MemoryCacheBackend,
  LocalStorageCacheBackend,
  RedisCacheBackend,
  HybridCacheBackend,
  CacheBackend,
  CacheOptions,
};
