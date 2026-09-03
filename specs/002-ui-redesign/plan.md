# СПЕКА: Редизайн UI — OSINT Platform + Pipeline

## Проблемы текущего UI

### PipelineTab.vue (1852 строки)
- **Монолит**: 4 вьюхи (list/editor/executions/templates) в одном файле
- **Хардкод**: Demo-данные прямо в компоненте (pipelines, executions, templates)
- **Нет бэкенда**: Все API-вызовы симулируются через `setTimeout`
- **Нет пайплайнов из бэкенда**: Реальные данные из `usePipelineTab.ts` не используются
- **Дублирование**: 2 системы стилей (glass-card + os-*)

### UiFlowsintTab.vue (1132 строки)
- **Заголовок**: "OSINT Flowsint Integration" — некорпоративно
- **Стиль**: Смешение glass-morphism и FSD-стиля
- **Нет统一 design system**: Каждый виджет стилизован по-своему

### Общие проблемы
- **Два дизайн-языка**: "Premium" (glass-card) и "FSD" (os-*) не совместимы
- **Emoji-иконки**: Вместо нормальных SVG-иконок
- **Нет темы**: CSS-переменные разрознены

---

## Референсы корпоративных OSINT-платформ

### 1. Maltego (标准)
- **Цвета**: Тёмная тема (#1a1a2e фон, #16213e панели, #0f3460 акценты)
- **Граф**: Центральное место,占满整个视口
- **Панели**: Слева — иерархия объектов, справа — свойства
- **Иконки**: SVG, цветовые коды по типам (Person=синий, Email=зелёный, Phone=жёлтый)
- **Тулбар**: Верхний, компактный, с dropdown-меню

### 2. Palantir Gotham
- **Цвета**: Тёмно-серый (#1c1c1c фон, #2d2d2d панели, #4a9eff акцент)
- **Макет**: Чистый, минималистичный, много воздуха
- **Данные**: Таблицы + графы + timeline в одном представлении
- **Навигация**: Верхний бар с breadcrumbs

### 3. SpiderFoot
- **Цвета**: Тёмная тема с зелёным акцентом (#00ff88)
- **Дашборд**: Карточки со статусами, живые обновления
- **Конвейер**: Вертикальный stepper с иконками этапов

### 4. IntelligenceX
- **Цвета**: Чёрный фон, белый текст, красные акценты
- **Поиск**: Центральное поле ввода, минимум вокруг
- **Результаты**: Табличный вид с фильтрами

### 5. Shodan
- **Цвета**: Тёмно-синий (#0a0e1a фон, #1a2332 карточки)
- **Карточки**: Светящиеся бордеры при ховере
- **Статистика**: Крупные цифры в центре

---

## Дизайн-система

### Цветовая палитра
```css
:root {
  /* Фон */
  --bg-primary: #0d1117;      /* Основной фон */
  --bg-secondary: #161b22;     /* Панели, карточки */
  --bg-tertiary: #21262d;      /* Hover, активные элементы */
  --bg-elevated: #30363d;      /* Модалки, дропдауны */
  
  /* Текст */
  --text-primary: #e6edf3;     /* Основной текст */
  --text-secondary: #8b949e;   /* Вторичный текст */
  --text-muted: #484f58;       /* Подсказки, лейблы */
  
  /* Акценты */
  --accent-blue: #58a6ff;      /* Ссылки, действия */
  --accent-green: #3fb950;     /* Успех, онлайн */
  --accent-orange: #d29922;     /* Предупреждения */
  --accent-red: #f85149;       /* Ошибки, удаление */
  --accent-purple: #bc8cff;    /* TDA, аналитика */
  --accent-cyan: #39d2c0;      /* Граф, связи */
  
  /* Границы */
  --border-primary: #30363d;
  --border-secondary: #21262d;
  --border-accent: #58a6ff;
  
  /* Тени */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 20px rgba(88,166,255,0.15);
  
  /* Радиусы */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  
  /* Шрифты */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Размеры */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;
}
```

### Типы узлов (цветовые коды)
```css
--node-person: #58a6ff;      /* Синий — люди */
--node-email: #3fb950;       /* Зелёный — email */
--node-phone: #d29922;       /* Жёлтый — телефоны */
--node-domain: #bc8cff;      /* Фиолетовый — домены */
--node-ip: #f85149;          /* Красный — IP */
--node-username: #39d2c0;    /* Бирюзовый — юзернеймы */
--node-company: #8b949e;     /* Серый — компании */
--node-organization: #8b949e;
--node-location: #d2a8ff;    /* Светло-фиолетовый — локации */
--node-document: #79c0ff;    /* Голубой — документы */
```

### Компоненты
- **Карточка**: `bg-secondary`, `border-primary`, `radius-lg`, `shadow-sm`
- **Кнопка primary**: `bg accent-blue`, `text white`, `radius-md`
- **Кнопка secondary**: `bg transparent`, `border border-primary`, `text secondary`
- **Панель**: `bg-secondary`, `border-bottom`, `padding 12px 16px`
- **Инпут**: `bg-tertiary`, `border border-primary`, `radius-md`, `text primary`
- **Бейдж**: `bg accent-{color}20`, `text accent-{color}`, `radius-full`

---

## План редизайна

### Фаза 1: Дизайн-система (spec-002-design-system)
- [ ] Создать `platform/src/shared/styles/tokens.css` — CSS-переменные
- [ ] Создать `platform/src/shared/styles/components.css` — базовые компоненты
- [ ] Создать `platform/src/shared/styles/utilities.css` — утилиты
- [ ] Обновить `osint-graph.css` — привести к единой системе

### Фаза 2: UiFlowsintTab редизайн (spec-002-flowsint-redesign)
- [ ] Переписать заголовок — "Graph Investigation" или "OSINT Graph"
- [ ] Убрать glass-morphism, перейти на тёмную тему
- [ ] Обновить InvestigationSidebar — иконки SVG, структура дерева
- [ ] Обновить GraphCanvas — чистый тулбар, минималистичный
- [ ] Обновить NodeInspector — таблица свойств как в Maltego
- [ ] Обновить EnricherCatalog — карточки с иконками
- [ ] Обновить EventLog — моноширинный, терминальный стиль
- [ ] Обновить TypePalette — цветные точки по типам
- [ ] Обновить TdaLayer — чистая панель результатов

### Фаза 3: PipelineTab редизайн (spec-002-pipeline-redesign)
- [ ] Разбить на подкомпоненты:
  - `PipelineList.vue` — список конвейеров
  - `PipelineEditor.vue` — редактор с stepper
  - `PipelineExecutions.vue` — история запусков
  - `PipelineTemplates.vue` — шаблоны
- [ ] Убрать хардкод — подключить к `usePipelineTab.ts`
- [ ] Создать PipelineCard.vue — карточка конвейера
- [ ] Создать PipelineStepper.vue — визуализация шагов
- [ ] Создать RunCard.vue — карточка запуска
- [ ] Создать PipelineStats.vue — статистика в шапке

### Фаза 4: Интеграция и тестирование
- [ ] Проверить все переходы между табами
- [ ] Проверить responsive на 3 breakpoints
- [ ] Проверить доступность (keyboard navigation, ARIA)
- [ ] Проверить производительность (не должно быть регрессий)

---

## Сохраняемый функционал

### UiFlowsintTab — ВСЁ сохраняется:
- InvestigationSidebar (создание/выбор расследований и графов)
- GraphCanvas (VueFlow, перетаскивание, зум, миникарта)
- TDA Layer (3D-визуализация, статистика)
- NodeInspector (свойства узла, удаление)
- TypePalette (создание узлов по типам)
- EnricherCatalog (запуск энричеров на выбранные узлы)
- EventLog (SSE-стрим событий)
- TheBigBrother (обогащение по username)
- Add Edge (режим создания связей)
- TDA Button (переключение слоя)
- Quick Toolbar (TDA, Refresh, FitView, Fullscreen)
- Статистика графа (узлы, связи, плотность, компоненты)

### PipelineTab — ВСЁ сохраняется:
- Список конвейеров (CRUD)
- Редактор (имя, описание, триггеры, шаги)
- История запусков (фильтры, повтор, логи)
- Шаблоны (4 готовых шаблона)
- Модули (11 модулей: Google, Social, Threat Intel, TDA, и т.д.)
- Параметры модулей (динамические формы)

---

## Файлы для изменения

### Новые файлы:
```
platform/src/shared/styles/tokens.css
platform/src/shared/styles/components.css
platform/src/shared/styles/utilities.css
platform/src/pages/osint/tabs/flowsint/
  ├── index.vue                    (главный компонент)
  ├── InvestigationSidebar.vue     (боковая панель)
  ├── GraphWorkspace.vue           (центральная область)
  ├── RightPanel.vue               (правая панель: inspector/palette/catalog/log)
  └── QuickToolbar.vue             (нижний тулбар)
platform/src/pages/osint/tabs/pipeline/
  ├── index.vue                    (главный компонент)
  ├── PipelineList.vue             (список)
  ├── PipelineEditor.vue           (редактор)
  ├── PipelineExecutions.vue       (история)
  ├── PipelineTemplates.vue        (шаблоны)
  ├── PipelineCard.vue             (карточка конвейера)
  ├── PipelineStepper.vue          (шаги)
  └── RunCard.vue                  (карточка запуска)
```

### Изменяемые файлы:
```
platform/src/shared/styles/osint-graph.css  (обновить к tokens)
platform/src/pages/osint/index.vue          (обновить стили шапки)
platform/src/widgets/graph-canvas/index.vue (обновить тулбар)
```

### Удаляемые файлы:
```
platform/src/pages/osint/tabs/UiFlowsintTab.vue  (заменяется на flowsint/)
platform/src/pages/osint/tabs/PipelineTab.vue    (заменяется на pipeline/)
```
