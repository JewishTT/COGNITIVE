import { v4 as uuidv4 } from 'uuid';

export class InvestigationService {
  constructor(driver) {
    this.driver = driver;
  }

  async list(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(sk:Sketch)-[:CONTAINS]->(i:Investigation)
         OPTIONAL MATCH (i)-[:CONTAINS]->(n:GraphNode)
         RETURN i, collect(DISTINCT n) as nodes`,
        { userId }
      );

      return result.records.map(record => {
        const investigation = record.get('i').properties;
        const nodes = record.get('nodes').map(n => ({
          id: n.properties.id,
          type: n.properties.type,
          data: JSON.parse(n.properties.data || '{}'),
          confidence: n.properties.confidence
        }));

        return {
          id: investigation.id,
          name: investigation.name,
          sketchId: investigation.sketchId,
          createdAt: investigation.createdAt,
          nodes
        };
      });
    } finally {
      await session.close();
    }
  }

  async create(sketchId, name) {
    const session = this.driver.session();
    try {
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await session.run(
        `CREATE (i:Investigation {
          id: $id,
          name: $name,
          sketchId: $sketchId,
          createdAt: $createdAt
        })`,
        { id, name, sketchId, createdAt }
      );

      // Create relationship to sketch
      await session.run(
        `MATCH (s:Sketch {id: $sketchId}), (i:Investigation {id: $id})
         CREATE (s)-[:CONTAINS]->(i)`,
        { sketchId, id }
      );

      return { id, name, sketchId, createdAt };
    } finally {
      await session.close();
    }
  }

  async getById(investigationId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (i:Investigation {id: $id})
         OPTIONAL MATCH (i)-[:CONTAINS]->(n:GraphNode)
         OPTIONAL MATCH (n)-[r:CONNECTED_TO]->(m:GraphNode)
         RETURN i, collect(DISTINCT n) as nodes, collect(DISTINCT r) as relations`,
        { id: investigationId }
      );

      if (result.records.length === 0) {
        throw new Error('Investigation not found');
      }

      const investigation = result.records[0].get('i').properties;
      const nodes = result.records[0].get('nodes').map(n => ({
        id: n.properties.id,
        type: n.properties.type,
        data: JSON.parse(n.properties.data || '{}'),
        confidence: n.properties.confidence
      }));

      const relations = result.records[0].get('relations').map(r => ({
        id: r.properties.id,
        sourceId: r.properties.sourceId,
        targetId: r.properties.targetId,
        type: r.properties.type,
        weight: r.properties.weight,
        data: JSON.parse(r.properties.data || '{}')
      }));

      return {
        id: investigation.id,
        name: investigation.name,
        sketchId: investigation.sketchId,
        createdAt: investigation.createdAt,
        graph: { nodes, relations }
      };
    } finally {
      await session.close();
    }
  }

  async addNode(investigationId, type, data, confidence = 1.0) {
    const session = this.driver.session();
    try {
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await session.run(
        `MATCH (i:Investigation {id: $investigationId})
         CREATE (n:GraphNode {
           id: $id,
           investigationId: $investigationId,
           type: $type,
           data: $data,
           confidence: $confidence,
           createdAt: $createdAt
         })
         CREATE (i)-[:CONTAINS]->(n)`,
        { id, investigationId, type, data: JSON.stringify(data), confidence, createdAt }
      );

      return { id, type, data, confidence, createdAt };
    } finally {
      await session.close();
    }
  }

  async addRelation(investigationId, sourceId, targetId, type, data = {}, weight = 1.0) {
    const session = this.driver.session();
    try {
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await session.run(
        `MATCH (source:GraphNode {id: $sourceId, investigationId: $investigationId})
         MATCH (target:GraphNode {id: $targetId, investigationId: $investigationId})
         CREATE (source)-[r:CONNECTED_TO {
           id: $id,
           sourceId: $sourceId,
           targetId: $targetId,
           type: $type,
           data: $data,
           weight: $weight,
           createdAt: $createdAt
         }]->(target)
         RETURN r`,
        { id, sourceId, targetId, type, data: JSON.stringify(data), weight, createdAt, investigationId }
      );

      return { id, sourceId, targetId, type, data, weight, createdAt };
    } finally {
      await session.close();
    }
  }

  async getGraph(investigationId, depth = 1) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (i:Investigation {id: $id})
         OPTIONAL MATCH (i)-[:CONTAINS]->(n:GraphNode)
         OPTIONAL MATCH (n)-[r:CONNECTED_TO*1..${depth}]-(m:GraphNode)
         RETURN collect(DISTINCT n) as nodes, collect(DISTINCT r) as allRelations`,
        { id: investigationId }
      );

      if (result.records.length === 0) {
        throw new Error('Investigation not found');
      }

      const nodes = result.records[0].get('nodes').map(n => ({
        id: n.properties.id,
        type: n.properties.type,
        data: JSON.parse(n.properties.data || '{}'),
        confidence: n.properties.confidence
      }));

      const allRelations = result.records[0].get('allRelations');
      const relationsMap = new Map();
      
      allRelations.forEach(r => {
        if (r && !relationsMap.has(r.properties.id)) {
          relationsMap.set(r.properties.id, {
            id: r.properties.id,
            sourceId: r.properties.sourceId,
            targetId: r.properties.targetId,
            type: r.properties.type,
            weight: r.properties.weight,
            data: JSON.parse(r.properties.data || '{}')
          });
        }
      });

      const relations = Array.from(relationsMap.values());
      const nodeCount = nodes.length;
      const relationCount = relations.length;
      const density = nodeCount > 1 ? (2 * relationCount) / (nodeCount * (nodeCount - 1)) : 0;

      return {
        nodes,
        relations,
        stats: {
          nodeCount,
          relationCount,
          density
        }
      };
    } finally {
      await session.close();
    }
  }
}