/**
 * COGNITIVE PLATFORM - GRAPH SERVICE
 * ====================================
 * 
 * [38;5;240mUnified Graph Service with Neo4j Integration[0m
 * 
 * Features:
 * - Neo4j connection management
 * - Graph CRUD operations
 * - Cypher query execution
 * - Transaction support
 * - Graph algorithms (centrality, community, path)
 * - Integration with other services
 */

import { config } from '../../config';
import {
  Graph,
  GraphNode,
  GraphRelationship,
  GraphQuery,
  GraphQueryResult,
  GraphStats,
  ID,
  ISODateString,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';
import { CacheService } from '../cache';
import { EventBus } from '../eventBus';

// ============================================================================
// NEO4J DRIVER WRAPPER
// ============================================================================

import neo4j, { Driver, Session, Transaction } from 'neo4j-driver';

/** Neo4j Driver Wrapper */
export class Neo4jDriver {
  private driver: Driver | null = null;
  private connectionString: string;
  private isConnected: boolean = false;
  
  constructor() {
    const dbConfig = config.get().database.neo4j;
    this.connectionString = config.getDatabaseConnection('neo4j');
    this.connect();
  }
  
  /** Connect to Neo4j */
  private async connect(): Promise<void> {
    try {
      const dbConfig = config.get().database.neo4j;
      
      this.driver = neo4j.driver(
        dbConfig.uri,
        neo4j.auth.basic(dbConfig.user, dbConfig.password),
        {
          maxConnectionPoolSize: dbConfig.maxConnectionPoolSize,
          connectionTimeout: dbConfig.connectionTimeout,
          disableLosslessIntegers: true,
        }
      );
      
      // Test connection
      await this.driver.verifyConnectivity();
      this.isConnected = true;
      logger.info('Neo4j connected successfully');
    } catch (error) {
      logger.error('Neo4j connection failed', { error: error instanceof Error ? error.message : error });
      throw new CognitiveError(
        'DATABASE_CONNECTION_FAILED',
        `Failed to connect to Neo4j: ${error instanceof Error ? error.message : String(error)}`,
        'graph'
      );
    }
  }
  
  /** Get a session */
  public getSession(database?: string): Session {
    if (!this.driver) {
      throw new CognitiveError('DATABASE_NOT_CONNECTED', 'Neo4j driver not initialized', 'graph');
    }
    
    const db = database || config.get().database.neo4j.database;
    return this.driver.session({ database: db });
  }
  
  /** Execute a read query */
  public async readQuery<T = Record<string, unknown>>(
    query: string,
    params: Record<string, unknown> = {},
    database?: string
  ): Promise<T[]> {
    const session = this.getSession(database);
    
    try {
      const result = await session.run(query, params);
      return result.records.map(record => record.toObject() as T);
    } catch (error) {
      logger.error('Neo4j read query failed', { query, params, error: error instanceof Error ? error.message : error });
      throw new CognitiveError(
        'GRAPH_QUERY_FAILED',
        `Query failed: ${error instanceof Error ? error.message : String(error)}`,
        'graph',
        { query, params }
      );
    } finally {
      await session.close();
    }
  }
  
  /** Execute a write query */
  public async writeQuery<T = Record<string, unknown>>(
    query: string,
    params: Record<string, unknown> = {},
    database?: string
  ): Promise<T[]> {
    const session = this.getSession(database);
    
    try {
      const result = await session.writeTransaction(tx => 
        tx.run(query, params).then(res => res.records.map(r => r.toObject() as T))
      );
      return result;
    } catch (error) {
      logger.error('Neo4j write query failed', { query, params, error: error instanceof Error ? error.message : error });
      throw new CognitiveError(
        'GRAPH_WRITE_FAILED',
        `Write failed: ${error instanceof Error ? error.message : String(error)}`,
        'graph',
        { query, params }
      );
    } finally {
      await session.close();
    }
  }
  
  /** Execute a transaction */
  public async withTransaction<T>(
    callback: (tx: Transaction) => Promise<T>,
    database?: string
  ): Promise<T> {
    const session = this.getSession(database);
    
    try {
      return await session.writeTransaction(callback);
    } catch (error) {
      logger.error('Neo4j transaction failed', { error: error instanceof Error ? error.message : error });
      throw new CognitiveError(
        'GRAPH_TRANSACTION_FAILED',
        `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        'graph'
      );
    } finally {
      await session.close();
    }
  }
  
  /** Check if connected */
  public isConnectedToDatabase(): boolean {
    return this.isConnected;
  }
  
  /** Close connection */
  public async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.isConnected = false;
      logger.info('Neo4j connection closed');
    }
  }
}

// ============================================================================
// GRAPH SERVICE
// ============================================================================

/** Graph Service */
export class GraphService {
  private neo4j: Neo4jDriver;
  private cache: CacheService;
  private eventBus: EventBus;
  
  constructor() {
    this.neo4j = new Neo4jDriver();
    this.cache = new CacheService();
    this.eventBus = EventBus.getInstance();
  }
  
  // ==========================================================================
  // GRAPH CRUD
  // ==========================================================================
  
  /** Create a new graph */
  public async createGraph(graph: Omit<Graph, 'id' | 'createdAt' | 'updatedAt'>): Promise<Graph> {
    const id = this.generateId('graph');
    const now = new Date().toISOString();
    
    const newGraph: Graph = {
      ...graph,
      id,
      nds: [],
      rls: [],
      createdAt: now,
      updatedAt: now,
    };
    
    // Create graph in Neo4j
    await this.neo4j.writeQuery(
      `CREATE (g:Graph {id: $id, name: $name, description: $description, createdAt: $createdAt, updatedAt: $updatedAt})
       RETURN g`,
      { id, name: graph.name, description: graph.description, createdAt: now, updatedAt: now }
    );
    
    // Emit event
    await this.eventBus.emit('graph:created', { graph: newGraph });
    
    return newGraph;
  }
  
  /** Get a graph by ID */
  public async getGraph(id: ID): Promise<Graph | null> {
    // Try cache first
    const cacheKey = `graph:${id}`;
    const cached = await this.cache.get<Graph>(cacheKey);
    if (cached) return cached;
    
    // Query Neo4j
    const result = await this.neo4j.readQuery<{
      g: Graph;
      nodes: GraphNode[];
      relationships: GraphRelationship[];
    }>(
      `MATCH (g:Graph {id: $id})
       OPTIONAL MATCH (g)-[:CONTAINS_NODE]->(n:Node)
       OPTIONAL MATCH (g)-[:CONTAINS_EDGE]->(e:Edge)
       RETURN g, collect(n) as nodes, collect(e) as relationships`,
      { id }
    );
    
    if (result.length === 0) return null;
    
    const { g, nodes, relationships } = result[0];
    const graph: Graph = {
      ...g,
      nds: nodes || [],
      rls: relationships || [],
    };
    
    // Cache the result
    await this.cache.set(cacheKey, graph, { ttl: config.get().cache.ttl });
    
    return graph;
  }
  
  /** Get all graphs */
  public async getGraphs(): Promise<Graph[]> {
    const cacheKey = 'graphs:all';
    const cached = await this.cache.get<Graph[]>(cacheKey);
    if (cached) return cached;
    
    const result = await this.neo4j.readQuery<{
      g: Graph;
      nodeCount: number;
      edgeCount: number;
    }>(
      `MATCH (g:Graph)
       OPTIONAL MATCH (g)-[:CONTAINS_NODE]->(n:Node)
       OPTIONAL MATCH (g)-[:CONTAINS_EDGE]->(e:Edge)
       RETURN g, count(n) as nodeCount, count(e) as edgeCount`
    );
    
    const graphs = result.map(({ g, nodeCount, edgeCount }) => ({
      ...g,
      metadata: {
        ...g.metadata,
        nodeCount,
        edgeCount,
      },
      nds: [],
      rls: [],
    }));
    
    await this.cache.set(cacheKey, graphs, { ttl: config.get().cache.ttl / 2 });
    
    return graphs;
  }
  
  /** Update a graph */
  public async updateGraph(id: ID, updates: Partial<Graph>): Promise<Graph | null> {
    const existing = await this.getGraph(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    
    // Update in Neo4j
    await this.neo4j.writeQuery(
      `MATCH (g:Graph {id: $id})
       SET g += $updates, g.updatedAt = $updatedAt
       RETURN g`,
      { id, updates, updatedAt: updated.updatedAt }
    );
    
    // Invalidate cache
    await this.cache.delete(`graph:${id}`);
    await this.cache.delete('graphs:all');
    
    // Emit event
    await this.eventBus.emit('graph:updated', { graph: updated });
    
    return updated;
  }
  
  /** Delete a graph */
  public async deleteGraph(id: ID): Promise<boolean> {
    const result = await this.neo4j.writeQuery(
      `MATCH (g:Graph {id: $id})
       DETACH DELETE g
       RETURN count(g) as deleted`,
      { id }
    );
    
    const deleted = result[0]?.deleted > 0;
    
    if (deleted) {
      // Invalidate cache
      await this.cache.delete(`graph:${id}`);
      await this.cache.delete('graphs:all');
      
      // Emit event
      await this.eventBus.emit('graph:deleted', { graphId: id });
    }
    
    return deleted;
  }
  
  // ==========================================================================
  // NODE OPERATIONS
  // ==========================================================================
  
  /** Create a node */
  public async createNode(graphId: ID, node: Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<GraphNode> {
    const id = this.generateId('node');
    const now = new Date().toISOString();
    
    const newNode: GraphNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    // Create node in Neo4j
    await this.neo4j.writeQuery(
      `MATCH (g:Graph {id: $graphId})
       CREATE (n:Node {id: $id, labels: $labels, properties: $properties, createdAt: $createdAt, updatedAt: $updatedAt})
       CREATE (g)-[:CONTAINS_NODE]->(n)
       RETURN n`,
      { graphId, ...newNode }
    );
    
    // Invalidate graph cache
    await this.cache.delete(`graph:${graphId}`);
    
    // Emit event
    await this.eventBus.emit('node:created', { graphId, node: newNode });
    
    return newNode;
  }
  
  /** Get a node by ID */
  public async getNode(id: ID): Promise<GraphNode | null> {
    const cacheKey = `node:${id}`;
    const cached = await this.cache.get<GraphNode>(cacheKey);
    if (cached) return cached;
    
    const result = await this.neo4j.readQuery<GraphNode>(
      `MATCH (n:Node {id: $id}) RETURN n`,
      { id }
    );
    
    if (result.length === 0) return null;
    
    const node = result[0];
    await this.cache.set(cacheKey, node, { ttl: config.get().cache.ttl });
    
    return node;
  }
  
  /** Update a node */
  public async updateNode(id: ID, updates: Partial<GraphNode>): Promise<GraphNode | null> {
    const existing = await this.getNode(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    
    await this.neo4j.writeQuery(
      `MATCH (n:Node {id: $id})
       SET n += $updates, n.updatedAt = $updatedAt
       RETURN n`,
      { id, updates, updatedAt: updated.updatedAt }
    );
    
    // Invalidate cache
    await this.cache.delete(`node:${id}`);
    
    // Find all graphs containing this node and invalidate their cache
    const graphs = await this.neo4j.readQuery<{ graphId: string }>(
      `MATCH (g:Graph)-[:CONTAINS_NODE]->(n:Node {id: $id})
       RETURN g.id as graphId`,
      { id }
    );
    
    for (const { graphId } of graphs) {
      await this.cache.delete(`graph:${graphId}`);
    }
    
    // Emit event
    await this.eventBus.emit('node:updated', { node: updated });
    
    return updated;
  }
  
  /** Delete a node */
  public async deleteNode(id: ID): Promise<boolean> {
    // Find graph containing this node
    const graphs = await this.neo4j.readQuery<{ graphId: string }>(
      `MATCH (g:Graph)-[:CONTAINS_NODE]->(n:Node {id: $id})
       RETURN g.id as graphId`,
      { id }
    );
    
    if (graphs.length === 0) return false;
    
    // Delete node and its relationships
    await this.neo4j.writeQuery(
      `MATCH (n:Node {id: $id})
       DETACH DELETE n
       RETURN count(n) as deleted`,
      { id }
    );
    
    // Invalidate cache
    await this.cache.delete(`node:${id}`);
    for (const { graphId } of graphs) {
      await this.cache.delete(`graph:${graphId}`);
    }
    
    // Emit event
    await this.eventBus.emit('node:deleted', { nodeId: id, graphIds: graphs.map(g => g.graphId) });
    
    return true;
  }
  
  // ==========================================================================
  // RELATIONSHIP OPERATIONS
  // ==========================================================================
  
  /** Create a relationship */
  public async createRelationship(
    graphId: ID,
    relationship: Omit<GraphRelationship, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<GraphRelationship> {
    const id = this.generateId('edge');
    const now = new Date().toISOString();
    
    const newRelationship: GraphRelationship = {
      ...relationship,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    await this.neo4j.writeQuery(
      `MATCH (g:Graph {id: $graphId})
       MATCH (start:Node {id: $startNodeId})
       MATCH (end:Node {id: $endNodeId})
       CREATE (g)-[:CONTAINS_EDGE]->(e:Edge {id: $id, type: $type, properties: $properties, startNodeId: $startNodeId, endNodeId: $endNodeId, createdAt: $createdAt, updatedAt: $updatedAt})
       CREATE (start)-[r:RELATIONSHIP {type: $type, properties: $properties}]->(end)
       RETURN e`,
      { ...newRelationship, graphId }
    );
    
    // Invalidate cache
    await this.cache.delete(`graph:${graphId}`);
    
    // Emit event
    await this.eventBus.emit('edge:created', { graphId, edge: newRelationship });
    
    return newRelationship;
  }
  
  /** Get a relationship by ID */
  public async getRelationship(id: ID): Promise<GraphRelationship | null> {
    const cacheKey = `edge:${id}`;
    const cached = await this.cache.get<GraphRelationship>(cacheKey);
    if (cached) return cached;
    
    const result = await this.neo4j.readQuery<GraphRelationship>(
      `MATCH (e:Edge {id: $id}) RETURN e`,
      { id }
    );
    
    if (result.length === 0) return null;
    
    const relationship = result[0];
    await this.cache.set(cacheKey, relationship, { ttl: config.get().cache.ttl });
    
    return relationship;
  }
  
  /** Delete a relationship */
  public async deleteRelationship(id: ID): Promise<boolean> {
    // Find graph containing this relationship
    const graphs = await this.neo4j.readQuery<{ graphId: string }>(
      `MATCH (g:Graph)-[:CONTAINS_EDGE]->(e:Edge {id: $id})
       RETURN g.id as graphId`,
      { id }
    );
    
    if (graphs.length === 0) return false;
    
    // Delete relationship
    await this.neo4j.writeQuery(
      `MATCH (e:Edge {id: $id})
       MATCH (start)-[r]->(end)
       WHERE r.id = e.id
       DELETE r, e
       RETURN count(e) as deleted`,
      { id }
    );
    
    // Invalidate cache
    await this.cache.delete(`edge:${id}`);
    for (const { graphId } of graphs) {
      await this.cache.delete(`graph:${graphId}`);
    }
    
    // Emit event
    await this.eventBus.emit('edge:deleted', { edgeId: id, graphIds: graphs.map(g => g.graphId) });
    
    return true;
  }
  
  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================
  
  /** Execute a Cypher query */
  public async query(query: GraphQuery): Promise<GraphQueryResult> {
    const result = await this.neo4j.readQuery(
      query.cypher || '',
      query.params || {},
      query.database
    );
    
    return {
      records: result,
      summary: {
        query: query.cypher || '',
        db: query.database || config.get().database.neo4j.database || 'neo4j',
        plan: null,
        profile: null,
        notifications: [],
        server: {
          address: config.get().database.neo4j.uri,
          version: '5.x',
        },
        queryType: query.cypher?.toUpperCase().startsWith('CREATE') || 
                   query.cypher?.toUpperCase().startsWith('MERGE') ? 'rw' : 'r',
      },
    };
  }
  
  /** Get graph statistics */
  public async getStats(graphId: ID): Promise<GraphStats> {
    const result = await this.neo4j.readQuery<{
      nodeCount: number;
      relationshipCount: number;
      labelDistribution: Record<string, number>;
      relationshipTypeDistribution: Record<string, number>;
    }>(
      `MATCH (g:Graph {id: $graphId})-[:CONTAINS_NODE]->(n:Node)
       MATCH (g)-[:CONTAINS_EDGE]->(e:Edge)
       WITH g, collect(n) as nodes, collect(e) as edges
       UNWIND nodes as n
       WITH g, nodes, edges, 
            count(n) as nodeCount,
            count(edges) as relationshipCount,
            n.labels as labels
       UNWIND labels as label
       WITH g, nodeCount, relationshipCount, 
            collect({label: label, count: count(*)}) as labelDist
       UNWIND edges as e
       WITH g, nodeCount, relationshipCount, labelDist,
            e.type as type
       RETURN nodeCount, relationshipCount,
              reduce(total=0, x IN labelDist | total + x.count) as nodeCountCheck,
              [x IN labelDist | {key: x.label, value: x.count}] as labelDistribution,
              count(type) as relTypeCount,
              [type IN collect(type) | {key: type, value: count(*)}] as relationshipTypeDistribution`,
      { graphId }
    );
    
    if (result.length === 0) {
      throw new CognitiveError('GRAPH_NOT_FOUND', `Graph ${graphId} not found`, 'graph');
    }
    
    const { nodeCount, relationshipCount, labelDistribution, relationshipTypeDistribution } = result[0];
    
    // Calculate density
    const maxEdges = nodeCount * (nodeCount - 1) / 2;
    const density = relationshipCount / maxEdges;
    
    return {
      nodeCount,
      relationshipCount,
      labelDistribution: Object.fromEntries(labelDistribution?.map((d: any) => [d.key, d.value]) || []),
      relationshipTypeDistribution: Object.fromEntries(relationshipTypeDistribution?.map((d: any) => [d.key, d.value]) || []),
      density,
      connectedComponents: 0, // Will be calculated separately
    };
  }
  
  // ==========================================================================
  // GRAPH ALGORITHMS
  // ==========================================================================
  
  /** Calculate centrality metrics */
  public async calculateCentrality(
    graphId: ID,
    metrics: ('degree' | 'betweenness' | 'closeness' | 'eigenvector' | 'pageRank')[]
  ): Promise<Record<string, Record<ID, number>>> {
    const results: Record<string, Record<ID, number>> = {};
    
    for (const metric of metrics) {
      switch (metric) {
        case 'degree':
          results.degree = await this.calculateDegreeCentrality(graphId);
          break;
        case 'betweenness':
          results.betweenness = await this.calculateBetweennessCentrality(graphId);
          break;
        case 'closeness':
          results.closeness = await this.calculateClosenessCentrality(graphId);
          break;
        case 'eigenvector':
          results.eigenvector = await this.calculateEigenvectorCentrality(graphId);
          break;
        case 'pageRank':
          results.pageRank = await this.calculatePageRank(graphId);
          break;
      }
    }
    
    return results;
  }
  
  /** Calculate degree centrality */
  private async calculateDegreeCentrality(graphId: ID): Promise<Record<ID, number>> {
    const result = await this.neo4j.readQuery<{ nodeId: string; degree: number }>(
      `MATCH (g:Graph {id: $graphId})-[:CONTAINS_NODE]->(n:Node)
       MATCH (n)-[r:RELATIONSHIP]-()
       RETURN n.id as nodeId, count(r) as degree`,
      { graphId }
    );
    
    return Object.fromEntries(result.map(r => [r.nodeId, r.degree]));
  }
  
  /** Calculate betweenness centrality (simplified) */
  private async calculateBetweennessCentrality(graphId: ID): Promise<Record<ID, number>> {
    // This is a simplified approximation
    // For production, use a proper algorithm library
    const result = await this.neo4j.readQuery<{ nodeId: string; score: number }>(
      `MATCH (g:Graph {id: $graphId})-[:CONTAINS_NODE]->(n:Node)
       CALL apoc.algo.betweenness(['Node'], ['RELATIONSHIP'], 'OUTGOING') YIELD node, score
       RETURN node.id as nodeId, score`,
      { graphId }
    );
    
    return Object.fromEntries(result.map(r => [r.nodeId, r.score]));
  }
  
  /** Detect communities */
  public async detectCommunities(
    graphId: ID,
    algorithm: 'louvain' | 'leiden' | 'label-propagation' = 'louvain'
  ): Promise<{ communities: Record<ID, ID[]>; modularity: number }> {
    // Use APOC for community detection
    const result = await this.neo4j.readQuery<{
      nodeId: string;
      community: string;
      modularity: number;
    }>(
      `CALL apoc.algo.${algorithm}(['Node'], ['RELATIONSHIP'], 'OUTGOING') 
       YIELD nodes, p95, p99, p999, communities, modularity
       UNWIND nodes as node
       RETURN node.id as nodeId, communities as community, modularity`,
      { graphId }
    );
    
    if (result.length === 0) {
      return { communities: {}, modularity: 0 };
    }
    
    // Group nodes by community
    const communities: Record<ID, ID[]> = {};
    let modularity = 0;
    
    for (const { nodeId, community, modularity: mod } of result) {
      if (!communities[community]) {
        communities[community] = [];
      }
      communities[community].push(nodeId);
      modularity = mod;
    }
    
    return { communities, modularity };
  }
  
  /** Find shortest path */
  public async findShortestPath(
    graphId: ID,
    startNodeId: ID,
    endNodeId: ID,
    maxDepth: number = 10
  ): Promise<ID[]> {
    const result = await this.neo4j.readQuery<{ path: string }>(
      `MATCH (g:Graph {id: $graphId})-[:CONTAINS_NODE]->(start:Node {id: $startNodeId})
       MATCH (g)-[:CONTAINS_NODE]->(end:Node {id: $endNodeId})
       MATCH path = shortestPath((start)-[:RELATIONSHIP*]-(end))
       RETURN [n IN nodes(path) | n.id] as path`,
      { graphId, startNodeId, endNodeId }
    );
    
    return result[0]?.path ? JSON.parse(result[0].path) : [];
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Check if graph exists */
  public async exists(graphId: ID): Promise<boolean> {
    const result = await this.neo4j.readQuery<{ count: number }>(
      `MATCH (g:Graph {id: $graphId}) RETURN count(g) as count`,
      { graphId }
    );
    
    return result[0]?.count > 0;
  }
  
  /** Clear cache for a graph */
  public async clearCache(graphId: ID): Promise<void> {
    await this.cache.delete(`graph:${graphId}`);
    await this.cache.delete('graphs:all');
  }
  
  /** Get service status */
  public async getStatus(): Promise<{
    connected: boolean;
    version: string;
    nodeCount: number;
    relationshipCount: number;
  }> {
    const nodeCount = await this.neo4j.readQuery<{ count: number }>(
      `MATCH (n:Node) RETURN count(n) as count`
    );
    
    const relationshipCount = await this.neo4j.readQuery<{ count: number }>(
      `MATCH ()-[r:RELATIONSHIP]->() RETURN count(r) as count`
    );
    
    return {
      connected: this.neo4j.isConnectedToDatabase(),
      version: '5.x',
      nodeCount: nodeCount[0]?.count || 0,
      relationshipCount: relationshipCount[0]?.count || 0,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let graphServiceInstance: GraphService | null = null;

/** Get singleton instance */
export function getGraphService(): GraphService {
  if (!graphServiceInstance) {
    graphServiceInstance = new GraphService();
  }
  return graphServiceInstance;
}

// Export singleton
export const graphService = getGraphService();
