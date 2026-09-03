# API Contracts: Flowsint Integration

## Base URL
```
/api/v1
```

## Authentication

### POST /auth/login
**Request**:
```json
{
  "email": "user@example.com",
  "password": "string"
}
```
**Response** (200):
```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```
**Error** (401):
```json
{
  "error": "Invalid credentials"
}
```

### POST /auth/register
**Request**:
```json
{
  "email": "user@example.com",
  "password": "string"
}
```
**Response** (201):
```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### GET /auth/me
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

---

## Sketches

### POST /sketches
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "title": "string (required, 1-255 chars)",
  "description": "string (optional)"
}
```
**Response** (201):
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "created_at": "ISO8601"
}
```

### GET /sketches
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "sketches": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "created_at": "ISO8601",
      "investigation_count": 5
    }
  ]
}
```

### GET /sketches/:id
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "created_at": "ISO8601",
  "investigations": [
    {
      "id": "uuid",
      "name": "string",
      "node_count": 42
    }
  ]
}
```

### PUT /sketches/:id
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "title": "string (optional)",
  "description": "string (optional)"
}
```
**Response** (200):
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "updated_at": "ISO8601"
}
```

### DELETE /sketches/:id
**Headers**: `Authorization: Bearer <token>`
**Response** (204): No content

---

## Investigations

### POST /investigations
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "sketch_id": "uuid (required)",
  "name": "string (required, 1-255 chars)"
}
```
**Response** (201):
```json
{
  "id": "uuid",
  "name": "string",
  "sketch_id": "uuid",
  "created_at": "ISO8601"
}
```

### GET /investigations/:id
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "id": "uuid",
  "name": "string",
  "sketch_id": "uuid",
  "created_at": "ISO8601",
  "graph": {
    "nodes": [
      {
        "id": "uuid",
        "type": "person",
        "data": { "name": "John Doe", "email": "john@example.com" },
        "confidence": 0.95
      }
    ],
    "relations": [
      {
        "id": "uuid",
        "source_id": "uuid",
        "target_id": "uuid",
        "type": "knows",
        "weight": 0.8
      }
    ]
  }
}
```

### POST /investigations/:id/nodes
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "type": "person",
  "data": { "name": "John Doe", "email": "john@example.com" },
  "confidence": 0.95
}
```
**Response** (201):
```json
{
  "id": "uuid",
  "type": "person",
  "data": { "name": "John Doe", "email": "john@example.com" },
  "confidence": 0.95,
  "created_at": "ISO8601"
}
```

### POST /investigations/:id/relations
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "source_id": "uuid (required)",
  "target_id": "uuid (required)",
  "type": "knows",
  "data": {},
  "weight": 0.8
}
```
**Response** (201):
```json
{
  "id": "uuid",
  "source_id": "uuid",
  "target_id": "uuid",
  "type": "knows",
  "weight": 0.8,
  "created_at": "ISO8601"
}
```

### GET /investigations/:id/graph
**Headers**: `Authorization: Bearer <token>`
**Query**: `?depth=2` (optional, default 1)
**Response** (200):
```json
{
  "nodes": [...],
  "relations": [...],
  "stats": {
    "node_count": 42,
    "relation_count": 67,
    "density": 0.23
  }
}
```

---

## Enrichers

### GET /enrichers
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "enrichers": [
    {
      "name": "thebigbrother",
      "display_name": "TheBigBrother",
      "description": "Social media OSINT enrichment",
      "version": "1.0.0",
      "input_types": ["person", "email", "phone"],
      "output_types": ["social_profile", "post"]
    }
  ]
}
```

### POST /enrichers/:name/run
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "investigation_id": "uuid (required)",
  "node_ids": ["uuid1", "uuid2"] (optional, default: all nodes),
  "config": {} (optional, enricher-specific)
}
```
**Response** (202):
```json
{
  "run_id": "uuid",
  "status": "started",
  "enricher": "thebigbrother"
}
```

### GET /enrichers/:name/runs/:run_id
**Headers**: `Authorization: Bearer <token>`
**Response** (200):
```json
{
  "run_id": "uuid",
  "status": "running|completed|failed",
  "progress": {
    "total": 10,
    "completed": 7,
    "failed": 0
  },
  "results": [
    {
      "node_id": "uuid",
      "status": "success",
      "new_nodes": 3,
      "new_relations": 5
    }
  ]
}
```

---

## Events (SSE)

### GET /events
**Headers**: `Authorization: Bearer <token>`
**Response**: Server-Sent Events stream

**Event types**:
- `enricher.progress` — Enricher progress update
- `enricher.complete` — Enricher finished
- `graph.node.added` — New node added
- `graph.relation.added` — New relation added

**Event format**:
```
event: enricher.progress
data: {"run_id": "uuid", "progress": {"total": 10, "completed": 7}}

event: graph.node.added
data: {"investigation_id": "uuid", "node": {...}}
```

---

## Error Response Format

All errors follow this format:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} (optional)
}
```

**Common error codes**:
- `UNAUTHORIZED` — Missing or invalid token
- `NOT_FOUND` — Resource not found
- `VALIDATION_ERROR` — Invalid request body
- `CONFLICT` — Resource already exists
- `INTERNAL_ERROR` — Server error