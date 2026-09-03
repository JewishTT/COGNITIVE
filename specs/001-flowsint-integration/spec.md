# Flowsint Full Integration

## Overview

Полная интеграция flowsint в основной проект COGNITIVE вместо текущей монолитной архитектуры с отдельным API.

## Current State

Сейчас flowsint существует как:
- Отдельный FastAPI сервер (port 5001) с собственной БД
- React-фронтенд (flowsint-app) который не используется нативно
- Python enricher framework (flowsint-core)
- Мост-клиент (flowsint.mjs) для REST-коммуникации

**Проблема**: flowsint — это изолированный монолит. Платформа общается с ним через REST, что создаёт задержки, дублирование логики и сложность деплоя.

## Target State

Flowsint становится частью платформы:
- **API** интегрируется как модуль pipeline-server (не отдельный процесс)
- **Enricher framework** становится частью core/services
- **UI** сохраняет текущий вид, но работает через единый pipeline
- **Neo4j** остаётся как основное хранилище графов

## Functional Requirements

### 1. Unified API Layer
- Flowsint API эндпоинты мигрируют в pipeline-server как Express/Node.js роуты
- Auth, sketches, investigations, enrichers, flows, events — всё в одном процессе
- REST-мост (flowsint.mjs) заменяется прямыми вызовами
- Сохраняются все существующие контракты (API URL, форматы ответов)

### 2. Enricher Framework Integration
- Python enricher base classes и registry интегрируются как subprocess executor
- Enricher discovery и auto-registration работают через pipeline-server
- TheBigBrother engine (LinkedIn, GitHub, Twitter, Telegram, Instagram) работает как внешний вызов
- Results записываются в Neo4j через единый graph service

### 3. UI Preservation
- Все текущие виджеты сохраняются: InvestigationSidebar, GraphCanvas, NodeInspector, TypePalette, EnricherCatalog, EventLog
- Flowsint tab остаётся как основной graph workspace
- Все функции: создание sketch, investigation, добавление nodes/relationships

### 4. Topology Integration (TDA Button)
- На graph canvas добавляется кнопка/иконка TDA
- При нажатии данные перестраиваются по топологическим методам:
  - Vietoris-Rips complex → Betti numbers → connected components, holes, cavities
  - Persistence diagrams → визуализация критических точек
  - Community detection → кластеризация узлов
- TDA результаты накладываются как overlay на существующий граф
- Нет отдельной вкладки — всё в одном view

### 5. Data Pipeline Unification
- COLLECT → EXTRACT → STORE работает через единый pipeline
- Результаты OSINT (BBOT, theHarvester, sherlock, maigret) сразу в graph
- Enrichment (TheBigBrother) применяется к собранным узлам
- TDA анализ доступен для любого графа

## User Scenarios

### Scenario 1: User opens OSINT page
1. Opening OSINT page loads unified graph workspace
2. All existing tabs work: Investigation sidebar, Graph canvas, Enricher catalog
3. User can create investigation, add nodes, run enrichers — всё как раньше

### Scenario 2: User applies TDA analysis
1. User clicks TDA button on graph canvas
2. System runs Vietoris-Rips on current graph
3. Results overlay: connected components highlighted, holes/cavities marked
4. Persistence diagram shows in side panel
5. User can toggle TDA layer on/off

### Scenario 3: User runs enrichment
1. User selects nodes in graph
2. Opens enricher catalog, picks TheBigBrother
3. Enricher runs as subprocess, results appear in real-time
4. Graph updates with new nodes/relationships

## Success Criteria

- [ ] Flowsint API runs as part of pipeline-server (single process)
- [ ] All enrichers work through unified pipeline
- [ ] UI preserves 100% of current flowsint functionality
- [ ] TDA overlay works on any graph without navigation
- [ ] Response time <500ms for graph operations (same or better than current REST)
- [ ] Single `npm run dev` starts everything (no separate flowsint-api process)

## Assumptions

- Neo4j database schema remains unchanged
- Python enrichers continue to run as subprocesses
- Current flowsint-app React frontend is not used (replaced by Vue widgets)
- Auth tokens can be shared between pipeline and graph services

## Out of Scope

- flowsint-app (React) migration
- New enricher development
- Database migration or schema changes
- Mobile UI adaptation