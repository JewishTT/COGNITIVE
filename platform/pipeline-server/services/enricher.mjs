import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class EnricherService {
  constructor(driver) {
    this.driver = driver;
    this.runs = new Map();
  }

  async listEnrichers() {
    // Get available enrichers from the enrichers package
    const enrichers = [
      {
        name: 'thebigbrother',
        displayName: 'TheBigBrother',
        description: 'Social media OSINT enrichment (LinkedIn, GitHub, Twitter, Telegram, Instagram)',
        version: '1.0.0',
        inputTypes: ['person', 'email', 'phone'],
        outputTypes: ['social_profile', 'post']
      }
    ];

    return enrichers;
  }

  async runEnricher(enricherName, investigationId, nodeIds = [], config = {}) {
    const runId = uuidv4();
    const startTime = new Date().toISOString();

    // Initialize run status
    this.runs.set(runId, {
      runId,
      enricher: enricherName,
      investigationId,
      status: 'running',
      progress: { total: 0, completed: 0, failed: 0 },
      results: [],
      startTime,
      endTime: null
    });

    // Get nodes to enrich
    const session = this.driver.session();
    try {
      let nodes;
      if (nodeIds.length > 0) {
        const result = await session.run(
          `MATCH (n:GraphNode)
           WHERE n.id IN $nodeIds AND n.investigationId = $investigationId
           RETURN n`,
          { nodeIds, investigationId }
        );
        nodes = result.records.map(r => ({
          id: r.get('n').properties.id,
          type: r.get('n').properties.type,
          data: JSON.parse(r.get('n').properties.data || '{}')
        }));
      } else {
        const result = await session.run(
          `MATCH (n:GraphNode {investigationId: $investigationId})
           RETURN n`,
          { investigationId }
        );
        nodes = result.records.map(r => ({
          id: r.get('n').properties.id,
          type: r.get('n').properties.type,
          data: JSON.parse(r.get('n').properties.data || '{}')
        }));
      }

      // Update total
      const run = this.runs.get(runId);
      run.progress.total = nodes.length;

      // Run enricher in background
      this.executeEnricher(runId, enricherName, nodes, config).catch(err => {
        const run = this.runs.get(runId);
        run.status = 'failed';
        run.error = err.message;
        run.endTime = new Date().toISOString();
      });

      return { runId, status: 'started', enricher: enricherName };
    } finally {
      await session.close();
    }
  }

  async executeEnricher(runId, enricherName, nodes, config) {
    const run = this.runs.get(runId);

    // Process nodes in batches
    for (const node of nodes) {
      try {
        // Call Python enricher as subprocess
        const result = await this.callPythonEnricher(enricherName, node, config);

        // Store results in Neo4j
        await this.storeResults(run.investigationId, node.id, result);

        run.progress.completed++;
        run.results.push({
          nodeId: node.id,
          status: 'success',
          newNodes: result.newNodes?.length || 0,
          newRelations: result.newRelations?.length || 0
        });
      } catch (err) {
        run.progress.failed++;
        run.results.push({
          nodeId: node.id,
          status: 'failed',
          error: err.message
        });
      }
    }

    run.status = 'completed';
    run.endTime = new Date().toISOString();
  }

  async callPythonEnricher(enricherName, node, config) {
    return new Promise((resolve, reject) => {
      const input = JSON.stringify({ enricher: enricherName, node, config });
      
      // Spawn Python process
      const python = spawn('python', [
        '-m', 'flowsint_core.enricher',
        '--name', enricherName,
        '--input', '-'
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Enricher failed: ${stderr}`));
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch (e) {
            reject(new Error(`Invalid JSON output: ${stdout}`));
          }
        }
      });

      python.on('error', (err) => {
        reject(err);
      });

      // Send input
      python.stdin.write(input);
      python.stdin.end();
    });
  }

  async storeResults(investigationId, nodeId, result) {
    const session = this.driver.session();
    try {
      // Create new nodes from results
      if (result.newNodes) {
        for (const newNode of result.newNodes) {
          const id = uuidv4();
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
            {
              id,
              investigationId,
              type: newNode.type,
              data: JSON.stringify(newNode.data),
              confidence: newNode.confidence || 0.8,
              createdAt: new Date().toISOString()
            }
          );
        }
      }

      // Create new relations from results
      if (result.newRelations) {
        for (const newRelation of result.newRelations) {
          const id = uuidv4();
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
             }]->(target)`,
            {
              id,
              sourceId: nodeId,
              targetId: newRelation.targetId,
              investigationId,
              type: newRelation.type,
              data: JSON.stringify(newRelation.data || {}),
              weight: newRelation.weight || 0.8,
              createdAt: new Date().toISOString()
            }
          );
        }
      }
    } finally {
      await session.close();
    }
  }

  async getRunStatus(runId) {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error('Run not found');
    }
    return run;
  }
}