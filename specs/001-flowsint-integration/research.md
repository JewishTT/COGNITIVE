# Research: Flowsint Full Integration

## 1. flowsint-api Endpoint Mapping

### Current Endpoints (FastAPI on port 5001)

| Method | Endpoint | Purpose | New Location |
|--------|----------|---------|--------------|
| POST | `/auth/login` | User login | `routes/auth.mjs` |
| POST | `/auth/register` | User registration | `routes/auth.mjs` |
| GET | `/auth/me` | Current user | `routes/auth.mjs` |
| POST | `/sketches` | Create sketch | `routes/sketches.mjs` |
| GET | `/sketches` | List sketches | `routes/sketches.mjs` |
| GET | `/sketches/{id}` | Get sketch | `routes/sketches.mjs` |
| PUT | `/sketches/{id}` | Update sketch | `routes/sketches.mjs` |
| DELETE | `/sketches/{id}` | Delete sketch | `routes/sketches.mjs` |
| POST | `/investigations` | Create investigation | `routes/investigations.mjs` |
| GET | `/investigations` | List investigations | `routes/investigations.mjs` |
| GET | `/investigations/{id}` | Get investigation | `routes/investigations.mjs` |
| POST | `/investigations/{id}/nodes` | Add node | `routes/investigations.mjs` |
| POST | `/investigations/{id}/relations` | Add relation | `routes/investigations.mjs` |
| GET | `/investigations/{id}/graph` | Fetch graph | `routes/investigations.mjs` |
| GET | `/enrichers` | List enrichers | `routes/enrichers.mjs` |
| POST | `/enrichers/{name}/run` | Run enricher | `routes/enrichers.mjs` |
| GET | `/events` | SSE stream | `routes/events.mjs` |

### Decision: Direct Express routes, no REST bridge

**Rationale**: Single process, direct function calls, no HTTP overhead

**Alternatives considered**:
- Keep REST bridge: adds 5-10ms latency per call
- GraphQL: overkill for internal API
- gRPC: requires proto definitions, overkill

## 2. Enricher Subprocess Protocol

### Current Flow (Python)
```
flowsint-core → enricher registry → subprocess call → JSON result
```

### New Flow (Node.js)
```
pipeline-server → enricher service → Python subprocess → JSON parsing
```

### Decision: Child process with JSON stdin/stdout

**Rationale**: 
- Python enrichers expect CLI-style invocation
- JSON is natural for both Python and Node.js
- No need for gRPC/HTTP between Node.js and Python

**Implementation**:
```javascript
// services/enricher.mjs
import { spawn } from 'child_process';

export async function runEnricher(name, nodes, config) {
  const python = spawn('python', [
    '-m', 'flowsint_core.enricher',
    '--name', name,
    '--input', '-'
  ]);
  
  python.stdin.write(JSON.stringify({ nodes, config }));
  python.stdin.end();
  
  return new Promise((resolve, reject) => {
    let output = '';
    python.stdout.on('data', (data) => output += data);
    python.on('close', () => resolve(JSON.parse(output)));
    python.on('error', reject);
  });
}
```

## 3. Neo4j Connection Pooling

### Current State
- `core/services/graph/index.ts` creates single driver instance
- All services share same driver (good)
- Driver has built-in connection pooling

### Decision: Single driver, multiple service access

**Rationale**: Neo4j driver already handles connection pooling. Multiple services can use same driver instance.

**Implementation**:
```javascript
// Export shared driver from core
import { driver } from '@core/services/graph';

// All services import and use same driver
export const sketchService = new SketchService(driver);
export const investigationService = new InvestigationService(driver);
```

## 4. Auth Token Sharing

### Current State
- flowsint-api uses JWT tokens
- pipeline-server has no auth (internal service)

### Decision: Shared JWT secret, token propagation

**Rationale**: 
- Same user, same session
- Token can be passed in request headers
- No need for token exchange

**Implementation**:
- JWT_SECRET in `.env` (shared)
- Token passed from frontend to all API calls
- Services validate token, extract user ID

## 5. Event Streaming

### Current State
- flowsint-api uses Server-Sent Events (SSE)
- Platform has event bus (`core/services/eventBus`)

### Decision: Integrate SSE into existing event bus

**Rationale**: 
- Platform already has event bus pattern
- SSE is just another event source
- Unified event system for all services

**Implementation**:
```javascript
// services/event-bus.mjs
export class EventBus {
  emit(event, data) {
    // To SSE clients
    this.sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({ event, data })}\n\n`);
    });
    // To internal listeners
    this.listeners.forEach(fn => fn(event, data));
  }
}
```

## Summary

| Decision | Choice | Confidence |
|----------|--------|------------|
| API integration | Express routes | High |
| Enricher execution | Python subprocess | High |
| Neo4j access | Shared driver | High |
| Auth | JWT sharing | High |
| Events | SSE + event bus | High |

All NEEDS CLARIFICATION resolved. Ready for Phase 1 design.