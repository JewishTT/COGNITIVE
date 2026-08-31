// platform/src/services/shared/lib/neo4j/index.ts
// [38;5;240mNeo4j Database Service with Transaction Support[0m
// [38;5;240mProvides type-safe Neo4j operations for OSINT data[0m

import {
  StandardGraphNode,
  StandardGraphEdge,
  StandardGraphData,
  GraphVersion,
} from '../../types';
import { getConfig } from '../../config';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mNeo4j Configuration[0m
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
 * [38;5;220mNeo4j Node Properties[0m
 */
export interface Neo4jNodeProperties {
  [key: string]: unknown;
}

/**
 * [38;5;220mNeo4j Relationship Properties[0m
 */
export interface Neo4jRelationshipProperties {
  [key: string]: unknown;
}

/**
 * [38;5;220mNeo4j Node with Internal ID[0m
 */
export interface Neo4jNode {
  id: number;
  labels: string[];
  properties: Neo4jNodeProperties;
  elementId: string;
}

/**
 * [38;5;220mNeo4j Relationship with Internal ID[0m
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
 * [38;5;220mNeo4j Query Result[0m
 */
export interface Neo4jResult {
  records: Neo4jRecord[];
  summary: Neo4jResultSummary;
}

/**
 * [38;5;220mNeo4j Record[0m
 */
export interface Neo4jRecord {
  keys: string[];
  length: number;
  get: (key: string) => unknown;
  toObject: () => Record<string, unknown>;
}

/**
 * [38;5;220mNeo4j Result Summary[0m
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
 * [38;5;220mNeo4j Notification[0m
 */
export interface Neo4jNotification {
  code: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  position: { offset: number; line: number; column: number };
}

/**
 * [38;5;220mTransaction Configuration[0m
 */
export interface TransactionConfig {
  timeout?: number; // in milliseconds
  metadata?: Record<string, unknown>;
}

/**
 * [38;5;220mTransaction Result[0m
 */
export interface TransactionResult {
  success: boolean;
  results?: Neo4jResult[];
  error?: Error;
  transactionId: string;
}

// ============================================================================
// [38;5;220mNEO4J SERVICE[0m
// ============================================================================

/**
 * [38;5;220mNeo4j Database Service[0m
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
  // [38;5;220mCONNECTION MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mConnect to Neo4j database[0m
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
      console.log(`[38;5;220m[Neo4jService] Connected to ${this.config.uri}[0m`);
    } catch (error) {
      console.error(`[38;5;196m[Neo4jService] Connection failed:[0m`, error);
      throw error;
    }
  }

  /**
   * [38;5;220mDisconnect from Neo4j database[0m
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.close();
        this.driver = null;
        this.connected = false;
        console.log(`[38;5;220m[Neo4jService] Disconnected[0m`);
      } catch (error) {
        console.error(`[38;5;196m[Neo4jService] Disconnection failed:[0m`, error);
      }
    }
  }

  /**
   * [38;5;220mCheck if connected to Neo4j[0m
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * [38;5;220mVerify connection to Neo4j[0m
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
  // [38;5;220mSESSION MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a new session[0m
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
  // [38;5;220mQUERY EXECUTION[0m
  // ==========================================================================

  /**
   * [38;5;220mExecute a Cypher query[0m
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
   * [38;5;220mExecute a read query[0m
   */
  async readQuery(
    query: string,
    params?: Record<string, unknown>,
    database?: string
  ): Promise<Neo4jResult> {
    return this.executeQuery(query, params, { write: false, database });
  }

  /**
   * [38;5;220mExecute a write query[0m
   */
  async writeQuery(
    query: string,
    params?: Record<string, unknown>,
    database?: string
  ): Promise<Neo4jResult> {
    return this.executeQuery(query, params, { write: true, database });
  }

  // ==========================================================================
  // [38;5;220mTRANSACTION MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mExecute queries in a transaction[0m
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
   * [38;5;220mBegin a transaction[0m
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
   * [38;5;220mCommit a transaction[0m
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
   * [38;5;220mRollback a transaction[0m
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
  // [38;5;220mGRAPH OPERATIONS[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a graph (as a set of nodes with a label)[0m
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
   * [38;5;220mDelete a graph and all its nodes and relationships[0m
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
   * [38;5;220mAdd a node to a graph[0m
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
   * [38;5;220mAdd multiple nodes to a graph in a transaction[0m
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
   * [38;5;220mGet a node by ID[0m
   */
  async getNode(graphId: string, nodeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n {id: $nodeId})
      RETURN n
    `;
    
    return this.readQuery(query, { graphId, nodeId });
  }

  /**
   * [38;5;220mGet all nodes in a graph[0m
   */
  async getNodes(graphId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n)
      RETURN n
    `;
    
    return this.readQuery(query, { graphId });
  }

  /**
   * [38;5;220mUpdate a node in a graph[0m
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
   * [38;5;220mDelete a node from a graph[0m
   */
  async deleteNode(graphId: string, nodeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->(n {id: $nodeId})
      DETACH DELETE n
    `;
    
    return this.writeQuery(query, { graphId, nodeId });
  }

  /**
   * [38;5;220mAdd an edge to a graph[0m
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
   * [38;5;220mAdd multiple edges to a graph in a transaction[0m
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
   * [38;5;220mGet an edge by ID[0m
   */
  async getEdge(graphId: string, edgeId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[r {id: $edgeId}]->()
      RETURN r
    `;
    
    return this.readQuery(query, { graphId, edgeId });
  }

  /**
   * [38;5;220mGet all edges in a graph[0m
   */
  async getEdges(graphId: string): Promise<Neo4jResult> {
    const query = `
      MATCH (g:Graph {id: $graphId})-[:CONTAINS]->()-[]->()
      RETURN r
    `;
    
    return this.readQuery(query, { graphId });
  }

  /**
   * [38;5;220mUpdate an edge in a graph[0m
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
   * [38;5;220mDelete an edge from a graph[0m
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
  // [38;5;220mGRAPH QUERIES[0m
  // ==========================================================================

  /**
   * [38;5;220mGet the entire graph (nodes and edges)[0m
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
   * [38;5;220mQuery nodes by properties[0m
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
   * [38;5;220mQuery edges by properties[0m
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
  // [38;5;220mVERSIONING AND BACKUP[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a version of the graph[0m
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
   * [38;5;220mGet all versions of a graph[0m
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
   * [38;5;220mRestore a graph to a specific version[0m
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
  // [38;5;220mINDEX MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate indexes for better query performance[0m
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
  // [38;5;220mUTILITY METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mEnsure connected to Neo4j[0m
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * [38;5;220mGet Neo4j labels from graph node[0m
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
   * [38;5;220mGet Neo4j properties from graph node[0m
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
   * [38;5;220mGet Neo4j relationship properties from graph edge[0m
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
   * [38;5;220mConvert Neo4j node to graph node[0m
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
   * [38;5;220mConvert Neo4j relationship to graph edge[0m
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
   * [38;5;220mExtract custom properties with prefix[0m
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
   * [38;5;220mBuild SET clause for Cypher query[0m
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
   * [38;5;220mBuild WHERE clause for Cypher query[0m
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
// [38;5;220mSINGLETON INSTANCE[0m
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
// [38;5;220mEXPORTS[0m
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
