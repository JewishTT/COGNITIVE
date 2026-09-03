import { Router } from 'express';

export function createEventRoutes(eventBus, authService) {
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

  // GET /events (SSE)
  router.get('/', authenticate, (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Add client to event bus
    eventBus.addClient(res);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  return router;
}