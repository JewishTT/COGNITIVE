/**
 * COGNITIVE Backend - Main Entry Point
 * ====================================
 * Unified Service Layer
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './core/logger/index.js';
import { config } from './core/config/index.js';
import { CognitiveError } from './core/errors/index.js';

// Import route modules
import { router as graphRouter } from './core/services/graph/routes.js';
import { router as pipelineRouter } from './core/services/pipeline/routes.js';
import { router as tdaRouter } from './core/services/tda/routes.js';
import { router as globeRouter } from './core/services/globe/routes.js';
import { router as factoryRouter } from './core/services/factory/routes.js';
import { router as aiRouter } from './core/services/ai/routes.js';
import { router as authRouter } from './core/services/auth/routes.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// ========================================================================
// MIDDLEWARE
// ========================================================================

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  });
  next();
});

// ========================================================================
// ROUTES
// ========================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      graph: 'initialized',
      pipeline: 'initialized',
      tda: 'initialized',
      globe: 'initialized',
      factory: 'initialized',
      ai: 'initialized',
      auth: 'initialized',
    },
  });
});

// API Routes
app.use('/api/graph', graphRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/tda', tdaRouter);
app.use('/api/globe', globeRouter);
app.use('/api/factory', factoryRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);

// API Documentation (Swagger)
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
const swaggerDocument = YAML.load(path.resolve(__dirname, '../docs/api/swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ========================================================================
// SOCKET.IO - Real-time updates
// ========================================================================

io.on('connection', (socket) => {
  logger.info('New client connected', {
    socketId: socket.id,
    ip: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent'],
  });

  // Subscribe to events
  socket.on('subscribe', (event) => {
    logger.debug('Client subscribed to event', { socketId: socket.id, event });
    // Event subscription logic would go here
  });

  // Unsubscribe from events
  socket.on('unsubscribe', (event) => {
    logger.debug('Client unsubscribed from event', { socketId: socket.id, event });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('Socket error', { socketId: socket.id, error: error.message });
  });
});

// ========================================================================
// ERROR HANDLING
// ========================================================================

// 404 Not Found
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof CognitiveError) {
    logger.error('CognitiveError', {
      code: err.code,
      message: err.message,
      service: err.service,
      context: err.context,
      stack: err.stack,
    });

    return res.status(400).json({
      error: {
        code: err.code,
        message: err.message,
        service: err.service,
        context: err.context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Log unexpected errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Return generic error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    },
  });
});

// ========================================================================
// SERVER STARTUP
// ========================================================================

const PORT = config.get('PORT', 8000);

httpServer.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: config.get('NODE_ENV', 'development'),
    url: `http://localhost:${PORT}`,
    apiUrl: `http://localhost:${PORT}/api`,
    docsUrl: `http://localhost:${PORT}/api-docs`,
  });

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  🚀 COGNITIVE Backend Server Running                        ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  📍 Local:   http://localhost:${PORT}                        ║
  ║  🔌 API:      http://localhost:${PORT}/api                    ║
  ║  📖 Docs:     http://localhost:${PORT}/api-docs               ║
  ║  🌐 Frontend: http://localhost:3000                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

// ========================================================================
// GRACEFUL SHUTDOWN
// ========================================================================

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections, etc.
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', {
    promise,
    reason,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('UNCaughtException');
});

// Export for testing
export { app, httpServer, io };
