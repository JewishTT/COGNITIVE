/**
 * COGNITIVE PLATFORM - GRAPH SERVICE IMPLEMENTATION
 * 
 * Neo4j graph database interface via unified service contract.
 */

import { driver, Driver, Session, Result } from 'neo4j-driver';
import { BaseService, ServiceHealth, createTimestamp } from '@cognitive/core';
import { getConfigManager } from '@cognitive/core';

/**
 * Neo4j Graph Service
 */
export class GraphService extends BaseService {
  private driver: Driver | null = null;

  constructor() {
    super('graph', '0.1.0');
  }

  /**
   * Initialize connection
   */
  async initialize(): Promise<void> {
    const config = getConfigManager();
    const graphConfig = config.getServiceConfig('graph');

    if (!graphConfig?.url) {
      throw new Error('Neo4j URL not configured');
    }

    this.driver = driver(
      graphConfig.url,
      {
        auth: {
          username: graphConfig.auth?.username || 'neo4j',
          password: graphConfig.auth?.password || 'password',
        },
      },
      {
        connectionTimeout: graphConfig.timeout || 10000,
      }
    );
  }

  /**
   * Health check
   */
  async health(): Promise<ServiceHealth> {
    if (!this.driver) {
      return {
        ready: false,
        status: 'down',
        latency: 0,
        lastCheck: createTimestamp(),
      };
    }

    const start = Date.now();
    try {
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();

      return {
        ready: true,
        status: 'up',
        latency: Date.now() - start,
        lastCheck: createTimestamp(),
        version: this.version,
      };
    } catch (error) {
      return {
        ready: false,
        status: 'down',
        latency: Date.now() - start,
        lastCheck: createTimestamp(),
        details: { error: String(error) },
      };
    }
  }

  /**
   * Handle query action
   */
  async handleQuery(
    payload: { cypher: string; params?: Record<string, any> },
    context: any
  ): Promise<any> {
    if (!this.driver) {
      throw new Error('Graph service not initialized');
    }

    const session = this.driver.session();
    try {
      const result = await session.run(payload.cypher, payload.params || {});
      return {
        records: result.records.map((r) => r.toObject()),
        summary: {
          nodesCreated: result.summary.counters.nodesCreated(),
          nodesDeleted: result.summary.counters.nodesDeleted(),
          relationshipsCreated: result.summary.counters.relationshipsCreated(),
          relationshipsDeleted: result.summary.counters.relationshipsDeleted(),
        },
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Handle analyze action
   */
  async handleAnalyze(
    payload: { nodeType?: string; relationshipType?: string },
    context: any
  ): Promise<any> {
    if (!this.driver) {
      throw new Error('Graph service not initialized');
    }

    const session = this.driver.session();
    try {
      // Get graph statistics
      let query =
        'MATCH (n) RETURN labels(n)[0] as type, count(n) as count GROUP BY type';

      if (payload.nodeType) {
        query = `MATCH (n:${payload.nodeType}) RETURN count(n) as count`;
      }

      const result = await session.run(query);
      return {
        analysis: result.records.map((r) => r.toObject()),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Handle getNode action
   */
  async handleGetNode(
    payload: { id: string },
    context: any
  ): Promise<any> {
    if (!this.driver) {
      throw new Error('Graph service not initialized');
    }

    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (n) WHERE id(n) = $id RETURN n, relationships(n) as rels',
        { id: parseInt(payload.id) }
      );

      if (result.records.length === 0) {
        throw new Error(`Node with id ${payload.id} not found`);
      }

      return result.records[0].toObject();
    } finally {
      await session.close();
    }
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}

/**
 * Singleton instance
 */
let graphService: GraphService | null = null;

export async function getGraphService(): Promise<GraphService> {
  if (!graphService) {
    graphService = new GraphService();
    await graphService.initialize();
  }
  return graphService;
}
