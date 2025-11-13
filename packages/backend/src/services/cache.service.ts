import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

/**
 * Redis Cache Service
 * Provides caching functionality with automatic serialization and TTL management
 */
export class CacheService {
  private client: Redis;
  private isConnected: boolean = false;
  private defaultTTL: number = 3600; // 1 hour default

  constructor() {
    this.client = new Redis(config.redis.url, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client connected and ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Connect to Redis
   */
  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      // Don't throw - app should work without cache
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Build cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isConnected) {
      logger.debug('Cache not available, returning null');
      return null;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await this.client.get(cacheKey);

      if (!value) {
        return null;
      }

      // Try to parse JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options?: CacheOptions
  ): Promise<boolean> {
    if (!this.isConnected) {
      logger.debug('Cache not available, skipping set');
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;

      // Serialize value
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl > 0) {
        await this.client.setex(cacheKey, ttl, serialized);
      } else {
        await this.client.set(cacheKey, serialized);
      }

      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const cachePattern = this.buildKey(pattern, options?.prefix);
      const keys = await this.client.keys(cachePattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T = any>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    logger.debug('Cache miss', { key });

    // Execute function to get fresh data
    const value = await fetchFn();

    // Cache the result (don't await to avoid blocking)
    this.set(key, value, options).catch((error) => {
      logger.error('Failed to cache result', { key, error });
    });

    return value;
  }

  /**
   * Increment a counter
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await this.client.incr(cacheKey);

      // Set TTL if specified
      if (options?.ttl && options.ttl > 0) {
        await this.client.expire(cacheKey, options.ttl);
      }

      return value;
    } catch (error) {
      logger.error('Cache increment error', { key, error });
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      return await this.client.decr(cacheKey);
    } catch (error) {
      logger.error('Cache decrement error', { key, error });
      return 0;
    }
  }

  /**
   * Set with expiration timestamp
   */
  async setWithExpiry(
    key: string,
    value: any,
    expiryTimestamp: Date,
    options?: CacheOptions
  ): Promise<boolean> {
    const now = Date.now();
    const expiry = expiryTimestamp.getTime();
    const ttl = Math.max(0, Math.floor((expiry - now) / 1000));

    return this.set(key, value, { ...options, ttl });
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected) {
      return -1;
    }

    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      return await this.client.ttl(cacheKey);
    } catch (error) {
      logger.error('Cache getTTL error', { key, error });
      return -1;
    }
  }

  /**
   * Flush all cache (use with caution!)
   */
  async flush(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushdb();
      logger.warn('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: string;
    hits?: number;
    misses?: number;
  }> {
    if (!this.isConnected) {
      return {
        connected: false,
        keys: 0,
        memory: '0',
      };
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      const memory = await this.client.info('memory');

      // Parse stats
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);

      return {
        connected: true,
        keys: dbSize,
        memory: memoryMatch ? memoryMatch[1] : '0',
        hits: hitsMatch ? parseInt(hitsMatch[1]) : undefined,
        misses: missesMatch ? parseInt(missesMatch[1]) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return {
        connected: this.isConnected,
        keys: 0,
        memory: '0',
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export decorator for caching method results
export function Cacheable(options?: CacheOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      return cacheService.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}
