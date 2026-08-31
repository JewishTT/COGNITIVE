// platform/src/services/shared/lib/eventBus.ts
// [38;5;240mRedis-based Event Bus for Microservices Communication[0m
// [38;5;240mImplements Pub/Sub pattern for inter-service communication[0m

import { createClient, RedisClientType } from 'redis';
import {
  EventType,
  EventMessage,
  GraphEventData,
} from '../types';
import { getConfig, isTest } from '../config';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mEvent Handler Function[0m
 */
export type EventHandler<T = unknown> = (message: EventMessage<T>) => Promise<void> | void;

/**
 * [38;5;220mUnsubscribe Function[0m
 */
export type UnsubscribeFunction = () => Promise<void>;

/**
 * [38;5;220mSubscription Options[0m
 */
export interface SubscriptionOptions {
  channel?: string;
  pattern?: boolean;
  durable?: boolean;
}

// ============================================================================
// [38;5;220mEVENT BUS IMPLEMENTATION[0m
// ============================================================================

/**
 * [38;5;220mEvent Bus Class[0m
 * [38;5;240mHandles Redis Pub/Sub for inter-service communication[0m
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
  // [38;5;220mINITIALIZATION[0m
  // ==========================================================================

  /**
   * [38;5;220mInitialize the Event Bus[0m
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
        console.error(`[38;5;196m[EventBus:${this.serviceName}] Publisher Error:[0m`, err);
      });
      
      this.subscriber.on('error', (err) => {
        console.error(`[38;5;196m[EventBus:${this.serviceName}] Subscriber Error:[0m`, err);
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
      console.log(`[38;5;220m[EventBus:${this.serviceName}] Connected to Redis[0m`);
      
    } catch (error) {
      console.error(`[38;5;196m[EventBus:${this.serviceName}] Failed to initialize:[0m`, error);
      this.cleanup();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * [38;5;220mCheck if Event Bus is initialized[0m
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * [38;5;220mCleanup resources[0m
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
      console.error(`[38;5;196m[EventBus:${this.serviceName}] Cleanup error:[0m`, error);
    }
  }

  /**
   * [38;5;220mGraceful shutdown[0m
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
    console.log(`[38;5;220m[EventBus:${this.serviceName}] Shutdown complete[0m`);
  }

  // ==========================================================================
  // [38;5;220mPUBLISHING[0m
  // ==========================================================================

  /**
   * [38;5;220mPublish an event[0m
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
      console.log(`[38;5;220m[EventBus:${this.serviceName}] Published ${eventType} to ${targetChannel}[0m`);
    } catch (error) {
      console.error(`[38;5;196m[EventBus:${this.serviceName}] Failed to publish ${eventType}:[0m`, error);
      throw error;
    }
  }

  /**
   * [38;5;220mPublish graph-related event[0m
   */
  async publishGraphEvent(data: GraphEventData): Promise<void> {
    const eventType = this.inferEventTypeFromGraphData(data);
    await this.publish(eventType, data);
  }

  // ==========================================================================
  // [38;5;220mSUBSCRIPTIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mSubscribe to an event type[0m
   */
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): UnsubscribeFunction {
    const channel = this.getChannelForEvent(eventType);
    return this.subscribeToChannel(channel, handler);
  }

  /**
   * [38;5;220mSubscribe to a specific channel[0m
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
   * [38;5;220mSubscribe to multiple event types[0m
   */
  subscribeToEvents<T = unknown>(
    eventTypes: EventType[],
    handler: EventHandler<T>
  ): UnsubscribeFunction[] {
    return eventTypes.map(eventType => this.subscribe(eventType, handler));
  }

  /**
   * [38;5;220mSubscribe to all events[0m
   */
  subscribeToAll<T = unknown>(handler: EventHandler<T>): UnsubscribeFunction {
    return this.subscribeToChannel(this.PATTERN, handler);
  }

  // ==========================================================================
  // [38;5;220mMESSAGE HANDLING[0m
  // ==========================================================================

  /**
   * [38;5;220mHandle incoming message from Redis[0m
   */
  private async handleMessage(message: string, channel: string): Promise<void> {
    try {
      const parsedMessage: EventMessage = JSON.parse(message);
      
      // Validate message structure
      if (!parsedMessage.eventType || !parsedMessage.timestamp) {
        console.warn(`[38;5;208m[EventBus:${this.serviceName}] Invalid message structure[0m`);
        return;
      }
      
      // Handle message based on channel
      const handlers = this.handlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await handler(parsedMessage);
          } catch (error) {
            console.error(`[38;5;196m[EventBus:${this.serviceName}] Handler error for ${parsedMessage.eventType}:[0m`, error);
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
            console.error(`[38;5;196m[EventBus:${this.serviceName}] Handler error for ${parsedMessage.eventType}:[0m`, error);
          }
        }
      }
      
    } catch (error) {
      console.error(`[38;5;196m[EventBus:${this.serviceName}] Failed to parse message:[0m`, error);
    }
  }

  // ==========================================================================
  // [38;5;220mUTILITY METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mEnsure Event Bus is initialized[0m
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
   * [38;5;220mGet channel for event type[0m
   */
  private getChannelForEvent(eventType: EventType): string {
    return `${this.CHANNEL_PREFIX}${eventType}`;
  }

  /**
   * [38;5;220mInfer event type from graph data[0m
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
// [38;5;220mSINGLETON INSTANCE[0m
// ============================================================================

/**
 * [38;5;220mGlobal Event Bus instance[0m
 * [38;5;240mUse this for most use cases[0m
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
// [38;5;220mCONVENIENCE FUNCTIONS[0m
// ============================================================================

/**
 * [38;5;220mPublish an event (convenience function)[0m
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
 * [38;5;220mSubscribe to an event (convenience function)[0m
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
 * [38;5;220mPublish graph event (convenience function)[0m
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
// [38;5;220mEXPORTS[0m
// ============================================================================

export {
  EventBus,
  getEventBus,
  resetEventBus,
  publishEvent,
  subscribeToEvent,
  publishGraphEvent,
};
