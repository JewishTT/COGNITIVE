# Implementation Plan: Flowsint Full Integration

**Branch**: `001-flowsint-integration` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-flowsint-integration/spec.md`

## Summary

Полная интеграция flowsint в основной проект COGNITIVE. Текущая архитектура: flowsint как отдельный FastAPI сервер (port 5001) с REST-мостом. Целевая архитектура: flowsint как часть pipeline-server, единый процесс, прямые вызовы без REST.

## Technical Context

**Language/Version**: Node.js 24+ (ESM), TypeScript 5.x (Vue 3), Python 3.11+ (enrichers)

**Primary Dependencies**: Express.js, Neo4j driver, Vue 3, Vite, FastAPI (enricher subprocess)

**Storage**: Neo4j (graph database), Redis (caching - existing)

**Testing**: Vitest (frontend), pytest (Python enrichers), Node.js test runner (pipeline)

**Target Platform**: Desktop browser (Chrome/Firefox/Safari), Node.js server

**Project Type**: Web application (SPA + API server)

**Performance Goals**: Graph operations <500ms, 60fps rendering, <2s cold start

**Constraints**: Single process deployment, preserve existing UI, maintain API compatibility

**Scale/Scope**: Single-user/multi-user OSINT workstation, 10k+ nodes per investigation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. No Mocks | ✅ PASS | All functions work with real Neo4j data, no stubs |
| II. Architectural Integrity | ✅ PASS | flowsint code rewritten to fit Node.js/ESM patterns |
| III. Optimization | ✅ PASS | Direct calls replace REST overhead, single process |

## Project Structure

### Documentation (this feature)

```text
specs/001-flowsint-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
platform/
├── pipeline-server/
│   ├── index.mjs           # Entry point (existing)
│   ├── engine.mjs          # Pipeline orchestrator (existing)
│   ├── flowsint.mjs        # REST bridge → TO BE REMOVED
│   ├── store.mjs           # Neo4j writer (existing, modify)
│   ├── routes/
│   │   ├── auth.mjs        # NEW: Auth routes (from flowsint-api)
│   │   ├── sketches.mjs    # NEW: Sketch CRUD
│   │   ├── investigations.mjs  # NEW: Investigation CRUD
│   │   ├── enrichers.mjs   # NEW: Enricher management
│   │   ├── events.mjs      # NEW: Event streaming
│   │   └── graph.mjs       # NEW: Graph operations
│   └── services/
│       ├── auth.mjs        # NEW: Auth service
│       ├── sketch.mjs      # NEW: Sketch service
│       ├── investigation.mjs  # NEW: Investigation service
│       ├── enricher.mjs    # NEW: Enricher executor
│       └── event-bus.mjs   # NEW: Event bus
│
├── src/
│   ├── widgets/
│   │   ├── graph-canvas/
│   │   │   └── components/
│   │   │       └── TdaButton.vue  # NEW: TDA toggle button
│   │   └── tda-layer/       # EXISTING: TDA overlay
│   │
│   └── pages/osint/
│       └── tabs/
│           └── UiFlowsintTab.vue  # MODIFY: Remove TDA tab dependency
│
core/
├── services/
│   ├── graph/              # EXISTING: Neo4j graph service
│   ├── tda/                # EXISTING: TDA algorithms
│   └── enricher/           # NEW: Enricher framework
│       ├── index.ts        # Enricher executor
│       ├── registry.ts     # Enricher discovery
│       └── types.ts        # Enricher types
│
flowsint/                   # KEEP: Python enrichers (subprocess)
├── flowsint-core/          # Enricher base classes
└── flowsint-enrichers/     # TheBigBrother, etc.
```

**Structure Decision**: Option 2 (Web application) — backend (pipeline-server) + frontend (Vue platform). flowsint Python code stays as subprocess, not integrated into Node.js.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Python subprocess for enrichers | flowsint-core is Python, rewriting to JS would lose functionality | Keep existing enricher ecosystem intact |
| Neo4j direct access from multiple services | Graph operations need direct driver access for performance | REST adds latency, single DB connection pool |

## Research Tasks

### Phase 0: Research ✅ COMPLETE

1. **flowsint-api endpoint mapping** ✅ — 16 endpoints mapped to Express routes
2. **Enricher subprocess protocol** ✅ — Child process with JSON stdin/stdout
3. **Neo4j connection pooling** ✅ — Shared driver instance
4. **Auth token sharing** ✅ — JWT secret in .env, token propagation
5. **Event streaming** ✅ — SSE integrated with event bus

**Output**: [research.md](./research.md)

### Phase 1: Design ✅ COMPLETE

1. **Data Model** ✅ — 5 entities defined (User, Sketch, Investigation, GraphNode, GraphRelation)
2. **Contracts** ✅ — REST API with 15 endpoints documented
3. **Quickstart** ✅ — 6 validation scenarios with test commands

**Output**: [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

## Implementation Phases

### Phase 2: Backend (Pipeline Server)
- Create route files (auth, sketches, investigations, enrichers, events)
- Create service files (auth, sketch, investigation, enricher, event-bus)
- Remove REST bridge (flowsint.mjs)
- Update store.mjs to use services directly

### Phase 3: Frontend (Platform)
- Add TDA button to graph canvas
- Update UiFlowsintTab to use new API
- Remove TDA tab dependency
- Test all widgets

### Phase 4: Integration
- Connect enricher executor to Python subprocess
- Test end-to-end flow
- Performance validation
- Documentation update