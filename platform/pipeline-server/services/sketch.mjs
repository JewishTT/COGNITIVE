import { v4 as uuidv4 } from 'uuid';

export class SketchService {
  constructor(driver) {
    this.driver = driver;
  }

  async create(userId, title, description = '', investigationId = null) {
    const session = this.driver.session();
    try {
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await session.run(
        `CREATE (s:Sketch {
          id: $id,
          title: $title,
          description: $description,
          userId: $userId,
          createdAt: $createdAt
        })`,
        { id, title, description, userId, createdAt }
      );

      // Create relationship to user
      await session.run(
        `MATCH (u:User {id: $userId}), (s:Sketch {id: $id})
         CREATE (u)-[:OWNS]->(s)`,
        { userId, id }
      );

      // If investigationId provided, link sketch to investigation
      if (investigationId) {
        await session.run(
          `MATCH (i:Investigation {id: $investigationId}), (s:Sketch {id: $id})
           CREATE (s)-[:CONTAINS]->(i)`,
          { investigationId, id }
        );
      }

      return { id, title, description, createdAt };
    } finally {
      await session.close();
    }
  }

  async list(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Sketch)
         OPTIONAL MATCH (s)-[:CONTAINS]->(i:Investigation)
         RETURN s, count(i) as investigationCount
         ORDER BY s.createdAt DESC`,
        { userId }
      );

      return result.records.map(record => {
        const sketch = record.get('s').properties;
        return {
          id: sketch.id,
          title: sketch.title,
          description: sketch.description,
          createdAt: sketch.createdAt,
          investigationCount: record.get('investigationCount').toNumber()
        };
      });
    } finally {
      await session.close();
    }
  }

  async getById(userId, sketchId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Sketch {id: $sketchId})
         OPTIONAL MATCH (s)-[:CONTAINS]->(i:Investigation)
         OPTIONAL MATCH (i)-[:CONTAINS]->(n:GraphNode)
         RETURN s, i, count(n) as nodeCount`,
        { userId, sketchId }
      );

      if (result.records.length === 0) {
        throw new Error('Sketch not found');
      }

      const sketch = result.records[0].get('s').properties;
      const investigations = result.records
        .filter(r => r.get('i'))
        .map(r => ({
          id: r.get('i').properties.id,
          name: r.get('i').properties.name,
          nodeCount: r.get('nodeCount').toNumber()
        }));

      return {
        id: sketch.id,
        title: sketch.title,
        description: sketch.description,
        createdAt: sketch.createdAt,
        investigations
      };
    } finally {
      await session.close();
    }
  }

  async update(userId, sketchId, updates) {
    const session = this.driver.session();
    try {
      const { title, description } = updates;
      const setClauses = [];
      const params = { userId, sketchId };

      if (title !== undefined) {
        setClauses.push('s.title = $title');
        params.title = title;
      }
      if (description !== undefined) {
        setClauses.push('s.description = $description');
        params.description = description;
      }

      if (setClauses.length === 0) {
        throw new Error('No updates provided');
      }

      setClauses.push('s.updatedAt = $updatedAt');
      params.updatedAt = new Date().toISOString();

      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Sketch {id: $sketchId})
         SET ${setClauses.join(', ')}
         RETURN s`,
        params
      );

      if (result.records.length === 0) {
        throw new Error('Sketch not found');
      }

      const sketch = result.records[0].get('s').properties;
      return {
        id: sketch.id,
        title: sketch.title,
        description: sketch.description,
        updatedAt: sketch.updatedAt
      };
    } finally {
      await session.close();
    }
  }

  async delete(userId, sketchId) {
    const session = this.driver.session();
    try {
      // Delete all investigations and their nodes/relations
      await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Sketch {id: $sketchId})
         OPTIONAL MATCH (s)-[:CONTAINS]->(i:Investigation)
         OPTIONAL MATCH (i)-[:CONTAINS]->(n:GraphNode)
         OPTIONAL MATCH (n)-[r:CONNECTED_TO]->()
         DETACH DELETE n, r, i, s`,
        { userId, sketchId }
      );

      return true;
    } finally {
      await session.close();
    }
  }
}