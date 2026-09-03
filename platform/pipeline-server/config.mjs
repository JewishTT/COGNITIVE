// pipeline-server/config.mjs — конфигурация пайплайна 0-слоя.
//
// Пайплайн — отдельный сервис внутри платформы (не трогает вложенный
// git-репо flowsint). Он собирает «сырьё» по цели, извлекает сущности и
// пишет результат в граф Neo4j через существующий flowsint-api.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

export const config = {
  // Порт пайплайн-сервиса (проксируется браузером как /pipeline).
  port: Number(process.env.PIPELINE_PORT || 5181),

  // Где искать/создавать python-окружение с инструментами сбора.
  // venv действительно только когда python + pip доступны.
  venvDir: process.env.PIPELINE_VENV || path.join(__dirname, '.pipeline-venv'),
  pipTimeoutMs: 1000 * 60 * 10,

  // Conda-окружения для инструментов, требующих специфических зависимостей.
  conda: {
    cognitive: process.env.CONDA_COGNITIVE || 'C:\\Users\\tim\\miniconda3\\envs\\cognitive',
    harvester: process.env.CONDA_HARVESTER || 'C:\\Users\\tim\\miniconda3\\envs\\harvester',
  },

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
    url: process.env.SEARXNG_URL || 'http://localhost:8888',
    json: process.env.SEARXNG_JSON || process.env.SEARXNG_URL || 'http://localhost:8888',
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

  // Cerebras LLM (GPT-OSS-120B via wafer-scale inference).
  cerebras: {
    apiKey: process.env.CEREBRAS_API_KEY || '',
    model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
    baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
  },

  // Groq LLM (fast OSS inference, OpenAI-compatible API).
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    proxy: process.env.GROQ_PROXY || '',
  },

  // OpenRouter (multi-model gateway).
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'z-ai/glm-5.2:free',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    proxy: process.env.OPENROUTER_PROXY || '',
  },

  // OpenCode Zen (opencode.ai - OpenAI-compatible, works from RU, big-pickle model).
  opencode: {
    apiKey: process.env.OPENCODE_API_KEY || '',
    model: process.env.OPENCODE_MODEL || 'big-pickle',
    baseUrl: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1',
  },

  // Neo4j direct access for management endpoints.
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
}
