const INDEXES = `
  // Users
  CREATE INDEX user_email IF NOT EXISTS FOR (u:User) ON (u.email);
  CREATE INDEX user_id IF NOT EXISTS FOR (u:User) ON (u.id);

  // Sketches
  CREATE INDEX sketch_id IF NOT EXISTS FOR (s:Sketch) ON (s.id);
  CREATE INDEX sketch_user IF NOT EXISTS FOR (s:Sketch) ON (s.userId);

  // Investigations
  CREATE INDEX investigation_id IF NOT EXISTS FOR (i:Investigation) ON (i.id);
  CREATE INDEX investigation_sketch IF NOT EXISTS FOR (i:Investigation) ON (i.sketchId);

  // Nodes
  CREATE INDEX node_id IF NOT EXISTS FOR (n:GraphNode) ON (n.id);
  CREATE INDEX node_investigation IF NOT EXISTS FOR (n:GraphNode) ON (n.investigationId);
  CREATE INDEX node_type IF NOT EXISTS FOR (n:GraphNode) ON (n.type);

  // Relations
  CREATE INDEX relation_id IF NOT EXISTS FOR ()-[r:CONNECTED_TO]-() ON (r.id);
`;

export class Neo4jMigration {
  constructor(driver) {
    this.driver = driver;
  }

  async ensureIndexes() {
    const session = this.driver.session();
    try {
      // Split by semicolons and execute each statement
      const statements = INDEXES.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await session.run(statement);
        } catch (err) {
          // Index might already exist, log but continue
          console.log(`Index creation note: ${err.message}`);
        }
      }

      console.log('Neo4j indexes ensured');
    } finally {
      await session.close();
    }
  }

  async verifyConnection() {
    const session = this.driver.session();
    try {
      await session.run('RETURN 1');
      return true;
    } catch (err) {
      console.error('Neo4j connection failed:', err.message);
      return false;
    } finally {
      await session.close();
    }
  }
}