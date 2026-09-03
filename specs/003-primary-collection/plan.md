# План: Первичный сбор данных и извлечение сущностей

## Контекст

Пайплайн 0-слоя уже имеет 3-стадийную архитектуру (COLLECT → EXTRACT → STORE) с интеграцией BBOT, theHarvester, Sherlock, Maigret, snscrape, TGSpyder, SearXNG и краулера. Извлечение работает через regex + spaCy NER + exiftool. Все данные пишутся в Neo4j.

**Проблема**: Большинство инструментов не установлены (BBOT, theHarvester, spaCy, maigret, snscrape). Краулер не использует Playwright для JS-сайтов. Нет SearXNG инстанса. Отсутствуют крипто-сущности и нормальные никнеймы.

## Цель

Полностью-functional пайплайн первичного сбора с реальными инструментами, играющий в граф.

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    ПАЙПЛАЙН 0-СЛОЯ                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │  BBOT    │───▶│ theHarv. │───▶│ Sherlock │───▶│ Maigret  │ │
│  │ (DNS,    │    │ (Email,  │    │ (Nik     │    │ (Nik     │ │
│  │  Ports)  │    │  Subdom) │    │  Search) │    │  Search) │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│       │                                                     │  │
│       ▼                                                     ▼  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ snscrape │    │ TGSpyder │    │ SearXNG  │    │ Crawler  │ │
│  │ (Twitter)│    │(Telegram)│    │(Meta-    │    │ (Fetch + │ │
│  │          │    │          │    │ Search)  │    │ Playwright│ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                     │         │
│                                                     ▼         │
│                                              ┌──────────┐     │
│                                              │ Extract  │     │
│                                              │ (Regex + │     │
│                                              │  spaCy + │     │
│                                              │  exif)   │     │
│                                              └──────────┘     │
│                                                     │         │
│                                                     ▼         │
│                                              ┌──────────┐     │
│                                              │  Neo4j   │     │
│                                              │  Graph   │     │
│                                              └──────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Задачи

### Фаза 1: Установка инструментов (T051-T056)

- [ ] T051: Установить BBOT в venv (`pip install bbot`)
- [ ] T052: Установить theHarvester (`pip install theharvester`)
- [ ] T053: Установить spaCy + модель (`pip install spacy && python -m spacy download en_core_web_lg`)
- [ ] T054: Установить Maigret (`pip install maigret`)
- [ ] T055: Установить snscrape (`pip install snscrape`)
- [ ] T056: Проверить все детекции в tools.mjs

### Фаза 2: Улучшение краулера (T057-T059)

- [ ] T057: Добавить Playwright Stealth в краулер для JS-сайтов
- [ ] T058: Реализовать ротацию User-Agent и прокси
- [ ] T059: Добавить повторные попытки (retry) при ошибках

### Фаза 3: Расширение извлечения (T060-T063)

- [ ] T060: Добавить извлечение крипто-адресов (BTC, ETH) через regex
- [ ] T061: Улучшить извлечение никнеймов из URL профилей
- [ ] T062: Добавить валидацию email через DNS (MX-записи)
- [ ] T063: Добавить извлечение координат из текста (lat/lon)

### Фаза 4: Интеграция SearXNG (T064-T065)

- [ ] T064: Развернуть SearXNG через Docker Compose
- [ ] T065: Настроить JSON API в SearXNG и протестировать

### Фаза 5: Дедупликация и качество (T066-T067)

- [ ] T066: Реализовать кросс-тульную дедупликацию сущностей
- [ ] T067: Добавить confidence scoring для каждой сущности

### Фаза 6: Тестирование (T068-T070)

- [ ] T068: Прогнать тестовый запрос через весь пайплайн
- [ ] T069: Проверить запись в Neo4j и построение графа
- [ ] T070: Проверить фронтенд (отображение результатов)

## Детали реализации

### T051: Установка BBOT

```bash
# Создаем venv если нет
python -m venv .venv
.venv\Scripts\activate

# Устанавливаем BBOT
pip install bbot

# Проверяем
bbot --version
```

### T057: Playwright Stealth в краулер

Добавить в `collect.mjs`:

```javascript
// Новый ранер для JS-сайтов
async crawlWithPlaywright(target, urls, onEvent, signal) {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
  })
  
  for (const url of urls) {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    const content = await page.content()
    // Обработать контент...
  }
  
  await browser.close()
}
```

### T060: Крипто-адреса

Добавить в `extract.mjs`:

```javascript
const BTC = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g
const ETH = /\b0x[a-fA-F0-9]{40}\b/g

export function extractCrypto(text) {
  return {
    btc: [...new Set(String(text).matchAll(BTC).map(m => m[0]))],
    eth: [...new Set(String(text).matchAll(ETH).map(m => m[0]))]
  }
}
```

### T064: SearXNG Docker

```yaml
# docker-compose.searxng.yml
version: '3'
services:
  searxng:
    image: searxng/searxng:latest
    ports:
      - "8080:8080"
    volumes:
      - ./searxng:/etc/searxng
    environment:
      - SEARXNG_BASE_URL=http://localhost:8080
```

## Критерии приемки

1. Все 6 инструментов сбора работают (BBOT, theHarvester, Sherlock, Maigret, snscrape, TGSpyder)
2. Playwright Stealth краулер обходит JS-сайты
3. Regex извлекает email, телефоны, IP, крипто-адреса
4. spaCy NER работает для русского и английского
5. SearXNG доступен на localhost:8080
6. Граф в Neo4j содержит все типы сущностей с правильными связями
7. Фронтенд отображает результаты пайплайна

## Риски

- BBOT может требовать Python 3.10+ (у нас 3.11 - ОК)
- spaCy модели занимают ~500MB (en_core_web_lg)
- SearXNG может конфликтовать с другими сервисами на порту 8080
- Playwright требует установки браузеров (~400MB)

## Следующие шаги

После этой фазы:
1. Интегрировать TDA-анализ с обогащенным графом
2. Добавить автоматическое обогащение через enricher'ы
3. Реализовать визуализацию графа на фронтенде
