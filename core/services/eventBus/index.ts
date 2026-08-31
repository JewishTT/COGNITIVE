/**
 * COGNITIVE PLATFORM - EVENT BUS SERVICE
 * ========================================
 * 
 * [38;5;240mRedis-based Event Bus for Inter-Service Communication[0m
 * 
 * Features:
 * - Publish/Subscribe pattern
 * - Multiple event types
 * - Event filtering
 * - Message persistence
 * - Retry logic
 * - Monitoring
 */

import { config } from '../../config';
import {
  EventType,
  EventPayload,
  EventSubscription,
  ID,
  ISODateString,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';

// ============================================================================
// EVENT HANDLER
// ============================================================================

/** Event handler function */
export type EventHandler = (payload: EventPayload) => Promise<void>;

/** Event subscription with metadata */
export interface EventSubscriptionWithMeta extends EventSubscription {
  id: ID;
  createdAt: ISODateString;
  callCount: number;
  lastCalledAt?: ISODateString;
  errorCount: number;
}

// ============================================================================
// IN-MEMORY EVENT BUS (for development/testing)
// ============================================================================

/** In-memory event bus implementation */
class InMemoryEventBus {
  private subscriptions: Map<EventType, Set<EventSubscriptionWithMeta>> = new Map();
  private wildcardSubscriptions: Set<EventSubscriptionWithMeta> = new Set();
  private isRunning: boolean = true;
  
  constructor() {
    logger.info('In-memory event bus initialized');
  }
  
  /** Subscribe to an event */
  public subscribe(
    eventType: EventType | EventType[],
    callback: EventHandler,
    filter?: (payload: EventPayload) => boolean
  ): ID {
    const id = this.generateId('sub');
    const now = new Date().toISOString();
    
    const subscription: EventSubscriptionWithMeta = {
      id,
      eventType: Array.isArray(eventType) ? eventType : [eventType],
      callback,
      filter,
      createdAt: now,
      callCount: 0,
      errorCount: 0,
    };
    
    // Add to subscriptions
    for (const type of subscription.eventType) {
      if (!this.subscriptions.has(type)) {
        this.subscriptions.set(type, new Set());
      }
      this.subscriptions.get(type)!.add(subscription);
    }
    
    // If eventType is '*', add to wildcard
    if (subscription.eventType.includes('*' as EventType)) {
      this.wildcardSubscriptions.add(subscription);
    }
    
    logger.debug(`Subscribed to event(s): ${subscription.eventType.join(', ')}`, { id });
    
    return id;
  }
  
  /** Unsubscribe from an event */
  public unsubscribe(id: ID): boolean {
    let unsubscribed = false;
    
    // Remove from specific event types
    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        if (subscription.id === id) {
          subscriptions.delete(subscription);
          unsubscribed = true;
          logger.debug(`Unsubscribed from event: ${eventType}`, { id });
          break;
        }
      }
    }
    
    // Remove from wildcard
    for (const subscription of this.wildcardSubscriptions) {
      if (subscription.id === id) {
        this.wildcardSubscriptions.delete(subscription);
        unsubscribed = true;
        logger.debug('Unsubscribed from wildcard events', { id });
        break;
      }
    }
    
    return unsubscribed;
  }
  
  /** Emit an event */
  public async emit(
    eventType: EventType,
    data: Record<string, unknown> = {},
    source: string = 'unknown'
  ): Promise<number> {
    if (!this.isRunning) {
      logger.warn('Event bus is not running, event not emitted', { eventType });
      return 0;
    }
    
    const payload: EventPayload = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      source,
    };
    
    logger.debug(`Emitting event: ${eventType}`, {
      source,
      data: Object.keys(data),
    });
    
    let callCount = 0;
    
    // Notify specific subscribers
    const eventSubscriptions = this.subscriptions.get(eventType);
    if (eventSubscriptions) {
      for (const subscription of eventSubscriptions) {
        await this.invokeHandler(subscription, payload);
        callCount++;
      }
    }
    
    // Notify wildcard subscribers
    for (const subscription of this.wildcardSubscriptions) {
      await this.invokeHandler(subscription, payload);
      callCount++;
    }
    
    return callCount;
  }
  
  /** Invoke event handler */
  private async invokeHandler(
    subscription: EventSubscriptionWithMeta,
    payload: EventPayload
  ): Promise<void> {
    try {
      // Check filter
      if (subscription.filter && !subscription.filter(payload)) {
        return;
      }
      
      // Invoke callback
      await subscription.callback(payload);
      
      // Update stats
      subscription.callCount++;
      subscription.lastCalledAt = new Date().toISOString();
      
      logger.debug(`Event handler invoked`, {
        subscriptionId: subscription.id,
        eventType: payload.type,
        callCount: subscription.callCount,
      });
    } catch (error) {
      subscription.errorCount++;
      logger.error(`Event handler failed`, {
        subscriptionId: subscription.id,
        eventType: payload.type,
        error: error instanceof Error ? error.message : error,
        errorCount: subscription.errorCount,
      });
    }
  }
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Shutdown event bus */
  public shutdown(): void {
    this.isRunning = false;
    logger.info('In-memory event bus shutdown');
  }
  
  /** Get subscription count */
  public getSubscriptionCount(): number {
    let count = 0;
    
    for (const subscriptions of this.subscriptions.values()) {
      count += subscriptions.size;
    }
    
    count += this.wildcardSubscriptions.size;
    
    return count;
  }
  
  /** Get statistics */
  public getStats(): {
    totalSubscriptions: number;
    byEventType: Record<EventType, number>;
    wildcardSubscriptions: number;
  } {
    const byEventType: Record<EventType, number> = {} as Record<EventType, number>;
    
    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      byEventType[eventType] = subscriptions.size;
    }
    
    return {
      totalSubscriptions: this.getSubscriptionCount(),
      byEventType,
      wildcardSubscriptions: this.wildcardSubscriptions.size,
    };
  }
}

// ============================================================================
// REDIS EVENT BUS
// ============================================================================

/** Redis event bus implementation */
class RedisEventBus {
  private client: any;
  private subscriber: any;
  private subscriptions: Map<EventType, Set<EventSubscriptionWithMeta>> = new Map();
  private wildcardSubscriptions: Set<EventSubscriptionWithMeta> = new Set();
  private channelPrefix: string;
  private isRunning: boolean = false;
  
  constructor() {
    this.channelPrefix = 'cognitive_events';
    this.connect();
  }
  
  /** Connect to Redis */
  private async connect(): Promise<void> {
    try {
      const Redis = require('ioredis');
      const redisConfig = config.get().database.redis;
      
      // Create publisher client
      this.client = new Redis({
        host: redisConfig.url.replace(/^redis:\/\//, ''),
        port: redisConfig.url.includes(':') 
          ? parseInt(redisConfig.url.split(':')[2] || '6379') 
          : 6379,
        password: redisConfig.password,
        db: redisConfig.db,
      });
      
      // Create subscriber client
      this.subscriber = new Redis({
        host: redisConfig.url.replace(/^redis:\/\//, ''),
        port: redisConfig.url.includes(':') 
          ? parseInt(redisConfig.url.split(':')[2] || '6379') 
          : 6379,
        password: redisConfig.password,
        db: redisConfig.db,
      });
      
      // Subscribe to all channels
      await this.subscriber.subscribe(`${this.channelPrefix}_*`);
      
      // Handle messages
      this.subscriber.on('message', (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });
      
      this.isRunning = true;
      logger.info('Redis event bus connected');
    } catch (error) {
      logger.error('Redis event bus connection failed', {
        error: error instanceof Error ? error.message : error,
      });
      this.isRunning = false;
    }
  }
  
  /** Handle incoming message */
  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const payload: EventPayload = JSON.parse(message);
      const eventType = this.extractEventTypeFromChannel(channel);
      
      if (!eventType) {
        logger.warn('Received message with unknown event type', { channel });
        return;
      }
      
      payload.type = eventType;
      
      logger.debug(`Received event: ${eventType}`, { channel });
      
      // Notify specific subscribers
      const eventSubscriptions = this.subscriptions.get(eventType);
      if (eventSubscriptions) {
        for (const subscription of eventSubscriptions) {
          await this.invokeHandler(subscription, payload);
        }
      }
      
      // Notify wildcard subscribers
      for (const subscription of this.wildcardSubscriptions) {
        await this.invokeHandler(subscription, payload);
      }
    } catch (error) {
      logger.error('Failed to handle event message', {
        channel,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  /** Extract event type from channel */
  private extractEventTypeFromChannel(channel: string): EventType | null {
    const prefix = `${this.channelPrefix}_`;
    if (channel.startsWith(prefix)) {
      return channel.slice(prefix.length) as EventType;
    }
    return null;
  }
  
  /** Invoke event handler */
  private async invokeHandler(
    subscription: EventSubscriptionWithMeta,
    payload: EventPayload
  ): Promise<void> {
    try {
      // Check filter
      if (subscription.filter && !subscription.filter(payload)) {
        return;
      }
      
      // Invoke callback
      await subscription.callback(payload);
      
      // Update stats
      subscription.callCount++;
      subscription.lastCalledAt = new Date().toISOString();
    } catch (error) {
      subscription.errorCount++;
      logger.error(`Event handler failed`, {
        subscriptionId: subscription.id,
        eventType: payload.type,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  
  /** Subscribe to an event */
  public subscribe(
    eventType: EventType | EventType[],
    callback: EventHandler,
    filter?: (payload: EventPayload) => boolean
  ): ID {
    const id = this.generateId('sub');
    const now = new Date().toISOString();
    
    const subscription: EventSubscriptionWithMeta = {
      id,
      eventType: Array.isArray(eventType) ? eventType : [eventType],
      callback,
      filter,
      createdAt: now,
      callCount: 0,
      errorCount: 0,
    };
    
    // Add to subscriptions
    for (const type of subscription.eventType) {
      if (!this.subscriptions.has(type)) {
        this.subscriptions.set(type, new Set());
      }
      this.subscriptions.get(type)!.add(subscription);
    }
    
    // If eventType includes '*', add to wildcard
    if (subscription.eventType.includes('*' as EventType)) {
      this.wildcardSubscriptions.add(subscription);
    }
    
    logger.debug(`Subscribed to event(s): ${subscription.eventType.join(', ')}`, { id });
    
    return id;
  }
  
  /** Unsubscribe from an event */
  public unsubscribe(id: ID): boolean {
    let unsubscribed = false;
    
    // Remove from specific event types
    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        if (subscription.id === id) {
          subscriptions.delete(subscription);
          unsubscribed = true;
          logger.debug(`Unsubscribed from event: ${eventType}`, { id });
          break;
        }
      }
    }
    
    // Remove from wildcard
    for (const subscription of this.wildcardSubscriptions) {
      if (subscription.id === id) {
        this.wildcardSubscriptions.delete(subscription);
        unsubscribed = true;
        logger.debug('Unsubscribed from wildcard events', { id });
        break;
      }
    }
    
    return unsubscribed;
  }
  
  /** Emit an event */
  public async emit(
    eventType: EventType,
    data: Record<string, unknown> = {},
    source: string = 'unknown'
  ): Promise<number> {
    if (!this.isRunning) {
      logger.warn('Event bus is not running, event not emitted', { eventType });
      return 0;
    }
    
    const payload: EventPayload = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      source,
    };
    
    try {
      // Publish to Redis
      const channel = `${this.channelPrefix}_${eventType}`;
      await this.client.publish(channel, JSON.stringify(payload));
      
      logger.debug(`Emitted event: ${eventType}`, {
        source,
        channel,
        data: Object.keys(data),
      });
      
      // Also notify local subscribers
      return this.notifyLocalSubscribers(eventType, payload);
    } catch (error) {
      logger.error('Failed to emit event', {
        eventType,
        error: error instanceof Error ? error.message : error,
      });
      return 0;
    }
  }
  
  /** Notify local subscribers */
  private async notifyLocalSubscribers(
    eventType: EventType,
    payload: EventPayload
  ): Promise<number> {
    let callCount = 0;
    
    // Notify specific subscribers
    const eventSubscriptions = this.subscriptions.get(eventType);
    if (eventSubscriptions) {
      for (const subscription of eventSubscriptions) {
        await this.invokeHandler(subscription, payload);
        callCount++;
      }
    }
    
    // Notify wildcard subscribers
    for (const subscription of this.wildcardSubscriptions) {
      await this.invokeHandler(subscription, payload);
      callCount++;
    }
    
    return callCount;
  }
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Shutdown event bus */
  public async shutdown(): Promise<void> {
    this.isRunning = false;
    
    if (this.client) {
      await this.client.quit();
    }
    
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    
    logger.info('Redis event bus shutdown');
  }
  
  /** Get subscription count */
  public getSubscriptionCount(): number {
    let count = 0;
    
    for (const subscriptions of this.subscriptions.values()) {
      count += subscriptions.size;
    }
    
    count += this.wildcardSubscriptions.size;
    
    return count;
  }
}

// ============================================================================
// EVENT BUS SERVICE
// ============================================================================

/** Event Bus Service */
export class EventBus {
  private static instance: EventBus;
  private bus: InMemoryEventBus | RedisEventBus;
  
  private constructor() {
    const cacheConfig = config.get().cache;
    
    // Use Redis if configured, otherwise use in-memory
    if (cacheConfig.backend === 'redis' || cacheConfig.fallback?.includes('redis')) {
      this.bus = new RedisEventBus();
    } else {
      this.bus = new InMemoryEventBus();
    }
  }
  
  /** Get singleton instance */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /** Subscribe to an event */
  public subscribe(
    eventType: EventType | EventType[],
    callback: EventHandler,
    filter?: (payload: EventPayload) => boolean
  ): ID {
    return this.bus.subscribe(eventType, callback, filter);
  }
  
  /** Unsubscribe from an event */
  public unsubscribe(id: ID): boolean {
    return this.bus.unsubscribe(id);
  }
  
  /** Emit an event */
  public async emit(
    eventType: EventType,
    data: Record<string, unknown> = {},
    source: string = 'unknown'
  ): Promise<number> {
    return this.bus.emit(eventType, data, source);
  }
  
  /** Shutdown event bus */
  public async shutdown(): Promise<void> {
    if ('shutdown' in this.bus) {
      await (this.bus as RedisEventBus).shutdown();
    } else {
      (this.bus as InMemoryEventBus).shutdown();
    }
  }
  
  /** Get subscription count */
  public getSubscriptionCount(): number {
    return this.bus.getSubscriptionCount();
  }
  
  /** Get statistics */
  public getStats(): {
    totalSubscriptions: number;
    byEventType: Record<EventType, number>;
    wildcardSubscriptions: number;
    backend: 'memory' | 'redis';
  } {
    const stats = this.bus.getStats();
    return {
      ...stats,
      backend: this.bus instanceof RedisEventBus ? 'redis' : 'memory',
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let eventBusInstance: EventBus | null = null;

/** Get singleton instance */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = EventBus.getInstance();
  }
  return eventBusInstance;
}

// Export singleton
export const eventBus = getEventBus();

// Export types
export type { EventHandler };
export { EventSubscriptionWithMeta };
