// platform/src/services/shared/lib/eventBus.ts
// Redis-based Event Bus for Microservices Communication
// Implements Pub/Sub pattern for inter-service communication

import { createClient, RedisClientType } from 'redis';
import {
  EventType,
  EventMessage,
  GraphEventData,
} from '../types';
import { getConfig, isTest } from '../config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event Handler Function
 */
export type EventHandler<T = unknown> = (message: EventMessage<T>) => Promise<void> | void;

/**
 * Unsubscribe Function
 */
export type UnsubscribeFunction = () => Promise<void>;

/**
 * Subscription Options
 */
export interface SubscriptionOptions {
  channel?: string;
  pattern?: boolean;
  durable?: boolean;
}

// ============================================================================
// EVENT BUS IMPLEMENTATION
// ============================================================================

/**
 * Event Bus Class
 * Handles Redis Pub/Sub for inter-service communication
 */
export class EventBus {
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private initialized: boolean = false;
  private connecting: boolean = false;
  
  // Channel prefixes
  private readonly CHANNEL_PREFIX = 'osint:';
  private readonly PATTERN = 'osint:*';
  
  // Service name for message tracking
  private serviceName: string;

  constructor(serviceName: string = 'unknown') {
    this.serviceName = serviceName;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the Event Bus
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.connecting) {
      return;
    }
    
    this.connecting = true;
    
    try {
      const config = getConfig();
      
      // Create Redis clients
      this.publisher = createClient({
        url: config.REDIS_URI,
        password: config.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
        },
      });
      
      this.subscriber = createClient({
        url: config.REDIS_URI,
        password: config.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
        },
      });
      
      // Handle Redis errors
      this.publisher.on('error', (err) => {
        console.error(`[EventBus:${this.serviceName}] Publisher Error:`, err);
      });
      
      this.subscriber.on('error', (err) => {
        console.error(`[EventBus:${this.serviceName}] Subscriber Error:`, err);
      });
      
      // Connect clients
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);
      
      // Subscribe to all OSINT events
      await this.subscriber.subscribe(this.PATTERN, (message, channel) => {
        this.handleMessage(message, channel);
      });
      
      this.initialized = true;
      console.log(`[EventBus:${this.serviceName}] Connected to Redis`);
      
    } catch (error) {
      console.error(`[EventBus:${this.serviceName}] Failed to initialize:`, error);
      this.cleanup();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Check if Event Bus is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      this.handlers.clear();
      this.initialized = false;
    } catch (error) {
      console.error(`[EventBus:${this.serviceName}] Cleanup error:`, error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
    console.log(`[EventBus:${this.serviceName}] Shutdown complete`);
  }

  // ==========================================================================
  // PUBLISHING
  // ==========================================================================

  /**
   * Publish an event
   */
  async publish<T = unknown>(
    eventType: EventType,
    data: T,
    channel?: string
  ): Promise<void> {
    await this.ensureInitialized();
    
    const message: EventMessage<T> = {
      eventType,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        service: this.serviceName,
        version: '1.0.0',
      },
    };
    
    const targetChannel = channel || this.getChannelForEvent(eventType);
    
    try {
      await this.publisher?.publish(targetChannel, JSON.stringify(message));
      console.log(`[EventBus:${this.serviceName}] Published ${eventType} to ${targetChannel}`);
    } catch (error) {
      console.error(`[EventBus:${this.serviceName}] Failed to publish ${eventType}:`, error);
      throw error;
    }
  }

  /**
   * Publish graph-related event
   */
  async publishGraphEvent(data: GraphEventData): Promise<void> {
    const eventType = this.inferEventTypeFromGraphData(data);
    await this.publish(eventType, data);
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  /**
   * Subscribe to an event type
   */
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): UnsubscribeFunction {
    const channel = this.getChannelForEvent(eventType);
    return this.subscribeToChannel(channel, handler);
  }

  /**
   * Subscribe to a specific channel
   */
  subscribeToChannel<T = unknown>(
    channel: string,
    handler: EventHandler<T>
  ): UnsubscribeFunction {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    
    this.handlers.get(channel)?.add(handler);
    
    return async () => {
      this.handlers.get(channel)?.delete(handler);
      
      // If no more handlers for this channel, unsubscribe from Redis
      if (this.handlers.get(channel)?.size === 0) {
        await this.subscriber?.unsubscribe(channel);
        this.handlers.delete(channel);
      }
    };
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeToEvents<T = unknown>(
    eventTypes: EventType[],
    handler: EventHandler<T>
  ): UnsubscribeFunction[] {
    return eventTypes.map(eventType => this.subscribe(eventType, handler));
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll<T = unknown>(handler: EventHandler<T>): UnsubscribeFunction {
    return this.subscribeToChannel(this.PATTERN, handler);
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Handle incoming message from Redis
   */
  private async handleMessage(message: string, channel: string): Promise<void> {
    try {
      const parsedMessage: EventMessage = JSON.parse(message);
      
      // Validate message structure
      if (!parsedMessage.eventType || !parsedMessage.timestamp) {
        console.warn(`[EventBus:${this.serviceName}] Invalid message structure`);
        return;
      }
      
      // Handle message based on channel
      const handlers = this.handlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await handler(parsedMessage);
          } catch (error) {
            console.error(`[EventBus:${this.serviceName}] Handler error for ${parsedMessage.eventType}:`, error);
          }
        }
      }
      
      // Also check for event type specific handlers
      const eventHandlers = this.handlers.get(parsedMessage.eventType);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          try {
            await handler(parsedMessage);
          } catch (error) {
            console.error(`[EventBus:${this.serviceName}] Handler error for ${parsedMessage.eventType}:`, error);
          }
        }
      }
      
    } catch (error) {
      console.error(`[EventBus:${this.serviceName}] Failed to parse message:`, error);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Ensure Event Bus is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      if (isTest()) {
        // In test mode, skip initialization
        return;
      }
      await this.initialize();
    }
  }

  /**
   * Get channel for event type
   */
  private getChannelForEvent(eventType: EventType): string {
    return `${this.CHANNEL_PREFIX}${eventType}`;
  }

  /**
   * Infer event type from graph data
   */
  private inferEventTypeFromGraphData(data: GraphEventData): EventType {
    if (data.changes?.addedNodes?.length > 0) {
      return 'node:created';
    }
    if (data.changes?.updatedNodes?.length > 0) {
      return 'node:updated';
    }
    if (data.changes?.deletedNodes?.length > 0) {
      return 'node:deleted';
    }
    if (data.changes?.addedEdges?.length > 0) {
      return 'edge:created';
    }
    if (data.changes?.updatedEdges?.length > 0) {
      return 'edge:updated';
    }
    if (data.changes?.deletedEdges?.length > 0) {
      return 'edge:deleted';
    }
    
    return 'graph:updated';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global Event Bus instance
 * Use this for most use cases
 */
let globalEventBus: EventBus | null = null;

export function getEventBus(serviceName?: string): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus(serviceName);
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.shutdown();
    globalEventBus = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Publish an event (convenience function)
 */
export async function publishEvent<T = unknown>(
  eventType: EventType,
  data: T,
  serviceName?: string
): Promise<void> {
  const bus = getEventBus(serviceName);
  await bus.initialize();
  await bus.publish(eventType, data);
}

/**
 * Subscribe to an event (convenience function)
 */
export function subscribeToEvent<T = unknown>(
  eventType: EventType,
  handler: EventHandler<T>,
  serviceName?: string
): UnsubscribeFunction {
  const bus = getEventBus(serviceName);
  return bus.subscribe(eventType, handler);
}

/**
 * Publish graph event (convenience function)
 */
export async function publishGraphEvent(
  data: GraphEventData,
  serviceName?: string
): Promise<void> {
  const bus = getEventBus(serviceName);
  await bus.initialize();
  await bus.publishGraphEvent(data);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  EventBus,
  getEventBus,
  resetEventBus,
  publishEvent,
  subscribeToEvent,
  publishGraphEvent,
};
