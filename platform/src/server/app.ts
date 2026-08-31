/**
 * COGNITIVE PLATFORM - EXPRESS API SERVER
 * 
 * Central unified API routing all requests through ServiceRegistry.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import {
  UnifiedRequest,
  UnifiedResponse,
  ServiceContext,
  createId,
  createTimestamp,
} from '@cognitive/core';
import { getRegistry, ServiceRegistry } from '@cognitive/core';
import { getConfigManager, ConfigManager } from '@cognitive/core';
import { Logger } from '@cognitive/core';

interface RequestContext extends Express.Request {
  traceId: string;
  userId?: string;
  startTime: number;
}

/**
 * API Server
 */
export class APIServer {
  private app: Express;
  private httpServer: any;
  private wsServer: WebSocketServer;
  private registry: ServiceRegistry;
  private config: ConfigManager;
  private logger: Logger;

  constructor() {
    this.app = express();
    this.registry = getRegistry();
    this.config = getConfigManager();
    this.logger = new Logger('APIServer');
    this.wsServer = new WebSocketServer({ noServer: true });
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // Request tracing
    this.app.use((req: any, res, next) => {
      req.traceId = req.headers['x-trace-id'] || `trace-${uuidv4()}`;
      req.userId = req.headers['x-user-id'];
      req.startTime = Date.now();
      res.setHeader('x-trace-id', req.traceId);
      next();
    });

    // Logging
    this.app.use((req: any, res, next) => {
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        this.logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
          traceId: req.traceId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        });
      });
      next();
    });

    // Error handler
    this.app.use((err: any, req: any, res: any, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        traceId: req.traceId,
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message,
        },
        meta: {
          duration: Date.now() - req.startTime,
          cached: false,
        },
      });
    });
  }

  /**
   * Setup REST routes
   */
  private setupRoutes(): void {
    const api = express.Router();

    // Health check
    api.get('/health', (req: any, res) => {
      const health = this.registry.getAllHealth();
      res.json({ ok: true, services: health });
    });

    // OSINT routes
    api.post('/osint/profile', this.handleServiceRequest.bind(this, 'osint', 'profile'));
    api.post('/osint/search', this.handleServiceRequest.bind(this, 'osint', 'search'));

    // Graph routes
    api.post('/graph/query', this.handleServiceRequest.bind(this, 'graph', 'query'));
    api.post('/graph/analyze', this.handleServiceRequest.bind(this, 'graph', 'analyze'));
    api.get('/graph/nodes/:id', this.handleServiceRequest.bind(this, 'graph', 'getNode'));

    // TDA routes
    api.post('/tda/analyze', this.handleServiceRequest.bind(this, 'tda', 'analyze'));
    api.get('/tda/topology/:id', this.handleServiceRequest.bind(this, 'tda', 'getTopology'));

    // Cache routes
    api.get('/cache/:key', this.handleServiceRequest.bind(this, 'cache', 'get'));
    api.post('/cache/:key', this.handleServiceRequest.bind(this, 'cache', 'set'));
    api.delete('/cache/:key', this.handleServiceRequest.bind(this, 'cache', 'delete'));

    // Pipeline routes
    api.post('/pipeline/launch', this.handleServiceRequest.bind(this, 'pipeline', 'launch'));
    api.get('/pipeline/runs', this.handleServiceRequest.bind(this, 'pipeline', 'listRuns'));
    api.get('/pipeline/runs/:id', this.handleServiceRequest.bind(this, 'pipeline', 'getRun'));

    // Globe routes
    api.get('/globe/config', this.handleServiceRequest.bind(this, 'globe', 'getConfig'));
    api.post('/globe/layers', this.handleServiceRequest.bind(this, 'globe', 'toggleLayer'));

    // Mount API router
    this.app.use('/api/v1', api);
  }

  /**
   * Handle service request
   */
  private async handleServiceRequest(
    service: string,
    action: string,
    req: any,
    res: Response
  ): Promise<void> {
    try {
      const context: ServiceContext = {
        traceId: createId(req.traceId),
        userId: req.userId ? createId(req.userId) : undefined,
        timeout: 30000,
        startTime: createTimestamp(req.startTime),
      };

      const payload = {
        ...req.body,
        ...req.params,
        ...req.query,
      };

      const request: UnifiedRequest = {
        id: createId(`req-${uuidv4()}`),
        service,
        action,
        payload,
        context,
      };

      const response = await this.registry.call(request);

      const statusCode = response.ok ? 200 : 400;
      res.status(statusCode).json(response);
    } catch (error) {
      this.logger.error(`Service request failed: ${service}.${action}`, {
        traceId: req.traceId,
        error: String(error),
      });
      res.status(500).json({
        ok: false,
        error: {
          code: 'SERVICE_ERROR',
          message: String(error),
        },
        meta: {
          duration: Date.now() - req.startTime,
          cached: false,
        },
      });
    }
  }

  /**
   * Setup WebSocket subscriptions
   */
  private setupWebSocket(): void {
    const wsSubscriptions = new Map<WebSocket, Set<string>>();

    this.wsServer.on('connection', (ws: WebSocket, req: any) => {
      const traceId = req.headers['x-trace-id'] || `ws-${uuidv4()}`;
      this.logger.info('WebSocket connected', { traceId });

      wsSubscriptions.set(ws, new Set());

      ws.on('message', async (data: string) => {
        try {
          const msg = JSON.parse(data);
          const { action, service, payload } = msg;

          if (action === 'subscribe') {
            const subscriptions = wsSubscriptions.get(ws)!;
            subscriptions.add(`${service}:${payload.event}`);
            ws.send(
              JSON.stringify({
                ok: true,
                message: `Subscribed to ${service}:${payload.event}`,
              })
            );
          } else if (action === 'unsubscribe') {
            const subscriptions = wsSubscriptions.get(ws)!;
            subscriptions.delete(`${service}:${payload.event}`);
          }
        } catch (error) {
          ws.send(
            JSON.stringify({
              ok: false,
              error: String(error),
            })
          );
        }
      });

      ws.on('close', () => {
        wsSubscriptions.delete(ws);
        this.logger.info('WebSocket closed', { traceId });
      });
    });
  }

  /**
   * Start server
   */
  async start(port: number = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(this.app);

      // Upgrade HTTP to WebSocket
      this.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === '/ws') {
          this.wsServer.handleUpgrade(req, socket, head, (ws) => {
            this.wsServer.emit('connection', ws, req);
          });
        } else {
          socket.destroy();
        }
      });

      this.httpServer.listen(port, () => {
        this.logger.info(`API Server listening on port ${port}`);
        // Start health checks
        this.registry.startHealthChecks();
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    this.registry.stopHealthChecks();
    return new Promise((resolve) => {
      this.httpServer.close(resolve);
    });
  }
}

/**
 * Start API server
 */
if (require.main === module) {
  const server = new APIServer();
  const port = parseInt(process.env.PORT || '8000');

  server.start(port).catch((error) => {
    console.error('Failed to start API server:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

export { APIServer };
