import { Router } from 'express';

export function createInvestigationRoutes(investigationService, authService) {
  const router = Router();

  // Middleware to authenticate requests
  const authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);
      req.userId = decoded.id;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // POST /investigations
  router.post('/', authenticate, async (req, res) => {
    try {
      const { sketch_id, name } = req.body;

      if (!sketch_id || !name) {
        return res.status(400).json({ error: 'sketch_id and name are required' });
      }

      const investigation = await investigationService.create(sketch_id, name);
      res.status(201).json(investigation);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /investigations/:id
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const investigation = await investigationService.getById(req.params.id);
      res.json(investigation);
    } catch (err) {
      if (err.message === 'Investigation not found') {
        return res.status(404).json({ error: 'Investigation not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /investigations/:id/nodes
  router.post('/:id/nodes', authenticate, async (req, res) => {
    try {
      const { type, data, confidence } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'type is required' });
      }

      const node = await investigationService.addNode(
        req.params.id,
        type,
        data || {},
        confidence
      );
      res.status(201).json(node);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /investigations/:id/relations
  router.post('/:id/relations', authenticate, async (req, res) => {
    try {
      const { source_id, target_id, type, data, weight } = req.body;

      if (!source_id || !target_id || !type) {
        return res.status(400).json({ error: 'source_id, target_id, and type are required' });
      }

      const relation = await investigationService.addRelation(
        req.params.id,
        source_id,
        target_id,
        type,
        data,
        weight
      );
      res.status(201).json(relation);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /investigations/:id/graph
  router.get('/:id/graph', authenticate, async (req, res) => {
    try {
      const depth = parseInt(req.query.depth) || 1;
      const graph = await investigationService.getGraph(req.params.id, depth);
      res.json(graph);
    } catch (err) {
      if (err.message === 'Investigation not found') {
        return res.status(404).json({ error: 'Investigation not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}