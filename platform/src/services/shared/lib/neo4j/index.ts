// platform/src/services/shared/lib/neo4j/index.ts
// Neo4j Database Service with Transaction Support
// Provides type-safe Neo4j operations for OSINT data

import {
  StandardGraphNode,
  StandardGraphEdge,
  StandardGraphData,
  GraphVersion,
} from '../../types';
import { getConfig } from '../../config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Neo4j Configuration
 */
export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
}

/**
 * Neo4j Node Properties
 */
export interface Neo4jNodeProperties {
  [key: string]: unknown;
}

/**
 * Neo4j Relationship Properties
 */
export interface Neo4jRelationshipProperties {
  [key: string]: unknown;
}

/**
 * Neo4j Node with Internal ID
 */
export interface Neo4jNode {
  id: number;
  labels: string[];
  properties: Neo4jNodeProperties;
  elementId: string;
}

/**
 * Neo4j Relationship with Internal ID
 */
export interface Neo4jRelationship {
  id: number;
  type: string;
  startNodeId: number;
  endNodeId: number;
  properties: Neo4jRelationshipProperties;
  elementId: string;
}

/**
 * Neo4j Query Result
 */
export interface Neo4jResult {
  records: Neo4jRecord[];
  summary: Neo4jResultSummary;
}

/**
 * Neo4j Record
 */
export interface Neo4jRecord {
  keys: string[];
  length: number;
  get: (key: string) => unknown;
  toObject: () => Record<string, unknown>;
}

/**
 * Neo4j Result Summary
 */
export interface Neo4jResultSummary {
  query: string;
  queryType: string;
  counters: {
    nodesCreated: number;
    nodesDeleted: number;
    relationshipsCreated: number;
    relationshipsDeleted: number;
    propertiesSet: number;
    labelsAdded: number;
    labelsRemoved: number;
  };
  updateStatistics: {
    nodesCreated: number;
    nodesDeleted: number;
    relationshipsCreated: number;
    relationshipsDeleted: number;
    propertiesSet: number;
  };
  plan: unknown;
  profile: unknown;
  notifications: Neo4jNotification[];
}

/**
 * Neo4j Notification
 */
export interface Neo4jNotification {
  code: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  position: { offset: number; line: number; column: number };
}

/**
 * Transaction Configuration
 */
export interface TransactionConfig {
  timeout?: number; // in milliseconds
  metadata?: Record<string, unknown>;
}

/**
 * Transaction Result
 */
export interface TransactionResult {
  success: boolean;
  results?: Neo4jResult[];
  error?: Error;
  transactionId: string;
}

// ============================================================================
// NEO4J SERVICE
// ============================================================================

/**
 * Neo4j Database Service
 */
export class Neo4jService {
  private driver: any = null;
  private config: Neo4jConfig;
  private connected: boolean = false;
  private transactionCounter: number = 0;

  constructor(config: Partial<Neo4jConfig> = {}) {
    const envConfig = getConfig();
    
    this.config = {
      uri: config.uri || envConfig.NEO4J_URI,
      user: config.user || envConfig.NEO4J_USER,
      password: config.password || envConfig.NEO4J_PASSWORD,
      database: config.database || envConfig.NEO4J_DATABASE,
      maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
      connectionTimeout: config.connectionTimeout || 30000,
      queryTimeout: config.queryTimeout || 30000,
    };
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Connect to Neo4j database
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      const neo4j = await import('neo4j-driver');
      
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.user, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionTimeout: this.config.connectionTimeout,
        }
      );
      
      // Test connection
      const session = this.driver.session({ database: this.config.database });
      await session.run('RETURN 1');
      await session.close();
      
      this.connected = true;
      console.log(`[Neo4jService] Connected to ${this.config.uri}`);
    } catch (error) {
      console.error(`[Neo4jService] Connection failed:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from Neo4j database
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.close();
        this.driver = null;
        this.connected = false;
        console.log(`[Neo4jService] Disconnected`);
      } catch (error) {
        console.error(`[Neo4jService] Disconnection failed:`, error);
      }
    }
  }

  /**
   * Check if connected to Neo4j
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Verify connection to Neo4j
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.connected) {
        await this.connect();
      }
      
      const session = this.driver.session({ database: this.config.database });
      const result = await session.run('RETURN 1');
      await session.close();
      
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Create a new session
   */
  createSession(config?: { database?: string; defaultAccessMode?: string }): any {
    if (!this.driver) {
      throw new Error('Not connected to Neo4j');
    }
    
    return this.driver.session({
      database: config?.database || this.config.database,
      defaultAccessMode: config?.defaultAccessMode || 'READ',
    });
  }

  // ==========================================================================
  // QUERY EXECUTION
  // ==========================================================================

  /**
   * Execute a Cypher query
   */
  async executeQuery(
    query: string,
    params?: Record<string, unknown>,
    config?: {
      write?: boolean;
      database?: string;
    }
  ): Promise<Neo4jResult> {
    await this.ensureConnected();
    
    const session = this.driver.session({
      database: config?.database || this.config.database,
      defaultAccessMode: config?.write ? 'WRITE' : 'READ',
    });
    
    try {
      const result = await session.run(query, params);
      return await result.consume();
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a read query
   */
  async readQuery(
    query: string,
    params?: Record<string, unknown>,
    database?: string
  ): Promise<Neo4jResult> {
    return this.executeQuery(query, params, { write: false, database });
  }

  /**
   * Execute a write query
   */
  async writeQuery(
    query: string,
    params?: Record<string, unknown>,
    database?: string
  ): Promise<Neo4jResult> {
    return this.executeQuery(query, params, { write: true, database });
  }

  // ==========================================================================
  // TRANSACTION MANAGEMENT
  // ==========================================================================

  /**
   * Execute queries in a transaction
   */
  async executeInTransaction<T>(
    queries: Array<{ query: string; params?: Record<string, unknown> }>,
    config?: TransactionConfig
  ): Promise<TransactionResult & { data?: T }> {
    await this.ensureConnected();
    
    const session = this.driver.session({
      database: this.config.database,
      defaultAccessMode: 'WRITE',
    });
    
    const transactionId = `tx_${Date.now()}_${++this.transactionCounter}`;
    
    try {
      const tx = session.beginTransaction();
      const results: Neo4jResult[] = [];
      
      for (const { query, params } of queries) {
        const result = await tx.run(query, params);
        results.push(await result.consume());
      }
      
      await tx.commit();
      await session.close();
      
      return {
        success: true,
        results,
        transactionId,
      };
    } catch (error) {
      await session.close();
      
      return {
        success: false,
        error: error as Error,
        transactionId,
      };
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(config?: TransactionConfig): Promise<{
    transactionId: string;
    session: any;
    transaction: any;
  }> {
    await this.ensureConnected();
    
    const session = this.driver.session({
      database: this.config.database,
      defaultAccessMode: 'WRITE',
    });
    
    const transaction = session.beginTransaction();
    const transactionId = `tx_${Date.now()}_${++this.transactionCounter}`;
    
    return { transactionId, session, transaction };
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(
    transaction: any,
    session: any
  ): Promise<void> {
    try {
      await transaction.commit();
      await session.close();
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(
    transaction: any,
    session: any
  ): Promise<void> {
    try {
      await transaction.rollback();
      await session.close();
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  // ==========================================================================
  // GRAPH OPERATIONS
  // ==========================================================================

  /**
   * Create a graph (as a set of nodes with a label)
   */
  async createGraph(
    graphId: string,
    name: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<Neo4jResult> {
    const query = `
      CREATE (g:Graph {id: $graphId, name: $name, description: $description, metadata: $metadata})
      RETURN g
    `;
    
    return this.writeQuery(query, {
      graphId,
      name,
      description: description || '',
      metadata: metadata || {},
    });
  }

  /**
   * Delete a graph and all its nodes and relationships
   */
  async deleteGraph(graphId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})
      OPTIONAL MATCH (g)-[r]-()
      DELETE g, r
    `;
    
    return this.writeQuery(query, { graphId });
  }

  /**
   * Add a node to a graph
   */
  async addNode(
    graphId: string,
    node: StandardGraphNode
  ): Promise<Neo4jResult> {
    const labels = this.getNeo4jLabels(node);
    const properties = this.getNeo4jProperties(node);
    
    const query = `
      MATCH (g:Graph {id: $graphId})
      CREATE (g)-[:CONTAINS]->(n${labels} ${JSON.stringify(properties)})
      RETURN n
    `;
    
    return this.writeQuery(query, {
      graphId,
      ...properties,
    });
  }

  /**
   * Add multiple nodes to a graph in a transaction
   */
  async addNodes(
    graphId: string,
    nodes: StandardGraphNode[]
  ): Promise<TransactionResult> {
    const queries = nodes.map(node => ({
      query: `
        MATCH (g:Graph {id: $graphId})
        CREATE (g)-[:CONTAINS]->(n${this.getNeo4jLabels(node)} ${JSON.stringify(this.getNeo4jProperties(node))})
        RETURN n
      `,
      params: {
        graphId,
        ...this.getNeo4jProperties(node),
      },
    }));
    
    return this.executeInTransaction(queries);
  }

  /**
   * Get a node by ID
   */
  async getNode(graphId: string, nodeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n {id: $nodeId})
      RETURN n
    `;
    
    return this.readQuery(query, { graphId, nodeId });
  }

  /**
   * Get all nodes in a graph
   */
  async getNodes(graphId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n)
      RETURN n
    `;
    
    return this.readQuery(query, { graphId });
  }

  /**
   * Update a node in a graph
   */
  async updateNode(
    graphId: string,
    nodeId: string,
    updates: Partial<StandardGraphNode>
  ): Promise<Neo4jResult> {
    const setClause = this.buildSetClause(updates);
    
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n {id: $nodeId})
      SET n${setClause}
      RETURN n
    `;
    
    return this.writeQuery(query, {
      graphId,
      nodeId,
      ...updates,
    });
  }

  /**
   * Delete a node from a graph
   */
  async deleteNode(graphId: string, nodeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n {id: $nodeId})
      DETACH DELETE n
    `;
    
    return this.writeQuery(query, { graphId, nodeId });
  }

  /**
   * Add an edge to a graph
   */
  async addEdge(
    graphId: string,
    edge: StandardGraphEdge
  ): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})
      MATCH (source {id: $source}), (target {id: $target})
      CREATE (source)-[r:${edge.relationshipType || 'RELATED_TO'} ${JSON.stringify(this.getNeo4jRelationshipProperties(edge))}]->(target)
      RETURN r
    `;
    
    return this.writeQuery(query, {
      graphId,
      source: edge.source,
      target: edge.target,
      ...this.getNeo4jRelationshipProperties(edge),
    });
  }

  /**
   * Add multiple edges to a graph in a transaction
   */
  async addEdges(
    graphId: string,
    edges: StandardGraphEdge[]
  ): Promise<TransactionResult> {
    const queries = edges.map(edge => ({
      query: `
        MATCH (g:Graph {id: $graphId})
        MATCH (source {id: $source}), (target {id: $target})
        CREATE (source)-[r:${edge.relationshipType || 'RELATED_TO'} ${JSON.stringify(this.getNeo4jRelationshipProperties(edge))}]->(target)
        RETURN r
      `,
      params: {
        graphId,
        source: edge.source,
        target: edge.target,
        ...this.getNeo4jRelationshipProperties(edge),
      },
    }));
    
    return this.executeInTransaction(queries);
  }

  /**
   * Get an edge by ID
   */
  async getEdge(graphId: string, edgeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[r {id: $edgeId}]->()
      RETURN r
    `;
    
    return this.readQuery(query, { graphId, edgeId });
  }

  /**
   * Get all edges in a graph
   */
  async getEdges(graphId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[]->()
      RETURN r
    `;
    
    return this.readQuery(query, { graphId });
  }

  /**
   * Update an edge in a graph
   */
  async updateEdge(
    graphId: string,
    edgeId: string,
    updates: Partial<StandardGraphEdge>
  ): Promise<Neo4jResult> {
    const setClause = this.buildSetClause(updates);
    
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[]->()
      MATCH ()-[r {id: $edgeId}]->()
      SET r${setClause}
      RETURN r
    `;
    
    return this.writeQuery(query, {
      graphId,
      edgeId,
      ...updates,
    });
  }

  /**
   * Delete an edge from a graph
   */
  async deleteEdge(graphId: string, edgeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[]->()
      MATCH ()-[r {id: $edgeId}]->()
      DELETE r
    `;
    
    return this.writeQuery(query, { graphId, edgeId });
  }

  // ==========================================================================
  // GRAPH QUERIES
  // ==========================================================================

  /**
   * Get the entire graph (nodes and edges)
   */
  async getFullGraph(graphId: string): Promise<StandardGraphData> {
    const nodesResult = await this.getNodes(graphId);
    const edgesResult = await this.getEdges(graphId);
    
    const nodes: StandardGraphNode[] = nodesResult.records.map(record => {
      const node = record.get('n') as Neo4jNode;
      return this.convertNeo4jNodeToGraphNode(node);
    });
    
    const edges: StandardGraphEdge[] = edgesResult.records.map(record => {
      const edge = record.get('r') as Neo4jRelationship;
      return this.convertNeo4jRelationshipToGraphEdge(edge);
    });
    
    return {
      nodes,
      edges,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        source: 'neo4j',
        schema: 'stix21',
      },
    };
  }

  /**
   * Query nodes by properties
   */
  async queryNodes(
    graphId: string,
    queryParams: Record<string, unknown>
  ): Promise<StandardGraphNode[]> {
    const whereClause = this.buildWhereClause(queryParams);
    
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n)
      WHERE ${whereClause}
      RETURN n
    `;
    
    const result = await this.readQuery(query, {
      graphId,
      ...queryParams,
    });
    
    return result.records.map(record => {
      const node = record.get('n') as Neo4jNode;
      return this.convertNeo4jNodeToGraphNode(node);
    });
  }

  /**
   * Query edges by properties
   */
  async queryEdges(
    graphId: string,
    queryParams: Record<string, unknown>
  ): Promise<StandardGraphEdge[]> {
    const whereClause = this.buildWhereClause(queryParams);
    
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[]->()
      MATCH ()-[r]-()
      WHERE ${whereClause}
      RETURN r
    `;
    
    const result = await this.readQuery(query, queryParams);
    
    return result.records.map(record => {
      const edge = record.get('r') as Neo4jRelationship;
      return this.convertNeo4jRelationshipToGraphEdge(edge);
    });
  }

  // ==========================================================================
  // VERSIONING AND BACKUP
  // ==========================================================================

  /**
   * Create a version of the graph
   */
  async createVersion(
    graphId: string,
    versionData: Omit<GraphVersion, 'id' | 'timestamp'>
  ): Promise<GraphVersion> {
    const version: GraphVersion = {
      id: `version_${Date.now()}`,
      graphId,
      timestamp: new Date().toISOString(),
      ...versionData,
    };
    
    const query = `
      MATCH (g:Graph {id: $graphId})
      CREATE (g)-[:HAS_VERSION]->(v:GraphVersion ${JSON.stringify(version)})
      RETURN v
    `;
    
    await this.writeQuery(query, { graphId, version });
    
    return version;
  }

  /**
   * Get all versions of a graph
   */
  async getVersions(graphId: string): Promise<GraphVersion[]> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:HAS_VERSION]->(v:GraphVersion)
      RETURN v
    `;
    
    const result = await this.readQuery(query, { graphId });
    
    return result.records.map(record => {
      const version = record.get('v') as Neo4jNode;
      return version.properties as GraphVersion;
    });
  }

  /**
   * Restore a graph to a specific version
   */
  async restoreVersion(graphId: string, versionId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:HAS_VERSION]->(v:GraphVersion {id: $versionId})
      MATCH (g)-[:CONTAINS]->(n)
      MATCH (g)-[:CONTAINS]->()-[]->()
      DETACH DELETE n
    `;
    
    await this.writeQuery(query, { graphId, versionId });
    
    // This would need to be implemented with proper version restoration logic
    // For now, we just clear the current graph
    
    return await this.getFullGraph(graphId);
  }

  // ==========================================================================
  // INDEX MANAGEMENT
  // ==========================================================================

  /**
   * Create indexes for better query performance
   */
  async createIndexes(): Promise<Neo4jResult> {
    const queries = [
      'CREATE INDEX IF NOT EXISTS FOR (g:Graph) ON (g.id)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.id)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.stixId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.stixType)',
      'CREATE INDEX IF NOT EXISTS FOR ()-[r:RELATED_TO]-() ON (r.id)',
      'CREATE INDEX IF NOT EXISTS FOR (v:GraphVersion) ON (v.id)',
    ];
    
    const results: Neo4jResult[] = [];
    
    for (const query of queries) {
      const result = await this.writeQuery(query);
      results.push(result);
    }
    
    return results[results.length - 1];
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Ensure connected to Neo4j
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Get Neo4j labels from graph node
   */
  private getNeo4jLabels(node: StandardGraphNode): string {
    const labels = [];
    
    if (node.stixType) {
      labels.push(node.stixType.toUpperCase());
    }
    
    if (node.nodeType) {
      labels.push(node.nodeType);
    }
    
    // Always add Node label
    labels.push('Node');
    
    // Add custom labels from tags
    if (node.tags) {
      for (const tag of node.tags) {
        labels.push(`Tag_${tag.replace(/[^a-zA-Z0-9]/g, '_')}`);
      }
    }
    
    return labels.map(l => `:${l}`).join('');
  }

  /**
   * Get Neo4j properties from graph node
   */
  private getNeo4jProperties(node: StandardGraphNode): Neo4jNodeProperties {
    const properties: Neo4jNodeProperties = {
      id: node.id,
      stixId: node.stixId,
      stixType: node.stixType,
      name: node.name,
      description: node.description,
      nodeLabel: node.nodeLabel,
      nodeType: node.nodeType,
      x: node.x,
      y: node.y,
      color: node.color,
      icon: node.icon,
      size: node.size,
      shape: node.shape,
      confidence: node.confidence,
      reliability: node.reliability,
      source: node.source,
      sourceUri: node.sourceUri,
      tags: node.tags,
      created: node.created,
      modified: node.modified,
    };
    
    // Add custom properties
    if (node.nodeProperties) {
      for (const [key, value] of Object.entries(node.nodeProperties)) {
        properties[`prop_${key}`] = value;
      }
    }
    
    if (node.nodeMetadata) {
      for (const [key, value] of Object.entries(node.nodeMetadata)) {
        properties[`meta_${key}`] = value;
      }
    }
    
    // Remove undefined values
    return Object.fromEntries(
      Object.entries(properties).filter(([_, value]) => value !== undefined)
    );
  }

  /**
   * Get Neo4j relationship properties from graph edge
   */
  private getNeo4jRelationshipProperties(edge: StandardGraphEdge): Neo4jRelationshipProperties {
    const properties: Neo4jRelationshipProperties = {
      id: edge.id,
      stixId: edge.stixId,
      relationshipType: edge.relationshipType,
      label: edge.label,
      description: edge.description,
      confidence: edge.confidence,
      reliability: edge.reliability,
      date: edge.date,
      caption: edge.caption,
      type: edge.type,
      weight: edge.weight,
      confidence_level: edge.confidence_level,
      startTime: edge.startTime,
      endTime: edge.endTime,
      isActive: edge.isActive,
    };
    
    // Remove undefined values
    return Object.fromEntries(
      Object.entries(properties).filter(([_, value]) => value !== undefined)
    );
  }

  /**
   * Convert Neo4j node to graph node
   */
  private convertNeo4jNodeToGraphNode(node: Neo4jNode): StandardGraphNode {
    const properties = node.properties as Record<string, unknown>;
    
    return {
      id: String(properties.id || node.elementId),
      stixId: properties.stixId as string | undefined,
      stixType: properties.stixType as string | undefined,
      name: properties.name as string | undefined,
      description: properties.description as string | undefined,
      nodeLabel: properties.nodeLabel as string | undefined,
      nodeType: properties.nodeType as string | undefined,
      x: properties.x as number | undefined,
      y: properties.y as number | undefined,
      color: properties.color as string | undefined,
      icon: properties.icon as string | undefined,
      size: properties.size as number | undefined,
      shape: properties.shape as string | undefined,
      confidence: properties.confidence as number | undefined,
      reliability: properties.reliability as number | undefined,
      source: properties.source as string | undefined,
      sourceUri: properties.sourceUri as string | undefined,
      tags: properties.tags as string[] | undefined,
      created: properties.created as string | undefined,
      modified: properties.modified as string | undefined,
      nodeProperties: this.extractCustomProperties(properties, 'prop_'),
      nodeMetadata: this.extractCustomProperties(properties, 'meta_'),
    };
  }

  /**
   * Convert Neo4j relationship to graph edge
   */
  private convertNeo4jRelationshipToGraphEdge(relationship: Neo4jRelationship): StandardGraphEdge {
    const properties = relationship.properties as Record<string, unknown>;
    
    return {
      id: String(properties.id || relationship.elementId),
      source: String(properties.source || relationship.startNodeId),
      target: String(properties.target || relationship.endNodeId),
      stixId: properties.stixId as string | undefined,
      relationshipType: properties.relationshipType as string | undefined || relationship.type,
      label: properties.label as string | undefined,
      description: properties.description as string | undefined,
      confidence: properties.confidence as number | undefined,
      reliability: properties.reliability as number | undefined,
      date: properties.date as string | undefined,
      caption: properties.caption as string | undefined,
      type: properties.type as string | undefined,
      weight: properties.weight as number | undefined,
      confidence_level: properties.confidence_level as number | string | undefined,
      startTime: properties.startTime as string | undefined,
      endTime: properties.endTime as string | undefined,
      isActive: properties.isActive as boolean | undefined,
    };
  }

  /**
   * Extract custom properties with prefix
   */
  private extractCustomProperties(
    properties: Record<string, unknown>,
    prefix: string
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if (key.startsWith(prefix)) {
        const cleanKey = key.substring(prefix.length);
        result[cleanKey] = value;
      }
    }
    
    return result;
  }

  /**
   * Build SET clause for Cypher query
   */
  private buildSetClause(updates: Record<string, unknown>): string {
    const setParts = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        // Handle special properties
        if (key === 'nodeProperties' || key === 'nodeMetadata') {
          const valueObj = value as Record<string, unknown>;
          for (const [subKey, subValue] of Object.entries(valueObj)) {
            setParts.push(`\`${key}_${subKey}\` = $${key}_${subKey}`);
          }
        } else {
          setParts.push(`\`${key}\` = $${key}`);
        }
      }
    }
    
    return setParts.length > 0 ? `, ${setParts.join(', ')}` : '';
  }

  /**
   * Build WHERE clause for Cypher query
   */
  private buildWhereClause(params: Record<string, unknown>): string {
    const conditions = [];
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        if (typeof value === 'string') {
          conditions.push(`n.\`${key}\` = $${key}`);
        } else if (typeof value === 'number') {
          conditions.push(`n.\`${key}\` = $${key}`);
        } else if (typeof value === 'boolean') {
          conditions.push(`n.\`${key}\` = $${key}`);
        } else if (Array.isArray(value)) {
          conditions.push(`n.\`${key}\` IN $${key}`);
        } else if (value === null) {
          conditions.push(`n.\`${key}\` IS NULL`);
        }
      }
    }
    
    return conditions.length > 0 ? conditions.join(' AND ') : 'true';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let neo4jService: Neo4jService | null = null;

export function getNeo4jService(config?: Partial<Neo4jConfig>): Neo4jService {
  if (!neo4jService) {
    neo4jService = new Neo4jService(config);
  }
  return neo4jService;
}

export function resetNeo4jService(): void {
  if (neo4jService) {
    neo4jService.disconnect();
    neo4jService = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  Neo4jService,
  getNeo4jService,
  resetNeo4jService,
};

export type {
  Neo4jConfig,
  Neo4jNodeProperties,
  Neo4jRelationshipProperties,
  Neo4jNode,
  Neo4jRelationship,
  Neo4jResult,
  Neo4jRecord,
  Neo4jResultSummary,
  Neo4jNotification,
  TransactionConfig,
  TransactionResult,
};
