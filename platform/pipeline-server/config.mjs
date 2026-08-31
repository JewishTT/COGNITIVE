// pipeline-server/config.mjs — конфигурация пайплайна 0-слоя.
//
// Пайплайн — отдельный сервис внутри платформы (не трогает вложенный
// git-репо flowsint). Он собирает «сырьё» по цели, извлекает сущности и
// пишет результат в граф Neo4j через существующий flowsint-api.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  // Порт пайплайн-сервиса (проксируется браузером как /pipeline).
  port: Number(process.env.PIPELINE_PORT || 5181),

  // Где искать/создавать python-окружение с инструментами сбора.
  // venv действительно только когда python + pip доступны.
  venvDir: process.env.PIPELINE_VENV || path.join(__dirname, '.pipeline-venv'),
  pipTimeoutMs: 1000 * 60 * 10,

  // Python-инструменты, которые пытаемся доустановить автоматически.
  // Каждый элемент: скрипт установки/запуска. Для CLI-тулов, которые ставим
  // через pip в venv, храним имя точки входа.
  installable: {
    spacy: { pkg: 'spacy', extra: 'en_core_web_sm', entry: 'python' },
    snscrape: { pkg: 'snscrape', extra: null, entry: 'python' },
    sherlock: { pkg: 'sherlock-project', extra: null, entry: 'python' },
    maigret: { pkg: 'maigret', extra: null, entry: 'python' },
    theharvester: { pkg: 'theHarvester', extra: null, entry: 'python' },
    bbot: { pkg: 'bbot', extra: null, entry: 'bbot' },
    tgspyder: { pkg: 'tgspyder', extra: null, entry: 'python' },
  },

  // Движок Flowsint (запись результата в Neo4j).
  flowsint: {
    base: process.env.FLOWSINT_API || 'http://localhost:5001',
    email: process.env.FLOWSINT_ADMIN_EMAIL || 'admin@ghostseven.io',
    password: process.env.FLOWSINT_ADMIN_PASSWORD || 'Ghost7Admin!2026',
  },

  // Опциональный самохостинг SearXNG (JSON-вывод). Если пусто — метапоиск
  // помечается unavailable и используется in-memory синтезатор ссылок.
  searxng: {
    url: process.env.SEARXNG_URL || '',
    json: process.env.SEARXNG_JSON || process.env.SEARXNG_URL || '',
    format: 'json',
  },

  // Краулер (роль Scrapy/Playwright в 0-слое): обходит найденные ссылки,
  // снимает текст страниц для regex+spaCy и тянет изображения под exiftool.
  crawl: {
    maxPages: Number(process.env.PIPELINE_CRAWL_MAX_PAGES || 12),
    maxConcurrency: Number(process.env.PIPELINE_CRAWL_CONCURRENCY || 4),
    pageTimeoutMs: Number(process.env.PIPELINE_CRAWL_TIMEOUT_MS || 8000),
    maxImages: Number(process.env.PIPELINE_CRAWL_MAX_IMAGES || 4),
    maxBytes: 1_000_000,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GodsEyeView-Pipeline/0.1',
    imagesDir: path.join(path.join(__dirname, '.work'), 'images'),
  },

  // Каталог временной работы (результаты сбора, EXIF-копии и т.д.).
  workDir: path.join(__dirname, '.work'),
}
