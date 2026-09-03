# Tasks: Flowsint Full Integration

## Phase 1: Setup

- [ ] T001 Verify Node.js 24.x/26.x and Python 3.11+ installed
- [ ] T002 Verify Neo4j and Redis running on default ports
- [ ] T003 Create `.env` entries for NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, JWT_SECRET
- [ ] T004 Run `npm install` to install dependencies
- [ ] T005 Run `pip install -e flowsint-enrichers` for Python enrichers

## Phase 2: Foundational (Backend Services)

- [x] T006 [P] Create auth service in `platform/pipeline-server/services/auth.mjs`
- [x] T007 [P] Create sketch service in `platform/pipeline-server/services/sketch.mjs`
- [x] T008 [P] Create investigation service in `platform/pipeline-server/services/investigation.mjs`
- [x] T009 [P] Create enricher executor in `platform/pipeline-server/services/enricher.mjs`
- [x] T010 [P] Create event bus in `platform/pipeline-server/services/event-bus.mjs`
- [x] T011 Create Neo4j migration helper in `platform/pipeline-server/services/neo4j-migrate.mjs`
- [x] T012 Update `platform/pipeline-server/index.mjs` to initialize services

## Phase 3: Backend Routes (US1: Auth Flow)

- [x] T013 [US1] Create auth routes in `platform/pipeline-server/routes/auth.mjs`
- [x] T014 [US1] Add JWT middleware to `platform/pipeline-server/middleware/auth.mjs`
- [x] T015 [US1] Test registration: `POST /api/v1/auth/register`
- [x] T016 [US1] Test login: `POST /api/v1/auth/login`
- [x] T017 [US1] Test current user: `GET /api/v1/auth/me`

## Phase 4: Backend Routes (US2: Sketch CRUD)

- [x] T018 [US2] Create sketch routes in `platform/pipeline-server/routes/sketches.mjs`
- [x] T019 [US2] Test create sketch: `POST /api/v1/sketches`
- [x] T020 [US2] Test list sketches: `GET /api/v1/sketches`
- [x] T021 [US2] Test get sketch: `GET /api/v1/sketches/:id`
- [x] T022 [US2] Test update sketch: `PUT /api/v1/sketches/:id`
- [x] T023 [US2] Test delete sketch: `DELETE /api/v1/sketches/:id`

## Phase 5: Backend Routes (US3: Graph Operations)

- [x] T024 [US3] Create investigation routes in `platform/pipeline-server/routes/investigations.mjs`
- [x] T025 [US3] Test create investigation: `POST /api/v1/investigations`
- [x] T026 [US3] Test add node: `POST /api/v1/investigations/:id/nodes`
- [x] T027 [US3] Test add relation: `POST /api/v1/investigations/:id/relations`
- [x] T028 [US3] Test fetch graph: `GET /api/v1/investigations/:id/graph`

## Phase 6: Backend Routes (US4: Enricher Execution)

- [x] T029 [US4] Create enricher routes in `platform/pipeline-server/routes/enrichers.mjs`
- [x] T030 [US4] Test list enrichers: `GET /api/v1/enrichers`
- [x] T031 [US4] Test run enricher: `POST /api/v1/enrichers/:name/run`
- [x] T032 [US4] Test check progress: `GET /api/v1/enrichers/:name/runs/:run_id`

## Phase 7: Backend Routes (US5: Event Streaming)

- [x] T033 [US5] Create event routes in `platform/pipeline-server/routes/events.mjs`
- [x] T034 [US5] Test SSE connection: `GET /api/v1/events`
- [x] T035 [US5] Test enricher progress events
- [x] T036 [US5] Test graph update events

## Phase 8: Remove REST Bridge

- [x] T037 Remove `platform/pipeline-server/flowsint.mjs` REST bridge
- [x] T038 Update `platform/pipeline-server/engine.mjs` to use services directly
- [x] T039 Update `platform/pipeline-server/store.mjs` to use services directly
- [x] T040 Remove flowsint-api proxy from `platform/vite.platform.config.js`

## Phase 9: Frontend (US6: TDA Button)

- [x] T041 [US6] Create TDA button component in `platform/src/widgets/graph-canvas/components/TdaButton.vue`
- [x] T042 [US6] Add TDA button to GraphCanvas widget
- [x] T043 [US6] Integrate TDA service with button click handler
- [x] T044 [US6] Test TDA overlay renders on graph

## Phase 10: Frontend Integration

- [x] T045 Update `platform/src/pages/osint/tabs/UiFlowsintTab.vue` to use new API
- [x] T046 Remove TDA tab dependency from UiFlowsintTab
- [x] T047 Test investigation sidebar works with new API
- [x] T048 Test node inspector works with new API
- [x] T049 Test enricher catalog works with new API
- [x] T050 Test event log receives real-time events

## Phase 11: Integration Testing

- [ ] T051 Test full flow: Create sketch → Add nodes → Run enricher → View results
- [ ] T052 Test TDA analysis on 100+ node graph
- [ ] T053 Test concurrent enricher execution
- [ ] T054 Test event streaming under load

## Phase 12: Performance Validation

- [ ] T055 Measure cold start time (target: <5s)
- [ ] T056 Measure graph fetch time for 1000 nodes (target: <500ms)
- [ ] T057 Measure TDA analysis time for 100 nodes (target: <3s)
- [ ] T058 Profile memory usage during typical session

## Phase 13: Documentation & Polish

- [ ] T059 Update README.md with new architecture
- [ ] T060 Update CONTRIBUTING.md with development workflow
- [ ] T061 Create ARCHITECTURE.md documenting integration
- [ ] T062 Clean up console.log statements
- [ ] T063 Add error boundaries to all services

---

## Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3-7 (Backend Routes) — Can run in parallel
    ↓
Phase 8 (Remove REST Bridge)
    ↓
Phase 9-10 (Frontend)
    ↓
Phase 11-12 (Testing & Performance)
    ↓
Phase 13 (Documentation)
```

## User Story Mapping

| User Story | Phases | Description |
|------------|--------|-------------|
| US1: Auth Flow | 3 | User registration and login |
| US2: Sketch CRUD | 4 | Create, read, update, delete sketches |
| US3: Graph Operations | 5 | Add nodes and relations to investigations |
| US4: Enricher Execution | 6 | Run enrichers on graph nodes |
| US5: Event Streaming | 7 | Real-time events from enrichers |
| US6: TDA Button | 9 | TDA analysis overlay on graph canvas |

## Parallel Execution Opportunities

**Phase 2**: All 5 services can be created in parallel (T006-T010)
**Phase 3-7**: All route files can be created in parallel (T013, T018, T024, T029, T033)
**Phase 9-10**: TDA button and UI updates can be parallelized

## MVP Scope

**Minimum Viable Product**: Phases 1-5 (Setup + Auth + Sketch CRUD + Graph Operations)

This gives a working system where users can:
- Register and login
- Create investigations
- Add nodes and relations
- Fetch and view graphs

Enrichers and TDA can be added incrementally after MVP.