/**
 * COGNITIVE PLATFORM - DATA SOURCE MANAGERS
 * 
 * High-level abstractions for fetching from all data sources.
 * Handles caching, polling, error recovery, and circuit breaking.
 */

import { ConfigManager, getConfigManager } from './config-manager';
import { Logger } from './logging/logger';
import {
  UnifiedRequest,
  UnifiedResponse,
  ServiceContext,
  createTimestamp,
  createId,
} from '../types/unified-contract';

interface DataSourceFetch {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

interface CachedData {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * Base data source manager
 */
export abstract class DataSourceManager {
  protected config: ConfigManager;
  protected logger: Logger;
  protected cache = new Map<string, CachedData>();

  constructor(protected sourceName: string) {
    this.config = getConfigManager();
    this.logger = new Logger(`DataSource:${sourceName}`);
  }

  /**
   * Fetch from data source with caching
   */
  async fetch<T>(
    req: UnifiedRequest,
    fetchFn: (config: any) => Promise<T>
  ): Promise<T> {
    const cacheKey = `${this.sourceName}:${req.action}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for ${this.sourceName}`);
      return cached as T;
    }

    try {
      const sourceConfig = this.config.getDataSource(this.sourceName);
      const data = await fetchFn(sourceConfig);

      // Cache with TTL from config
      const ttl = sourceConfig?.cache_ttl || this.config.getCacheConfig()?.ttl || 3600;
      this.setCachedData(cacheKey, data, ttl);

      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch from ${this.sourceName}`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get cached data if not expired
   */
  protected getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  protected setCachedData(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * OpenSky Network - Live flights
 */
export class OpenSkyDataSource extends DataSourceManager {
  constructor() {
    super('flights.primary');
  }

  async getFlights(
    bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number }
  ): Promise<any> {
    const sourceConfig = this.config.getDataSource('flights')?.primary;
    if (!sourceConfig) throw new Error('OpenSky not configured');

    const url = new URL(sourceConfig.url);
    url.searchParams.append('lamin', String(bounds.minLat));
    url.searchParams.append('lomin', String(bounds.minLon));
    url.searchParams.append('lamax', String(bounds.maxLat));
    url.searchParams.append('lomax', String(bounds.maxLon));

    const headers: Record<string, string> = {};
    if (sourceConfig.auth?.username && sourceConfig.auth?.password) {
      const base64 = Buffer.from(
        `${sourceConfig.auth.username}:${sourceConfig.auth.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${base64}`;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      timeout: sourceConfig.timeout || 10000,
    });

    if (!response.ok) throw new Error(`OpenSky failed: ${response.status}`);
    return response.json();
  }
}

/**
 * CelesTrak - Satellite TLEs
 */
export class CelesTrakDataSource extends DataSourceManager {
  constructor() {
    super('satellites');
  }

  async getTLEs(group: string = 'active'): Promise<string> {
    const sourceConfig = this.config.getDataSource('satellites');
    if (!sourceConfig) throw new Error('CelesTrak not configured');

    const url = `${sourceConfig.url}${group}.txt`;
    const response = await fetch(url, {
      timeout: sourceConfig.timeout || 10000,
    });

    if (!response.ok) throw new Error(`CelesTrak failed: ${response.status}`);
    return response.text();
  }
}

/**
 * USGS Earthquakes
 */
export class USGSDataSource extends DataSourceManager {
  constructor() {
    super('earthquakes');
  }

  async getEarthquakes(minMagnitude: number = 2.5): Promise<any> {
    const sourceConfig = this.config.getDataSource('earthquakes');
    if (!sourceConfig) throw new Error('USGS not configured');

    const url = sourceConfig.url;
    const response = await fetch(url, {
      timeout: sourceConfig.timeout || 10000,
    });

    if (!response.ok) throw new Error(`USGS failed: ${response.status}`);
    return response.json();
  }
}

/**
 * AISStream - Live vessels
 */
export class AISStreamDataSource extends DataSourceManager {
  constructor() {
    super('vessels');
  }

  getWebSocketURL(): string {
    const sourceConfig = this.config.getDataSource('vessels');
    if (!sourceConfig) throw new Error('AISStream not configured');
    return sourceConfig.url;
  }

  getAuthKey(): string | null {
    const sourceConfig = this.config.getDataSource('vessels');
    return sourceConfig?.auth?.api_key || null;
  }
}

/**
 * Data source factory
 */
export class DataSourceFactory {
  private sources = new Map<string, DataSourceManager>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register('opensky', new OpenSkyDataSource());
    this.register('celestrak', new CelesTrakDataSource());
    this.register('usgs', new USGSDataSource());
    this.register('aisstream', new AISStreamDataSource());
  }

  register(name: string, source: DataSourceManager): void {
    this.sources.set(name, source);
  }

  get(name: string): DataSourceManager {
    const source = this.sources.get(name);
    if (!source) throw new Error(`Data source '${name}' not registered`);
    return source;
  }
}

/**
 * Singleton factory instance
 */
let factory: DataSourceFactory | null = null;

export function getDataSourceFactory(): DataSourceFactory {
  if (!factory) {
    factory = new DataSourceFactory();
  }
  return factory;
}
