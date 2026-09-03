import { Router } from 'express';

export function createAuthRoutes(authService) {
  const router = Router();

  // POST /auth/register
  router.post('/register', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const result = await authService.register(email, password);
      res.status(201).json(result);
    } catch (err) {
      if (err.message === 'User already exists') {
        return res.status(409).json({ error: 'User already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await authService.login(email, password);
      res.json(result);
    } catch (err) {
      if (err.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /auth/me
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);
      const user = await authService.getUser(decoded.id);
      res.json(user);
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (err.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}