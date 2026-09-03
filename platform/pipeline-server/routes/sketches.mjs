import { Router } from 'express';

export function createSketchRoutes(sketchService, authService) {
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

  // POST /sketches
  router.post('/', authenticate, async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const sketch = await sketchService.create(req.userId, title, description);
      res.status(201).json(sketch);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /sketches
  router.get('/', authenticate, async (req, res) => {
    try {
      const sketches = await sketchService.list(req.userId);
      res.json({ sketches });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /sketches/:id
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const sketch = await sketchService.getById(req.userId, req.params.id);
      res.json(sketch);
    } catch (err) {
      if (err.message === 'Sketch not found') {
        return res.status(404).json({ error: 'Sketch not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /sketches/:id
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { title, description } = req.body;
      const sketch = await sketchService.update(req.userId, req.params.id, { title, description });
      res.json(sketch);
    } catch (err) {
      if (err.message === 'Sketch not found') {
        return res.status(404).json({ error: 'Sketch not found' });
      }
      if (err.message === 'No updates provided') {
        return res.status(400).json({ error: 'No updates provided' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /sketches/:id
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      await sketchService.delete(req.userId, req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}