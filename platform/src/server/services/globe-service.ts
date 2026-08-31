/**
 * COGNITIVE PLATFORM - GLOBE SERVICE IMPLEMENTATION
 * 
 * Manages Cesium globe state and WebSocket subscriptions.
 */

import { BaseService, ServiceHealth, createTimestamp } from '@cognitive/core';

interface LayerState {
  name: string;
  enabled: boolean;
  opacity: number;
  config: Record<string, any>;
}

/**
 * Globe Service - manages 3D visualization state
 */
export class GlobeService extends BaseService {
  private layers = new Map<string, LayerState>();
  private subscribers = new Map<string, Set<(data: any) => void>>();

  constructor() {
    super('globe', '0.1.0');
    this.initializeLayers();
  }

  private initializeLayers(): void {
    const defaultLayers = [
      { name: 'flights', enabled: true, opacity: 1.0 },
      { name: 'vessels', enabled: true, opacity: 1.0 },
      { name: 'satellites', enabled: true, opacity: 1.0 },
      { name: 'earthquakes', enabled: false, opacity: 1.0 },
      { name: 'fires', enabled: false, opacity: 1.0 },
      { name: 'cctv', enabled: false, opacity: 1.0 },
      { name: 'radio', enabled: false, opacity: 0.5 },
      { name: 'installations', enabled: false, opacity: 0.3 },
    ];

    for (const layer of defaultLayers) {
      this.layers.set(layer.name, {
        ...layer,
        config: {},
      });
      this.subscribers.set(layer.name, new Set());
    }
  }

  /**
   * Health check
   */
  async health(): Promise<ServiceHealth> {
    return {
      ready: true,
      status: 'up',
      latency: 0,
      lastCheck: createTimestamp(),
      version: this.version,
      details: {
        layersCount: this.layers.size,
        subscribersCount: Array.from(this.subscribers.values()).reduce(
          (sum, set) => sum + set.size,
          0
        ),
      },
    };
  }

  /**
   * Handle getConfig action
   */
  async handleGetConfig(payload: any, context: any): Promise<any> {
    const config: Record<string, LayerState> = {};

    for (const [name, state] of this.layers) {
      config[name] = state;
    }

    return { layers: config };
  }

  /**
   * Handle toggleLayer action
   */
  async handleToggleLayer(
    payload: { name: string; enabled?: boolean; opacity?: number },
    context: any
  ): Promise<any> {
    const layer = this.layers.get(payload.name);
    if (!layer) {
      throw new Error(`Layer ${payload.name} not found`);
    }

    if (payload.enabled !== undefined) {
      layer.enabled = payload.enabled;
    }
    if (payload.opacity !== undefined) {
      layer.opacity = Math.max(0, Math.min(1, payload.opacity));
    }

    // Notify subscribers
    this.notifySubscribers(payload.name, {
      event: 'layer_changed',
      layer: payload.name,
      state: layer,
    });

    return layer;
  }

  /**
   * Subscribe to layer updates
   */
  subscribe(layerName: string, callback: (data: any) => void): void {
    const subscribers = this.subscribers.get(layerName);
    if (subscribers) {
      subscribers.add(callback);
    }
  }

  /**
   * Unsubscribe from layer updates
   */
  unsubscribe(layerName: string, callback: (data: any) => void): void {
    const subscribers = this.subscribers.get(layerName);
    if (subscribers) {
      subscribers.delete(callback);
    }
  }

  /**
   * Notify all subscribers of a layer
   */
  private notifySubscribers(layerName: string, data: any): void {
    const subscribers = this.subscribers.get(layerName);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(data);
      }
    }
  }

  /**
   * Broadcast update to all layers
   */
  broadcastUpdate(data: any): void {
    for (const [layerName, subscribers] of this.subscribers) {
      for (const callback of subscribers) {
        callback({
          ...data,
          layer: layerName,
        });
      }
    }
  }
}

/**
 * Singleton instance
 */
let globeService: GlobeService | null = null;

export function getGlobeService(): GlobeService {
  if (!globeService) {
    globeService = new GlobeService();
  }
  return globeService;
}
