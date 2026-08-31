# COGNITIVE PLATFORM - UNIFIED ARCHITECTURE

## Overview

COGNITIVE is a multi-layered intelligence platform that unifies OSINT collection, graph analysis, topological data analysis (TDA), 3D geospatial visualization, and social media automation.

**Architecture Goal:** Single unified contract (`IServiceNode`) for all services → consistent error handling, tracing, discovery, and resilience across layers.

---

## Layer Model

```
┌────────────────────────────────────────────────────────────┐
│ Layer 5: FRONTEND (Browser)                                │
│   - 3D Globe (Cesium.js + Vue)                             │
│   - Voice Control (OpenAI Realtime)                        │
│   - Modular UI Components                                  │
└────────────────────────────────────────────────────────────┘
                         ↓ HTTP/WebSocket
┌────────────────────────────────────────────────────────────┐
│ Layer 4: API SERVER (Node.js/Express)                      │
│   - REST API (GraphQL TBD)                                 │
│   - WebSocket subscriptions                                │
│   - Authentication & Authorization                         │
│   - Request routing to unified services                    │
└────────────────────────────────────────────────────────────┘
                         ↓ IServiceNode
┌────────────────────────────────────────────────────────────┐
│ Layer 3: UNIFIED SERVICE LAYER (Core)                      │
│   - ServiceRegistry (discovery + health checks)            │
│   - Circuit breaker + retry logic                          │
│   - Unified request/response contracts                     │
│   - Error codes & trace IDs                                │
│                                                             │
│   Services:                                                │
│   ├─ OSINT Service (Python bridge)                        │
│   ├─ Graph Service (Neo4j)                                │
│   ├─ Globe Service (Cesium subscriptions)                 │
│   ├─ TDA Service (Topological analysis)                   │
│   ├─ Cache Service (Redis)                                │
│   └─ Pipeline Service (Data collection)                   │
└─────────────────────────────────────────��──────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ Layer 2: SPECIALIZED ENGINES                               │
│   - Pipeline Server (collect.mjs, extract.mjs)            │
│   - Neo4j Graph Engine                                    │
│   - Python OSINT Enrichers (TheBigBrother, etc.)         │
│   - Cesium 3D Renderer                                    │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ Layer 1: DATA & INFRASTRUCTURE                             │
│   - PostgreSQL / Redis                                    │
│   - Neo4j Database                                        │
│   - External APIs (OpenSky, AIS, etc.)                    │
│   - File Storage                                          │
└────────────────────────────────────────────────────────────┘
```

---

## Unified Service Contract

All services implement `IServiceNode`:

```typescript
interface IServiceNode {
  readonly name: string;
  readonly version: string;
  health(): Promise<ServiceHealth>;
  execute<T>(req: UnifiedRequest<T>): Promise<UnifiedResponse>;
}
```

### Request Structure

```typescript
interface UnifiedRequest<T = any> {
  id: ID;                          // Trace ID
  service: string;                 // Service name
  action: string;                  // Action/method
  payload: T;                      // Service-specific data
  context: {
    traceId: ID;                   // Distributed tracing
    userId?: ID;                   // Authenticated user
    timeout: number;               // Request timeout (ms)
    startTime: Timestamp;          // Request start
  };
}
```

### Response Structure

```typescript
interface UnifiedResponse<T = any> {
  id: ID;                          // Echo request ID
  ok: boolean;                     // Success flag
  data?: T;                        // Response data
  error?: {
    code: string;                  // Error code
    message: string;               // Human message
    details?: Record<string, any>; // Extra context
  };
  meta: {
    duration: number;              // Execution time (ms)
    cached: boolean;               // Cache hit?
    metrics?: {                    // Optional metrics
      dbQueries?: number;
      cacheHits?: number;
    };
  };
}
```

---

## Service Registry

Central discovery and health checking:

```typescript
const registry = new ServiceRegistry();
registry.register('osint', osintService);
registry.register('graph', graphService);

// Execute request with automatic routing
const response = await registry.call(request);
```

### Features

- **Health Checks:** Periodic health checks (30s default)
- **Circuit Breaker:** Opens after N failures, recovers after timeout
- **Retry Logic:** Exponential backoff (configurable)
- **Timeout Enforcement:** Tracks request lifetime
- **Metrics:** Success/error counts, latency tracking

---

## Configuration

### Environment Variables

See `.env.example` for all options. Key variables:

```bash
NODE_ENV=development
NEO4J_URL=bolt://localhost:7687
REDIS_URL=redis://localhost:6379
OSINT_URL=http://localhost:5001
PIPELINE_URL=http://localhost:5001
```

### Config Loader

```typescript
import { getConfig } from '@cognitive/core';

const config = getConfig();
const neo4jUrl = config.getServiceConfig('graph')?.url;
const cacheConfig = config.getCacheConfig();
```

---

## Error Handling

Standardized error codes across all services:

```typescript
ErrorCode.SERVICE_NOT_FOUND        // 503
ErrorCode.SERVICE_TIMEOUT          // 504
ErrorCode.INVALID_REQUEST          // 400
ErrorCode.UNAUTHORIZED             // 401
ErrorCode.DATABASE_ERROR           // 500
ErrorCode.CIRCUIT_BREAKER_OPEN     // 503
// ... 30+ codes total
```

HTTP status mapping is automatic via `ErrorStatusMap`.

---

## Distributed Tracing

Every request carries a trace ID:

```typescript
const req = new RequestBuilder()
  .forService('osint')
  .action('profile')
  .payload({ username: 'ghost7' })
  .withContext({
    traceId: createId('trace-' + Date.now()),
    userId: createId('user-123'),
    timeout: 30000,
  })
  .build();
```

Trace IDs flow through all layers → correlated logs → debugging.

---

## Phase Breakdown

### Phase 1: Core ✅
- Unified contracts (IServiceNode, Request/Response)
- ServiceRegistry with health checks
- ConfigLoader
- Error codes & logging

### Phase 2: Config Extraction (Planned)
- Move vite.config.js logic → config/
- YAML-based configuration
- Environment overrides

### Phase 3: API Server (Planned)
- Express server with unified routing
- WebSocket for subscriptions
- Authentication layer

### Phase 4: Modular UI (Planned)
- Break ui.js (455KB) into components
- UIService integration with new API
- Component testing

### Phase 5: Python Bridge (Planned)
- Async OSINT service wrapper
- Streaming JSON events
- Process lifecycle management

### Phase 6: Service Discovery (Planned)
- Service registry integration
- Health check automation
- Circuit breaker patterns

### Phase 7: Docker Orchestration (Planned)
- Unified docker-compose.yml
- Multi-service health checks
- Network isolation

### Phase 8: Testing & Docs (Planned)
- E2E test suite
- OpenAPI schema
- Migration guides

---

## Running the Platform

### Local Development

```bash
# Install dependencies
npm install

# Start all services
docker-compose up -d

# Start dev server
npm run dev:all

# Watch logs
docker-compose logs -f
```

### Health Check

```bash
# Check all services
curl http://localhost:8000/health

# Response:
{
  "services": {
    "osint": { "status": "up", "latency": 2 },
    "graph": { "status": "up", "latency": 1 },
    "cache": { "status": "up", "latency": 0 }
  }
}
```

---

## Glossary

- **IServiceNode:** Interface all services implement
- **UnifiedRequest/Response:** Standard message format
- **ServiceRegistry:** Central discovery & health checks
- **Circuit Breaker:** Failure isolation pattern
- **Trace ID:** Request identifier for distributed tracing
- **OSINT:** Open-Source INTelligence (collection layer)
- **TDA:** Topological Data Analysis (graph structure)
- **Flowsint:** Internal graph engine framework

---

## Next Steps

1. Review Phase 1 core changes
2. Test ServiceRegistry with mock services
3. Migrate existing services to IServiceNode interface
4. Implement Phase 2 (Config extraction)
5. Build Phase 3 (API Server)
