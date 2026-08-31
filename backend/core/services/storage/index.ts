/**
 * COGNITIVE PLATFORM - STORAGE SERVICE
 * ======================================
 * 
 * [38;5;240mUnified Storage Service with Multiple Backends[0m
 * 
 * Features:
 * - Neo4j storage
 * - Redis storage
 * - Local file storage
 * - S3 storage
 * - MongoDB storage
 * - Abstracted interface
 */

import { config } from '../../config';
import {
  StorageType,
  StorageConfig,
  Neo4jStorageConfig,
  RedisStorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
  ID,
  ISODateString,
  StixObject,
  StixBundle,
  Graph,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

/** Storage interface */
export interface Storage<T = unknown> {
  type: StorageType;
  
  // Document operations
  create(id: ID, data: T): Promise<T>;
  get(id: ID): Promise<T | null>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
  exists(id: ID): Promise<boolean>;
  
  // Query operations
  query(query: Record<string, unknown>): Promise<T[]>;
  findMany(ids: ID[]): Promise<T[]>;
  
  // Collection operations
  list(): Promise<ID[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
  
  // Metadata
  getMetadata(id: ID): Promise<Record<string, unknown> | null>;
  setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void>;
}

/** Storage factory */
export class StorageFactory {
  /** Create storage based on configuration */
  public static createStorage<T>(type: StorageType, config?: StorageConfig): Storage<T> {
    switch (type) {
      case 'neo4j':
        return new Neo4jStorage<T>(config as Neo4jStorageConfig);
      case 'redis':
        return new RedisStorage<T>(config as RedisStorageConfig);
      case 'local':
        return new LocalStorage<T>(config as LocalStorageConfig);
      case 's3':
        return new S3Storage<T>(config as S3StorageConfig);
      case 'mongo':
        return new MongoStorage<T>();
      default:
        throw new CognitiveError(
          'STORAGE_TYPE_NOT_SUPPORTED',
          `Storage type '${type}' is not supported`,
          'storage'
        );
    }
  }
  
  /** Create storage from global config */
  public static createFromConfig<T>(): Storage<T> {
    const storageConfig = config.get().storage;
    return this.createStorage<T>(storageConfig.type, storageConfig);
  }
}

// ============================================================================
// NEO4J STORAGE
// ============================================================================

/** Neo4j Storage */
export class Neo4jStorage<T> implements Storage<T> {
  type: StorageType = 'neo4j';
  private config: Neo4jStorageConfig;
  
  constructor(config?: Neo4jStorageConfig) {
    this.config = config || {
      type: 'neo4j',
      uri: config.get().database.neo4j.uri,
      user: config.get().database.neo4j.user,
      password: config.get().database.neo4j.password,
      database: config.get().database.neo4j.database,
    };
  }
  
  async create(id: ID, data: T): Promise<T> {
    // In a real implementation, use Neo4j driver
    // For now, simulate
    logger.debug(`Neo4jStorage: create ${id}`);
    return data;
  }
  
  async get(id: ID): Promise<T | null> {
    logger.debug(`Neo4jStorage: get ${id}`);
    return null;
  }
  
  async update(id: ID, data: Partial<T>): Promise<T | null> {
    logger.debug(`Neo4jStorage: update ${id}`);
    return null;
  }
  
  async delete(id: ID): Promise<boolean> {
    logger.debug(`Neo4jStorage: delete ${id}`);
    return true;
  }
  
  async exists(id: ID): Promise<boolean> {
    logger.debug(`Neo4jStorage: exists ${id}`);
    return false;
  }
  
  async query(query: Record<string, unknown>): Promise<T[]> {
    logger.debug('Neo4jStorage: query', { query: Object.keys(query) });
    return [];
  }
  
  async findMany(ids: ID[]): Promise<T[]> {
    logger.debug(`Neo4jStorage: findMany ${ids.length} IDs`);
    return [];
  }
  
  async list(): Promise<ID[]> {
    logger.debug('Neo4jStorage: list');
    return [];
  }
  
  async count(): Promise<number> {
    logger.debug('Neo4jStorage: count');
    return 0;
  }
  
  async clear(): Promise<void> {
    logger.debug('Neo4jStorage: clear');
  }
  
  async getMetadata(id: ID): Promise<Record<string, unknown> | null> {
    logger.debug(`Neo4jStorage: getMetadata ${id}`);
    return null;
  }
  
  async setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void> {
    logger.debug(`Neo4jStorage: setMetadata ${id}`);
  }
}

// ============================================================================
// REDIS STORAGE
// ============================================================================

/** Redis Storage */
export class RedisStorage<T> implements Storage<T> {
  type: StorageType = 'redis';
  private client: any;
  private prefix: string;
  
  constructor(config?: RedisStorageConfig) {
    this.prefix = 'cognitive:';
    this.connect();
  }
  
  /** Connect to Redis */
  private async connect(): Promise<void> {
    try {
      const Redis = require('ioredis');
      const redisConfig = config.get().database.redis;
      
      this.client = new Redis({
        host: redisConfig.url.replace(/^redis:\/\//, ''),
        port: redisConfig.url.includes(':') 
          ? parseInt(redisConfig.url.split(':')[2] || '6379') 
          : 6379,
        password: redisConfig.password,
        db: redisConfig.db,
      });
      
      await this.client.ping();
      logger.info('Redis storage connected');
    } catch (error) {
      logger.error('Redis storage connection failed', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  async create(id: ID, data: T): Promise<T> {
    const key = `${this.prefix}${id}`;
    await this.client.set(key, JSON.stringify(data));
    return data;
  }
  
  async get(id: ID): Promise<T | null> {
    const key = `${this.prefix}${id}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) as T : null;
  }
  
  async update(id: ID, data: Partial<T>): Promise<T | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...data };
    await this.create(id, updated);
    return updated;
  }
  
  async delete(id: ID): Promise<boolean> {
    const key = `${this.prefix}${id}`;
    const result = await this.client.del(key);
    return result > 0;
  }
  
  async exists(id: ID): Promise<boolean> {
    const key = `${this.prefix}${id}`;
    const result = await this.client.exists(key);
    return result > 0;
  }
  
  async query(query: Record<string, unknown>): Promise<T[]> {
    // Redis doesn't support complex queries
    // For now, return empty array
    return [];
  }
  
  async findMany(ids: ID[]): Promise<T[]> {
    const results: T[] = [];
    
    for (const id of ids) {
      const value = await this.get(id);
      if (value) results.push(value);
    }
    
    return results;
  }
  
  async list(): Promise<ID[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.map((k: string) => k.replace(this.prefix, ''));
  }
  
  async count(): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.length;
  }
  
  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
  
  async getMetadata(id: ID): Promise<Record<string, unknown> | null> {
    const key = `${this.prefix}meta:${id}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void> {
    const key = `${this.prefix}meta:${id}`;
    await this.client.set(key, JSON.stringify(metadata));
  }
}

// ============================================================================
// LOCAL FILE STORAGE
// ============================================================================

/** Local File Storage */
export class LocalStorage<T> implements Storage<T> {
  type: StorageType = 'local';
  private basePath: string;
  private fs: any;
  private path: any;
  
  constructor(config?: LocalStorageConfig) {
    this.fs = require('fs');
    this.path = require('path');
    this.basePath = config?.path || config.get().storage.path || './data/storage';
    
    // Ensure directory exists
    if (!this.fs.existsSync(this.basePath)) {
      this.fs.mkdirSync(this.basePath, { recursive: true });
    }
  }
  
  async create(id: ID, data: T): Promise<T> {
    const filePath = this.getFilePath(id);
    this.fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
  
  async get(id: ID): Promise<T | null> {
    const filePath = this.getFilePath(id);
    
    if (!this.fs.existsSync(filePath)) {
      return null;
    }
    
    const content = this.fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }
  
  async update(id: ID, data: Partial<T>): Promise<T | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...data };
    await this.create(id, updated);
    return updated;
  }
  
  async delete(id: ID): Promise<boolean> {
    const filePath = this.getFilePath(id);
    
    if (!this.fs.existsSync(filePath)) {
      return false;
    }
    
    this.fs.unlinkSync(filePath);
    return true;
  }
  
  async exists(id: ID): Promise<boolean> {
    const filePath = this.getFilePath(id);
    return this.fs.existsSync(filePath);
  }
  
  async query(query: Record<string, unknown>): Promise<T[]> {
    // Local storage doesn't support complex queries
    return [];
  }
  
  async findMany(ids: ID[]): Promise<T[]> {
    const results: T[] = [];
    
    for (const id of ids) {
      const value = await this.get(id);
      if (value) results.push(value);
    }
    
    return results;
  }
  
  async list(): Promise<ID[]> {
    const files = this.fs.readdirSync(this.basePath);
    return files.map((f: string) => this.path.basename(f, '.json'));
  }
  
  async count(): Promise<number> {
    const files = this.fs.readdirSync(this.basePath);
    return files.length;
  }
  
  async clear(): Promise<void> {
    const files = this.fs.readdirSync(this.basePath);
    for (const file of files) {
      const filePath = this.path.join(this.basePath, file);
      this.fs.unlinkSync(filePath);
    }
  }
  
  async getMetadata(id: ID): Promise<Record<string, unknown> | null> {
    const metaPath = this.getMetaPath(id);
    
    if (!this.fs.existsSync(metaPath)) {
      return null;
    }
    
    const content = this.fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(content);
  }
  
  async setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void> {
    const metaPath = this.getMetaPath(id);
    this.fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }
  
  /** Get file path for ID */
  private getFilePath(id: ID): string {
    return this.path.join(this.basePath, `${id}.json`);
  }
  
  /** Get metadata file path for ID */
  private getMetaPath(id: ID): string {
    return this.path.join(this.basePath, `${id}.meta.json`);
  }
}

// ============================================================================
// S3 STORAGE
// ============================================================================

/** S3 Storage */
export class S3Storage<T> implements Storage<T> {
  type: StorageType = 's3';
  private config: S3StorageConfig;
  private client: any;
  
  constructor(config?: S3StorageConfig) {
    this.config = config || {
      type: 's3',
      endpoint: 'https://s3.amazonaws.com',
      region: 'us-east-1',
      accessKey: '',
      secretKey: '',
      bucket: 'cognitive-data',
    };
    
    this.connect();
  }
  
  /** Connect to S3 */
  private connect(): void {
    try {
      const S3 = require('aws-sdk/clients/s3');
      this.client = new S3({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKey,
          secretAccessKey: this.config.secretKey,
        },
      });
      logger.info('S3 storage connected');
    } catch (error) {
      logger.error('S3 storage connection failed', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  async create(id: ID, data: T): Promise<T> {
    const key = `data/${id}.json`;
    await this.client.putObject({
      Bucket: this.config.bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    });
    return data;
  }
  
  async get(id: ID): Promise<T | null> {
    const key = `data/${id}.json`;
    
    try {
      const result = await this.client.getObject({
        Bucket: this.config.bucket,
        Key: key,
      });
      const content = await result.Body.transformToString();
      return JSON.parse(content) as T;
    } catch (error) {
      return null;
    }
  }
  
  async update(id: ID, data: Partial<T>): Promise<T | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...data };
    await this.create(id, updated);
    return updated;
  }
  
  async delete(id: ID): Promise<boolean> {
    const key = `data/${id}.json`;
    
    try {
      await this.client.deleteObject({
        Bucket: this.config.bucket,
        Key: key,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async exists(id: ID): Promise<boolean> {
    const key = `data/${id}.json`;
    
    try {
      await this.client.headObject({
        Bucket: this.config.bucket,
        Key: key,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async query(query: Record<string, unknown>): Promise<T[]> {
    // S3 doesn't support complex queries
    return [];
  }
  
  async findMany(ids: ID[]): Promise<T[]> {
    const results: T[] = [];
    
    for (const id of ids) {
      const value = await this.get(id);
      if (value) results.push(value);
    }
    
    return results;
  }
  
  async list(): Promise<ID[]> {
    const result = await this.client.listObjectsV2({
      Bucket: this.config.bucket,
      Prefix: 'data/',
    });
    
    return result.Contents?.map((obj: any) => {
      const key = obj.Key as string;
      return this.path.basename(key, '.json');
    }) || [];
  }
  
  async count(): Promise<number> {
    const result = await this.client.listObjectsV2({
      Bucket: this.config.bucket,
      Prefix: 'data/',
    });
    
    return result.Contents?.length || 0;
  }
  
  async clear(): Promise<void> {
    const result = await this.client.listObjectsV2({
      Bucket: this.config.bucket,
      Prefix: 'data/',
    });
    
    if (result.Contents) {
      const objects = result.Contents.map((obj: any) => ({
        Key: obj.Key,
      }));
      
      await this.client.deleteObjects({
        Bucket: this.config.bucket,
        Delete: { Objects: objects },
      });
    }
  }
  
  async getMetadata(id: ID): Promise<Record<string, unknown> | null> {
    const key = `meta/${id}.json`;
    
    try {
      const result = await this.client.getObject({
        Bucket: this.config.bucket,
        Key: key,
      });
      const content = await result.Body.transformToString();
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void> {
    const key = `meta/${id}.json`;
    await this.client.putObject({
      Bucket: this.config.bucket,
      Key: key,
      Body: JSON.stringify(metadata),
      ContentType: 'application/json',
    });
  }
}

// ============================================================================
// MONGO STORAGE
// ============================================================================

/** MongoDB Storage */
export class MongoStorage<T> implements Storage<T> {
  type: StorageType = 'mongo';
  private client: any;
  private db: any;
  private collection: any;
  
  constructor() {
    this.connect();
  }
  
  /** Connect to MongoDB */
  private async connect(): Promise<void> {
    try {
      const { MongoClient } = require('mongodb');
      
      this.client = new MongoClient(config.get().database.neo4j.uri);
      await this.client.connect();
      
      this.db = this.client.db('cognitive');
      this.collection = this.db.collection('storage');
      
      logger.info('MongoDB storage connected');
    } catch (error) {
      logger.error('MongoDB storage connection failed', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  async create(id: ID, data: T): Promise<T> {
    await this.collection.insertOne({ _id: id, data, createdAt: new Date(), updatedAt: new Date() });
    return data;
  }
  
  async get(id: ID): Promise<T | null> {
    const result = await this.collection.findOne({ _id: id });
    return result ? result.data as T : null;
  }
  
  async update(id: ID, data: Partial<T>): Promise<T | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...data };
    await this.collection.updateOne(
      { _id: id },
      { $set: { data: updated, updatedAt: new Date() } }
    );
    return updated;
  }
  
  async delete(id: ID): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
  
  async exists(id: ID): Promise<boolean> {
    const count = await this.collection.countDocuments({ _id: id });
    return count > 0;
  }
  
  async query(query: Record<string, unknown>): Promise<T[]> {
    const results = await this.collection.find(query).toArray();
    return results.map(r => r.data as T);
  }
  
  async findMany(ids: ID[]): Promise<T[]> {
    const results = await this.collection.find({ _id: { $in: ids } }).toArray();
    return results.map(r => r.data as T);
  }
  
  async list(): Promise<ID[]> {
    const results = await this.collection.find().project({ _id: 1 }).toArray();
    return results.map(r => r._id as ID);
  }
  
  async count(): Promise<number> {
    return this.collection.countDocuments();
  }
  
  async clear(): Promise<void> {
    await this.collection.deleteMany({});
  }
  
  async getMetadata(id: ID): Promise<Record<string, unknown> | null> {
    const result = await this.collection.findOne({ _id: id }, { projection: { metadata: 1 } });
    return result?.metadata || null;
  }
  
  async setMetadata(id: ID, metadata: Record<string, unknown>): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { metadata } }
    );
  }
}

// ============================================================================
// STORAGE SERVICE
// ============================================================================

/** Storage Service */
export class StorageService {
  private storages: Map<StorageType, Storage> = new Map();
  private defaultStorage: Storage;
  
  constructor() {
    // Create all storage backends
    const storageConfig = config.get().storage;
    
    this.defaultStorage = StorageFactory.createStorage(storageConfig.type as StorageType, storageConfig);
    this.storages.set(storageConfig.type as StorageType, this.defaultStorage);
    
    // Create additional backends if needed
    if (storageConfig.type !== 'neo4j') {
      this.storages.set('neo4j', StorageFactory.createStorage('neo4j'));
    }
    if (storageConfig.type !== 'redis') {
      this.storages.set('redis', StorageFactory.createStorage('redis'));
    }
    if (storageConfig.type !== 'local') {
      this.storages.set('local', StorageFactory.createStorage('local'));
    }
  }
  
  /** Get storage by type */
  public getStorage(type: StorageType): Storage {
    return this.storages.get(type) || this.defaultStorage;
  }
  
  /** Get default storage */
  public getDefaultStorage(): Storage {
    return this.defaultStorage;
  }
  
  /** Create with specific storage */
  public async create<T>(type: StorageType, id: ID, data: T): Promise<T> {
    const storage = this.getStorage(type);
    return storage.create(id, data);
  }
  
  /** Get with specific storage */
  public async get<T>(type: StorageType, id: ID): Promise<T | null> {
    const storage = this.getStorage(type);
    return storage.get(id);
  }
  
  /** Update with specific storage */
  public async update<T>(type: StorageType, id: ID, data: Partial<T>): Promise<T | null> {
    const storage = this.getStorage(type);
    return storage.update(id, data);
  }
  
  /** Delete with specific storage */
  public async delete(type: StorageType, id: ID): Promise<boolean> {
    const storage = this.getStorage(type);
    return storage.delete(id);
  }
  
  /** Use default storage */
  public async createDefault<T>(id: ID, data: T): Promise<T> {
    return this.defaultStorage.create(id, data);
  }
  
  public async getDefault<T>(id: ID): Promise<T | null> {
    return this.defaultStorage.get(id);
  }
  
  public async updateDefault<T>(id: ID, data: Partial<T>): Promise<T | null> {
    return this.defaultStorage.update(id, data);
  }
  
  public async deleteDefault(id: ID): Promise<boolean> {
    return this.defaultStorage.delete(id);
  }
  
  /** Get statistics */
  public async getStats(): Promise<{
    default: StorageType;
    available: StorageType[];
    sizes: Record<StorageType, number>;
  }> {
    const sizes: Record<StorageType, number> = {};
    
    for (const [type, storage] of this.storages.entries()) {
      sizes[type] = await storage.count();
    }
    
    return {
      default: config.get().storage.type as StorageType,
      available: Array.from(this.storages.keys()),
      sizes,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let storageServiceInstance: StorageService | null = null;

/** Get singleton instance */
export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

// Export singleton
export const storageService = getStorageService();

// Export storage implementations
export {
  Storage,
  StorageFactory,
  Neo4jStorage,
  RedisStorage,
  LocalStorage,
  S3Storage,
  MongoStorage,
};
