import { Router } from 'express';

export function createEnricherRoutes(enricherService, authService, eventBus) {
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

  // GET /enrichers
  router.get('/', authenticate, async (req, res) => {
    try {
      const enrichers = await enricherService.listEnrichers();
      res.json({ enrichers });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /enrichers/:name/run
  router.post('/:name/run', authenticate, async (req, res) => {
    try {
      const { investigation_id, node_ids, config } = req.body;

      if (!investigation_id) {
        return res.status(400).json({ error: 'investigation_id is required' });
      }

      const result = await enricherService.runEnricher(
        req.params.name,
        investigation_id,
        node_ids || [],
        config || {}
      );

      // Emit event
      eventBus.emit('enricher.started', {
        runId: result.runId,
        enricher: result.enricher,
        investigationId: investigation_id
      });

      res.status(202).json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /enrichers/:name/runs/:run_id
  router.get('/:name/runs/:run_id', authenticate, async (req, res) => {
    try {
      const run = await enricherService.getRunStatus(req.params.run_id);
      res.json(run);
    } catch (err) {
      if (err.message === 'Run not found') {
        return res.status(404).json({ error: 'Run not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}