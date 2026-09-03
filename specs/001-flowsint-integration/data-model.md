# Data Model: Flowsint Full Integration

## Entities

### User
**Collection**: `users` (Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique, indexed |
| password_hash | String | Bcrypt hash |
| created_at | Timestamp | Registration date |

**Relationships**:
- `OWNS` → Sketch
- `OWNS` → Investigation

### Sketch
**Collection**: `sketches` (Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Indexed, unique per user |
| description | Text | Optional |
| created_at | Timestamp | Creation date |
| updated_at | Timestamp | Last modification |

**Relationships**:
- `CONTAINS` → Investigation (1:many)
- `OWNS` ← User (many:1)

**Validation**:
- title: required, 1-255 chars
- title unique per user (composite index: user_id + title)

### Investigation
**Collection**: `investigations` (Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Indexed |
| sketch_id | UUID | FK to Sketch |
| created_at | Timestamp | Creation date |

**Relationships**:
- `BELONGS_TO` ← Sketch (many:1)
- `CONTAINS` → GraphNode (1:many)

**Validation**:
- name: required, 1-255 chars
- sketch_id: required

### GraphNode
**Collection**: `nodes` (Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| investigation_id | UUID | FK to Investigation |
| type | String | Node type (person, email, phone, etc.) |
| data | JSON | Type-specific properties |
| confidence | Float | 0.0-1.0, extraction confidence |
| created_at | Timestamp | Creation date |

**Relationships**:
- `BELONGS_TO` ← Investigation (many:1)
- `CONNECTED_TO` → GraphNode (many:many, with关系 properties)

**Validation**:
- type: required, enum of known types
- data: required, JSON object
- confidence: optional, default 1.0

### GraphRelation
**Collection**: `relations` (Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| source_id | UUID | FK to source node |
| target_id | UUID | FK to target node |
| type | String | Relation type (knows, uses, owns, etc.) |
| data | JSON | Relation-specific properties |
| weight | Float | 0.0-1.0, relationship strength |
| created_at | Timestamp | Creation date |

**Relationships**:
- `CONNECTED_FROM` ← GraphNode (many:1)
- `CONNECTED_TO` → GraphNode (many:1)

**Validation**:
- source_id, target_id: required, must differ
- type: required
- weight: optional, default 1.0

### Enricher
**Collection**: `enrichers` (Registry, not Neo4j)

| Field | Type | Description |
|-------|------|-------------|
| name | String | Primary key (e.g., "thebigbrother") |
| display_name | String | Human-readable name |
| description | Text | What it does |
| version | String | Semver |
| input_types | String[] | Node types it accepts |
| output_types | String[] | Node types it produces |
| config_schema | JSON | Expected configuration |

**Validation**:
- name: required, unique
- input_types, output_types: required, non-empty arrays

## State Transitions

### Investigation Lifecycle
```
CREATED → ENRICHING → ANALYZING → COMPLETED
    ↑         ↓           ↓
    └── FAILED ←──────────┘
```

### Node Lifecycle
```
EXTRACTED → ENRICHED → ANALYZED
    ↑          ↓
    └── FAILED ←┘
```

## Indexes

```cypher
-- Users
CREATE INDEX user_email IF NOT EXISTS FOR (u:User) ON (u.email);

-- Sketches
CREATE INDEX sketch_title IF NOT EXISTS FOR (s:Sketch) ON (s.title);
CREATE INDEX sketch_user IF NOT EXISTS FOR (s:Sketch) ON (s.user_id);

-- Investigations
CREATE INDEX investigation_name IF NOT EXISTS FOR (i:Investigation) ON (i.name);
CREATE INDEX investigation_sketch IF NOT EXISTS FOR (i:Investigation) ON (i.sketch_id);

-- Nodes
CREATE INDEX node_investigation IF NOT EXISTS FOR (n:GraphNode) ON (n.investigation_id);
CREATE INDEX node_type IF NOT EXISTS FOR (n:GraphNode) ON (n.type);

-- Relations
CREATE INDEX relation_source IF NOT EXISTS FOR (r:GraphRelation) ON (r.source_id);
CREATE INDEX relation_target IF NOT EXISTS FOR (r:GraphRelation) ON (r.target_id);
```

## Migrations

No schema changes required. Existing Neo4j data preserved.

New indexes created on first run:
```javascript
// services/neo4j-migrate.mjs
export async function ensureIndexes(driver) {
  const session = driver.session();
  await session.run(INDEXES_QUERY);
  await session.close();
}
```