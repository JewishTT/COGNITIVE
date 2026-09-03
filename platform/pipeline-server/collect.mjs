// pipeline-server/collect.mjs — этап «Сбор» 0-слоя.
//
// По цели (username/email/domain/phone/ip) запускает доступные тулы сбора и
// возвращает «сырьё»: найденные ники/профили/email/телефоны/ссылки/тексты.
//
// Принцип: только реальные инструменты. Если тул установлен — запускаем его
// и парсим вывод; если нет/не запустился/таймаут — этап честно пустой
// (ничего не подставляем). Данные появляются после установки инструмента
// (кнопка «Установить» → pip в venv).

import { tools, allToolStatus, ensureVenv, pythonBin } from './tools.mjs'
import { run, pyRun, which, venvPython, pyHas } from './runner.mjs'
import { config } from './config.mjs'
import fs from 'node:fs'
import path from 'node:path'

function condaPython(env) { return path.join(config.conda[env], 'python.exe') }
function condaBin(env, name) { return path.join(config.conda[env], 'Scripts', name) }

// Приводит единственное число kind записи к plural-бакету аккумулятора.
const KIND_BUCKET = { profile: 'profiles', email: 'emails', phone: 'phones', host: 'hosts', link: 'links', text: 'texts', file: 'files' }

// Запуск CLI-инструмента: предпочитаем глобальный бинарь на PATH, затем
// venv-обёртку (.bat/.cmd/.exe в Scripts, напр. bbot.bat), иначе
// python -m <module> (для тулов с __main__.py в venv).
function runCli(globalCmd, moduleName, args, opts) {
  // 1. Глобальный бинарь на PATH
  const sys = which(globalCmd)
  if (sys) return run([sys, ...args], opts)
  // 2. Venv wrapper (bbot.bat, sherlock.bat, tgspyder.exe и т.п.)
  const py = venvPython() || pythonBin()
  if (py) {
    const dir = path.dirname(py)
    const candidates = process.platform === 'win32'
      ? [`${globalCmd}.bat`, `${globalCmd}.cmd`, `${globalCmd}.exe`, globalCmd]
      : [globalCmd]
    for (const f of candidates) {
      try { if (fs.statSync(path.join(dir, f)).isFile()) return run([path.join(dir, f), ...args], opts) } catch {}
    }
  }
  // 3. Fallback: python -m
  if (py) return run([py, '-m', moduleName, ...args], opts)
  return run([globalCmd, ...args], opts)
}

// Пустой результат для честного «ничего не найдено»: инструмент установлен,
// но не отработал (таймаут/ошибка) — НЕ подсовываем выдуманные данные.
function empty(tool, target, type) {
  return { tool, target, type, available: false, results: [] }
}

// Обёртки запуска реальных CLI (возвращают {available, results}).
const runner = {
  async theharvester(target, type, onEvent, signal) {
    if (!tools.theharvester.detect()) return null
    onEvent && onEvent('info', 'theHarvester', `Запуск theHarvester для ${target}`)
    const harvesterBin = condaBin('harvester', 'theHarvester.exe')
    const res = await run([harvesterBin, '-d', target, '-b', 'crtsh,duckduckgo,hackertarget', '-l', '30'], { timeout: 60000, signal })
    if (!res.ok) return empty('theharvester', target, type)
    const emails = new Set()
    const hosts = new Set()
    for (const line of res.out.split(/\r?\n/)) {
      const em = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)
      if (em) em.forEach((e) => emails.add(e))
      if (/^[\w.-]+\.[a-z]{2,}$/i.test(line.trim()) && !line.includes('@')) hosts.add(line.trim())
    }
    return { tool: 'theharvester', target, type, available: true, results: [
      ...[...emails].map((email) => ({ kind: 'email', email, source: 'theharvester', confidence: 0.7 })),
      ...[...hosts].map((host) => ({ kind: 'host', host, source: 'theharvester', confidence: 0.6 })),
    ]}
  },

  async sherlock(target, type, onEvent, signal) {
    if (!tools.sherlock.detect()) return null
    onEvent && onEvent('info', 'sherlock', `Sherlock по нику ${target}`)
    // --timeout ограничивает ожидание ответа каждого сайта, чтобы по-настоящему
    // отработать за разумное время (иначе упирается в rate-limit/мёртвые хосты)
    const res = await runCli('sherlock', 'sherlock', [target, '--print-found', '--no-color', '--timeout', '8'], { timeout: 150000, signal })
    if (!res.ok) return empty('sherlock', target, type)
    const results = []
    for (const line of res.out.split(/\r?\n/)) {
      const m = line.match(/\[[+\-]\]\s+(.+?):\s+(https?:\/\/\S+)/i)
      if (m) results.push({ kind: 'profile', platform: m[1].trim(), handle: target, url: m[2].trim(), source: 'sherlock', confidence: 0.8 })
    }
    return { tool: 'sherlock', target, type, available: true, results }
  },

  async maigret(target, type, onEvent, signal) {
    if (!tools.maigret.detect()) return null
    onEvent && onEvent('info', 'maigret', `Maigret по нику ${target}`)
    const res = await runCli('maigret', 'maigret', [target, '--no-progressbar'], { timeout: 90000, signal })
    if (!res.ok) return empty('maigret', target, type)
    const results = []
    for (const line of res.out.split(/\r?\n/)) {
      const m = line.match(/\[(Info|Found)\]|(\w+)\s+:\s+(https?:\/\/\S+)/i)
      // maigret печатает имя сайта и URL; для простоты берём строки с http
      const u = line.match(/(https?:\/\/[^\s]+)/)
      if (u) results.push({ kind: 'profile', platform: (line.split(':')[0] || '').trim(), handle: target, url: u[1].replace(/\)?$/, ''), source: 'maigret', confidence: 0.75 })
    }
    return { tool: 'maigret', target, type, available: true, results }
  },

  async snscrape(target, type, onEvent, signal) {
    if (!tools.snscrape.detect()) return null
    onEvent && onEvent('info', 'snscrape', `snscrape twitter-user ${target}`)
    const res = await pyRun(['-m', 'snscrape', 'twitter-user', target, '--jsonl'], { timeout: 45000, signal })
    if (!res.ok) return empty('snscrape', target, type)
    const results = []
    for (const line of res.out.split(/\r?\n/)) {
      if (!line.trim() || !line.startsWith('{')) continue
      try {
        const j = JSON.parse(line)
        results.push({ kind: 'text', platform: 'twitter', handle: target, text: (j.content || '').slice(0, 500), url: j.url, date: j.date, source: 'snscrape', confidence: 0.85 })
      } catch {}
    }
    return { tool: 'snscrape', target, type, available: true, results }
  },

  async bbot(target, type, onEvent, signal) {
    if (!tools.bbot.detect()) return null
    onEvent && onEvent('info', 'bbot', `BBOT по цели ${target}`)
    const mods = bbotModules(type)
    const bbotBin = condaBin('cognitive', 'bbot.exe')
    const res = await run([bbotBin, '-t', target, '-m', mods, '-y', '--json', '--no-deps', '--no-color'], { timeout: 120000, signal })
    if (!res.ok) return empty('bbot', target, type)
    const hosts = new Set(), emails = new Set(), urls = new Set(), socials = []
    for (const line of res.out.split(/\r?\n/)) {
      if (!line.startsWith('{')) continue
      try {
        const j = JSON.parse(line)
        const d = j.data || {}
        const kind = j.type || ''
        if (kind.includes('DNS_NAME') || kind === 'MUTATION') { if (d.host || d.dns_name) hosts.add(d.host || d.dns_name) }
        if (kind === 'OPEN_TCP_PORT') { if (d.host) hosts.add(d.host) }
        if (kind === 'EMAIL_ADDRESS') { if (d.emails) d.emails.forEach((e) => emails.add(e)); if (d.email) emails.add(d.email) }
        if (kind === 'URL_UNVERIFIED' || kind === 'URL' || kind === 'HTTP_RESPONSE') { if (d.url) urls.add(d.url) }
        if (kind === 'SOCIAL' || kind === 'USERNAME') {
          const u = d.url || d.profile_url
          if (u && d.username) socials.push({ kind: 'profile', platform: d.platform || 'web', handle: d.username, url: u, source: 'bbot', confidence: 0.8 })
        }
      } catch {}
    }
    const results = []
    results.push(...[...hosts].slice(0, 60).map((host) => ({ kind: 'host', host, source: 'bbot', confidence: 0.8 })))
    results.push(...[...emails].slice(0, 40).map((email) => ({ kind: 'email', email, source: 'bbot', confidence: 0.75 })))
    results.push(...[...urls].slice(0, 40).map((url) => ({ kind: 'link', url, source: 'bbot', confidence: 0.7 })))
    results.push(...socials.slice(0, 30))
    return { tool: 'bbot', target, type, available: true, results }
  },

  async searxng(target, type, onEvent, signal) {
    const url = config.searxng.json || config.searxng.url
    if (!url) return null
    onEvent && onEvent('info', 'searxng', `SearXNG: поиск «${target}»`)
    try {
      const u = new URL(url)
      u.searchParams.set('q', target)
      u.searchParams.set('format', 'json')
      const res = await fetch(u.toString(), { signal: signal && typeof signal.aborted === 'boolean' ? signal : undefined })
      if (!res.ok) return empty('searxng', target, type)
      const j = await res.json()
      const results = (j.results || []).slice(0, 20).map((r) => ({
        kind: 'link', url: r.url, title: (r.title || '').slice(0, 200), description: (r.content || '').slice(0, 300), source: 'searxng', confidence: 0.7,
      }))
      return { tool: 'searxng', target, type, available: true, results }
    } catch {
      return empty('searxng', target, type)
    }
  },

  // TGSpyder — Telegram-нога 0-слоя (Darksight-Analytics/tgspyder, CLI поверх
  // Telethon). Для username-типа делаем lookup юзера: tgspyder --user @handle.
  // Интерактивная настройка (первые вход: api_id/api_hash + код) живёт в
  // ~/.tgspyder.conf и в пайплайне недоступна — если сессия не авторизована,
  // lookup честно завершается пустым этапом после таймаута.
  async tgspyder(target, type, onEvent, signal) {
    if (!tools.tgspyder.detect()) return null
    const bin = tgspyderBin()
    if (!bin) return null
    onEvent && onEvent('info', 'tgspyder', `TGSpyder: lookup @${target} в Telegram`)
    const handle = String(target || '').replace(/^@/, '')
    const res = await run([bin, '--user', `@${handle}`], { timeout: 45000, signal })
    const out = (res && res.out) || ''
    const line = (re) => { const m = out.match(re); return m ? m[1].trim() : null }
    const username = line(/Username:\s*@?([\w][\w\d_]{2,})/i)
    const userId = line(/ID:\s*(\d+)/)
    const name = line(/Name:\s*(.+?)(?:\r?\n|$)/i)
    const phone = line(/Phone:\s*([+\d][\d\s().-]{5,})/)
    const profileUrl = line(/Profile:\s*(https?:\/\/\S+)/i)
    if (!/User Lookup Result|Username:\s*@|ID:\s*\d/.test(out) || !(username || userId)) {
      return { tool: 'tgspyder', target, type, available: true, results: [] }
    }
    const clean = username || handle
    const results = [{ kind: 'profile', platform: 'telegram', handle: clean, url: profileUrl || `https://t.me/${clean}`, source: 'tgspyder', confidence: 0.75 }]
    const hasPhone = phone && !/hidden|none/i.test(phone)
    if (hasPhone) results.push({ kind: 'phone', phone, source: 'tgspyder', confidence: 0.6 })
    const summary = `TGSpyder lookup @${clean}` +
      (name && !/hidden|none/i.test(name) ? ` · ${name}` : '') +
      (userId ? ` · id ${userId}` : '') +
      (hasPhone ? ` · phone ${phone}` : '')
    results.push({ kind: 'text', platform: 'telegram', handle: clean, text: summary, url: `https://t.me/${clean}`, source: 'tgspyder', confidence: 0.7 })
    return { tool: 'tgspyder', target, type, available: true, results }
  },

  // Краулер — роль Scrapy/Playwright в 0-слое. Обходит ссылки, собранные
  // предыдущими тулами (links/hosts/profiles/texts), снимает текст страниц для
  // regex+spaCy и качает несколько изображений под exiftool.
  // При наличии Playwright использует headless Chromium с anti-bot stealth,
  // иначе откатывается на чистый fetch + HTML-стриппинг.
  async crawl(target, type, onEvent, signal, acc) {
    const urls = []
    const seen = new Set()
    const push = (u) => {
      if (u && /^https?:\/\//i.test(String(u)) && !seen.has(String(u))) {
        seen.add(String(u))
        urls.push(String(u))
      }
    }
    for (const l of (acc.links || [])) push(l.url)
    for (const p of (acc.profiles || [])) push(p.url)
    for (const h of (acc.hosts || [])) push(`http://${h.host}`)
    for (const t of (acc.texts || [])) push(t.url)

    if (!urls.length) {
      onEvent && onEvent('info', 'crawler', 'Нет ссылок для обхода — этап пропущен')
      return { tool: 'crawler', target, type, available: true, results: [] }
    }

    const picked = urls.slice(0, config.crawl.maxPages)
    onEvent && onEvent('info', 'crawler', `Обход ${picked.length} страниц (макс. ${config.crawl.maxPages})`)

    // Определяем доступность Playwright с stealth-плагинами.
    const hasPlaywright = pyHas('playwright')
    const hasStealth = hasPlaywright && pyHas('playwright_stealth')

    let results = []
    let files = []

    if (hasPlaywright) {
      onEvent && onEvent('info', 'crawler', `Playwright доступен (${hasStealth ? 'stealth' : 'plain'}) — запуск headless Chromium`)
      try {
        const pwResult = await crawlWithPlaywright(picked, config.crawl, onEvent, signal)
        results = pwResult.results
        files = pwResult.files
      } catch (e) {
        onEvent && onEvent('warn', 'crawler', `Playwright упал: ${e.message} — откат на fetch`)
        const fb = await crawlWithFetch(picked, config.crawl, onEvent, signal)
        results = fb.results
        files = fb.files
      }
    } else {
      onEvent && onEvent('info', 'crawler', 'Playwright не установлен — fallback на fetch')
      const fb = await crawlWithFetch(picked, config.crawl, onEvent, signal)
      results = fb.results
      files = fb.files
    }

    results.push(...files)
    onEvent && onEvent('info', 'crawler', `Собрано: ${results.length} записей, файлов на EXIF: ${files.length}`)
    return { tool: 'crawler', target, type, available: true, results }
  },
}

// Адаптивная карта модулей BBOT под тип цели (масс-оркестратор 0-слоя).
// Имена сверены с `bbot -l` (BBOT 3.0.2, тип=scan, 116 модулей): все существуют.
// Без API-ключевых модулей (hunterio/dehashed/censys/shodan) и без активного
// брутфорса (dnsbrute) — дефолт должен быть лёгким и пассивным.
function bbotModules(type) {
  const t = (type || '').toLowerCase()
  if (t === 'domain') return 'crt,crt_db,subdomaincenter,rapiddns,otx,hackertarget,dnsdumpster,dnscaa,dnscommonsrv,sslcert,asn,emailformat,skymem,pgp'
  if (t === 'ip') return 'portscan,sslcert,asn'
  if (t === 'email') return 'emailformat,skymem,pgp,sslcert,asn'
  return 'social'
}

// Диспетчер: BBOT выступает масс-оркестратором 0-слоя (когда установлен) —
// он первый с адаптивной картой модулей под тип цели; специфичные тулы
// (sherlock/maigret/snscrape/theHarvester) дополняют его профилями/контекстом.
function planForType(type) {
  const t = (type || 'username').toLowerCase()
  const bbotUp = Boolean(tools.bbot && tools.bbot.detect())
  const plan = []
  if (t === 'username') {
    if (bbotUp) plan.push(['bbot', 'profiles'])
    plan.push(['sherlock', 'profiles'], ['maigret', 'profiles'], ['snscrape', 'texts'], ['tgspyder', 'profiles'])
  } else if (t === 'domain') {
    if (bbotUp) plan.push(['bbot', 'hosts'])
    plan.push(['theharvester', 'emails'], ['searxng', 'links'])
  } else if (t === 'email') {
    if (bbotUp) plan.push(['bbot', 'hosts'])
    plan.push(['theharvester', 'emails'], ['searxng', 'links'])
  } else if (t === 'phone' || t === 'ip') {
    if (bbotUp) plan.push(['bbot', 'hosts'])
    plan.push(['searxng', 'links'])
  } else {
    if (bbotUp) plan.push(['bbot', 'profiles'])
    plan.push(['searxng', 'links'], ['sherlock', 'profiles'])
  }
  // Роль Scrapy/Playwright в 0-слое: обход найденных ссылок/профилей — текст
  // уходит в regex+spaCy, изображения — в exiftool. Всегда последним шагом.
  plan.push(['crawl', 'texts'])
  return plan
}

/**
 * Основной вход этапа сбора.
 * @returns {Promise<{stages: Array<{tool,label,available,count,results}>, all:{profiles,emails,phones,hosts,links,texts}}>}
 */
export async function collectForTarget(target, type, onEvent, signal) {
  onEvent && onEvent('stage', 'collect', 'Этап СБОР: поиск источников')
  const plan = planForType(type)
  const stages = []
  const acc = { profiles: [], emails: [], phones: [], hosts: [], links: [], texts: [], files: [] }

  for (const [toolName, kind] of plan) {
    if (signal && signal.aborted) { onEvent && onEvent('warn', 'collect', 'Сбор прерван пользователем'); break }
    onEvent && onEvent('info', 'collect', `→ ${toolName} (${kind})`)
    let out = null
    try {
      // acc передаётся ранерам, которым нужен контекст предыдущих шагов
      // (crawler обходит найденные ссылки/профили).
      out = await runner[toolName](target, type, onEvent, signal, acc)
    } catch (e) {
      out = null
    }
    if (!out) {
      // Инструмент недоступен/не установлен — честно помечаем этап пустым,
      // НЕ подставляя выдуманных данных. Реальный результат появится,
      // как только тул будет установлен (кнопка «Установить»).
      out = empty(toolName, target, type)
      onEvent && onEvent('warn', toolName, `инструмент недоступен · этап пропущен`)
    }
    for (const r of out.results) {
      // Нормализуем kind в plural-бакет: инструменты отдают kind в единственном
      // числе (profile/email/phone/host/link/text).
      const bucket = KIND_BUCKET[r.kind] || r.kind
      if (acc[bucket]) acc[bucket].push(r)
    }
    stages.push({ tool: toolName, label: toolLabel(toolName), available: out.available, count: out.results.length, results: out.results })
  }

  onEvent && onEvent('stage_done', 'collect', `Сбор завершён: ${stages.length} источников`)
  return { stages, all: acc }
}

function toolLabel(name) {
  return (tools[name] && tools[name].label) || name
}

/**
 * Прямой запуск краулера по списку ссылок (без остальных этапов сбора).
 * Используется smoke-тестами и для повторного обхода уже собранных URL.
 * @returns {Promise<Array>} результаты краулера (text/email/phone/file).
 */
export async function crawlForUrls(urls, onEvent, signal) {
  const seeded = { links: (urls || []).map((url) => ({ url, source: 'seed' })), profiles: [], hosts: [], texts: [] }
  const out = await runner.crawl('seed', 'link', onEvent || (() => {}), signal, seeded)
  return out.results
}

// Ищет исполняемый бинарь TGSpyder: глобальный PATH или venv Scripts
// (пакет ставится из GitHub как console-script, без __main__.py, поэтому
// python -m tgspyder не работает).
function tgspyderBin() {
  const sys = which('tgspyder')
  if (sys) return sys
  const py = venvPython()
  if (!py) return null
  const dir = path.dirname(py)
  for (const n of ['tgspyder.exe', 'tgspyder.cmd', 'tgspyder.bat', 'tgspyder']) {
    const p = path.join(dir, n)
    try {
      if (fs.statSync(p).isFile()) return p
    } catch {}
  }
  return null
}
// ---- Хелперы краулера (роль Scrapy/Playwright в 0-слое) --------------------

// Скачивает страницу как текст (лимит каптуры, таймаут, проброс отмены).
async function fetchPage(url, signal) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), config.crawl.pageTimeoutMs)
  const onAbort = () => { try { ac.abort() } catch {} }
  if (signal) signal.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': config.crawl.ua, 'accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > config.crawl.maxBytes) return null
    return new TextDecoder('utf-8').decode(buf)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

// Примитивный HTML → текст: снимает скрипты/стили/разметку, декодирует сущности.
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Вытаскивает абсолютные URL изображений из HTML страницы.
function extractImages(html, baseUrl) {
  const out = []
  const re = /<img[^>]+src=["']([^"'\s>]+)["']/gi
  let m = null
  while ((m = re.exec(html)) && out.length < 8) {
    try { out.push(new URL(m[1], baseUrl).href) } catch {}
  }
  return out
}

// Скачивает изображение в workDir/images/ для последующего exiftool-анализа.
async function downloadImage(url, signal) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), config.crawl.pageTimeoutMs)
  const onAbort = () => { try { ac.abort() } catch {} }
  if (signal) signal.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': config.crawl.ua },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length || buf.length > config.crawl.maxBytes) return null
    const type = (res.headers.get('content-type') || '').toLowerCase()
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg'
    await fs.promises.mkdir(config.crawl.imagesDir, { recursive: true })
    const name = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${ext}`
    const filePath = path.join(config.crawl.imagesDir, name)
    await fs.promises.writeFile(filePath, buf)
    return { path: filePath }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

// ---- Playwright crawler --------------------------------------------------

// Краулер на базе Playwright: headless Chromium с anti-bot stealth (опционально).
// Запускает Python-скрипт как subprocess — возвращает JSON с HTML каждой
// страницы, mailto/tel-ссылками и размером контента.
async function crawlWithPlaywright(urls, cfg, onEvent, signal) {
  const hasStealth = pyHas('playwright_stealth')
  const script = `
import json, sys, asyncio

async def crawl(urls, cfg, has_stealth):
    from playwright.async_api import async_playwright

    results = []
    files = []

    async with async_playwright() as pw:
        launch_args = [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ]
        browser = await pw.chromium.launch(
            headless=True,
            args=launch_args,
        )
        context = await browser.new_context(
            user_agent=cfg.get('ua', ''),
            viewport={"width": 1920, "height": 1080},
            java_script_enabled=True,
            bypass_csp=True,
        )

        # Stealth: скрываем признаки автоматизации, если плагин доступен
        if has_stealth:
            try:
                from playwright_stealth import stealth_async
            except ImportError:
                stealth_async = None
        else:
            stealth_async = None

        for url in urls:
            try:
                page = await context.new_page()
                if stealth_async:
                    await stealth_async(page)

                resp = await page.goto(
                    url,
                    wait_until='networkidle',
                    timeout=cfg.get('pageTimeoutMs', 8000),
                )
                if not resp or not resp.ok:
                    await page.close()
                    continue

                # Подождать额外 стабилизации SPA (если есть动态 контент)
                try:
                    await page.wait_for_load_state('networkidle', timeout=3000)
                except Exception:
                    pass

                html = await page.content()

                # Mailto / tel ссылки
                mailtos = []
                for m in __import__('re').findall(r'mailto:([^"\\'\\s>]+)', html):
                    e = m.split('?')[0].split('#')[0].strip().lower()
                    if __import__('re').match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$', e):
                        mailtos.append(e)

                tels = []
                for m in __import__('re').findall(r'tel:([+\\d][\\d\\s().-]{5,})', html):
                    tels.append(m.strip())

                # Изображения
                imgs = []
                for m in __import__('re').findall(r'<img[^>]+src=["\\']([^"\\'\\s>]+)["\\']', html):
                    try:
                        from urllib.parse import urljoin
                        imgs.append(urljoin(url, m))
                    except Exception:
                        pass

                results.append({
                    'url': url,
                    'html': html,
                    'mailtos': mailtos,
                    'tels': tels,
                    'images': imgs[:8],
                })

                await page.close()
            except Exception as e:
                try:
                    await page.close()
                except Exception:
                    pass

        await browser.close()

    return results, files

urls = json.loads(sys.argv[1])
cfg = json.loads(sys.argv[2])
has_stealth = sys.argv[3] == '1'

results, files = asyncio.run(crawl(urls, cfg, has_stealth))
print(json.dumps({'results': results, 'files': files}))
`

  const py = venvPython() || pythonBin()
  if (!py) throw new Error('No Python available for Playwright')

  const args = [
    py, '-c', script,
    JSON.stringify(urls),
    JSON.stringify({
      ua: cfg.ua,
      pageTimeoutMs: cfg.pageTimeoutMs,
    }),
    hasStealth ? '1' : '0',
  ]

  const res = await run(args, {
    timeout: cfg.pageTimeoutMs * urls.length + 30000,
    signal,
  })

  if (!res.ok) throw new Error(`Playwright script failed: ${res.err}`)

  const parsed = JSON.parse(res.out.trim())
  const out = { results: [], files: [] }

  for (const page of parsed.results) {
    const text = htmlToText(page.html)
    if (text) {
      out.results.push({ kind: 'text', url: page.url, text: text.slice(0, 40000), source: 'crawler/pw', confidence: 0.7 })
    }
    for (const e of (page.mailtos || [])) {
      out.results.push({ kind: 'email', email: e, source: 'crawler/pw', confidence: 0.9 })
    }
    for (const p of (page.tels || [])) {
      out.results.push({ kind: 'phone', phone: p, source: 'crawler/pw', confidence: 0.85 })
    }
    for (const img of (page.images || [])) {
      if (out.files.length >= cfg.maxImages) break
      try {
        const saved = await downloadImage(img, signal)
        if (saved) out.files.push({ kind: 'file', path: saved.path, url: img, source: 'crawler/pw', confidence: 0.5 })
      } catch {}
    }
  }

  return out
}

// ---- fetch-based crawler (fallback) ------------------------------------

// Краулер на чистом fetch: обходит список URL, снимает HTML, парсит
// mailto/tel, качает изображения. Используется когда Playwright недоступен.
async function crawlWithFetch(urls, cfg, onEvent, signal) {
  const results = []
  const files = []
  let idx = 0
  const workers = Math.min(cfg.maxConcurrency, urls.length)
  const worker = async () => {
    while (idx < urls.length) {
      if (signal && signal.aborted) return
      const u = urls[idx++]
      try {
        const html = await fetchPage(u, signal)
        if (!html) continue
        const text = htmlToText(html)
        if (text) results.push({ kind: 'text', url: u, text: text.slice(0, 40000), source: 'crawler/fetch', confidence: 0.6 })
        for (const m of html.matchAll(/mailto:([^"'\\s>]+)/gi)) {
          const e = m[1].replace(/[?#].*$/, '').toLowerCase()
          if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e)) {
            results.push({ kind: 'email', email: e, source: 'crawler/fetch', confidence: 0.9 })
          }
        }
        for (const m of html.matchAll(/tel:([+\\d][\\d\\s().-]{5,})/gi)) {
          results.push({ kind: 'phone', phone: m[1].trim(), source: 'crawler/fetch', confidence: 0.85 })
        }
        for (const img of extractImages(html, u)) {
          if (files.length >= cfg.maxImages) break
          const saved = await downloadImage(img, signal)
          if (saved) files.push({ kind: 'file', path: saved.path, url: img, source: 'crawler/fetch', confidence: 0.5 })
        }
      } catch {
        // страница не ответила — пропускаем
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
  return { results, files }
}
