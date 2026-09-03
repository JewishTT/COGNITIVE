# Quickstart: Flowsint Full Integration

## Prerequisites

- Node.js 24.x or 26.x
- Python 3.11+
- Neo4j running (port 7687)
- Redis running (port 6379)

## Setup

### 1. Environment Variables

```bash
# .env (add to existing)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

### 2. Install Dependencies

```bash
# Root project
npm install

# Python enrichers (if not already)
cd flowsint-enrichers
pip install -e .
cd ..
```

### 3. Start Services

```bash
# Start everything (single command)
npm run dev:all

# Or individually:
npm run dev:globe      # Globe app (port 4173)
npm run dev:platform   # Platform UI (port 5180)
npm run dev:pipeline   # Pipeline server (port 5181)
```

---

## Validation Scenarios

### Scenario 1: Authentication Flow

**Test**: User can register and login

```bash
# Register
curl -X POST http://localhost:5181/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected: 201 with token and user object

# Login
curl -X POST http://localhost:5181/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected: 200 with token

# Get current user
curl http://localhost:5181/api/v1/auth/me \
  -H "Authorization: Bearer <token>"

# Expected: 200 with user object
```

**Pass criteria**: All requests return expected status codes and valid JSON

---

### Scenario 2: Sketch CRUD

**Test**: User can create, read, update, delete sketches

```bash
# Create sketch
curl -X POST http://localhost:5181/api/v1/sketches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Investigation","description":"Testing"}'

# Expected: 201 with sketch object

# List sketches
curl http://localhost:5181/api/v1/sketches \
  -H "Authorization: Bearer <token>"

# Expected: 200 with array of sketches

# Get sketch
curl http://localhost:5181/api/v1/sketches/<id> \
  -H "Authorization: Bearer <token>"

# Expected: 200 with sketch and investigations

# Update sketch
curl -X PUT http://localhost:5181/api/v1/sketches/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Expected: 200 with updated sketch

# Delete sketch
curl -X DELETE http://localhost:5181/api/v1/sketches/<id> \
  -H "Authorization: Bearer <token>"

# Expected: 204 No Content
```

**Pass criteria**: All CRUD operations work, sketch deleted with cascade

---

### Scenario 3: Graph Operations

**Test**: User can add nodes and relations to investigation

```bash
# Create investigation
curl -X POST http://localhost:5181/api/v1/investigations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sketch_id":"<sketch-id>","name":"Test Investigation"}'

# Expected: 201 with investigation object

# Add node
curl -X POST http://localhost:5181/api/v1/investigations/<id>/nodes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"person","data":{"name":"John Doe","email":"john@example.com"}}'

# Expected: 201 with node object

# Add second node
curl -X POST http://localhost:5181/api/v1/investigations/<id>/nodes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"email","data":{"address":"john@example.com"}}'

# Expected: 201 with node object

# Add relation
curl -X POST http://localhost:5181/api/v1/investigations/<id>/relations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"source_id":"<node1-id>","target_id":"<node2-id>","type":"has_email"}'

# Expected: 201 with relation object

# Fetch graph
curl http://localhost:5181/api/v1/investigations/<id>/graph \
  -H "Authorization: Bearer <token>"

# Expected: 200 with nodes, relations, stats
```

**Pass criteria**: Graph created with 2 nodes and 1 relation, stats accurate

---

### Scenario 4: Enricher Execution

**Test**: User can run enricher on nodes

```bash
# List enrichers
curl http://localhost:5181/api/v1/enrichers \
  -H "Authorization: Bearer <token>"

# Expected: 200 with array including "thebigbrother"

# Run enricher
curl -X POST http://localhost:5181/api/v1/enrichers/thebigbrother/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"investigation_id":"<inv-id>","node_ids":["<node-id>"]}'

# Expected: 202 with run_id

# Check progress (repeat until completed)
curl http://localhost:5181/api/v1/enrichers/thebigbrother/runs/<run_id> \
  -H "Authorization: Bearer <token>"

# Expected: 200 with status and progress

# Verify new nodes added
curl http://localhost:5181/api/v1/investigations/<inv-id>/graph \
  -H "Authorization: Bearer <token>"

# Expected: 200 with additional nodes from enrichment
```

**Pass criteria**: Enricher runs, new nodes/relations added to graph

---

### Scenario 5: TDA Analysis via UI

**Test**: User can apply TDA analysis to graph

1. Open browser to `http://localhost:5180`
2. Navigate to OSINT page
3. Create investigation with 10+ nodes
4. Click TDA button on graph canvas
5. Verify overlay appears showing:
   - Connected components (colored clusters)
   - Holes/cavities (if any exist)
   - Persistence diagram in side panel

**Pass criteria**: TDA overlay renders correctly, performance <2s for 100 nodes

---

### Scenario 6: Event Streaming

**Test**: Real-time events flow from enricher to UI

1. Open browser console
2. Connect to SSE endpoint
3. Run enricher
4. Verify events received:
   - `enricher.progress` with percentage
   - `enricher.complete` when done
   - `graph.node.added` for each new node

**Pass criteria**: All events received in correct order

---

## Performance Validation

### Cold Start Test
```bash
time npm run dev:all
```
**Expected**: <5s for all services ready

### Graph Operations Test
```bash
# Add 1000 nodes
for i in {1..1000}; do
  curl -X POST http://localhost:5181/api/v1/investigations/<id>/nodes \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"test\",\"data\":{\"index\":$i}}"
done

# Fetch graph
time curl http://localhost:5181/api/v1/investigations/<id>/graph \
  -H "Authorization: Bearer <token>"
```
**Expected**: Fetch <500ms for 1000 nodes

### TDA Performance Test
```bash
# Run TDA on 1000 nodes (via UI)
# Expected**: Analysis completes <3s
```

---

## Troubleshooting

### Issue: flowsint-api not found
**Solution**: Ensure Neo4j is running and `NEO4J_URI` is correct in `.env`

### Issue: Enricher fails to run
**Solution**: Check Python path, ensure `flowsint-enrichers` is installed

### Issue: TDA button not appearing
**Solution**: Check browser console for errors, ensure `FEATURE_TDA_ENABLED` is true

### Issue: Events not streaming
**Solution**: Check SSE connection, verify JWT token is valid