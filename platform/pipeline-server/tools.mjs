// pipeline-server/tools.mjs — обнаружение, авто-установка и каталог внешних
// инструментов 0-слоя. Всегда старается работать с реальными тулами; когда
// инструмент недоступен (не установлен, нет python/pip, нет сети для pip) —
// честно помечает его unavailable. Сам пайплайн при этом деградирует на
// синтетические данные (тот же принцип «честной деградации», что и в проекте).

import { run, pyRun, pyHas, venvPython, ensureVenv, pythonBin, which } from './runner.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.mjs'

export * from './runner.mjs'

const { installable, pipTimeoutMs } = config

export { ensureVenv, pythonBin }

export async function installTool(name) {
  const t = tools[name]
  if (!t) return { ok: false, msg: 'неизвестный инструмент' }
  if (t.detect()) return { ok: true, msg: `уже доступен: ${name}` }
  if (!t.install) return { ok: false, msg: 'инструмент не имеет автоустановки' }
  const r = await t.install()
  if (r.ok && !t.detect()) return { ok: false, msg: `${r.msg} (проверка всё ещё не прошла)` }
  return r
}

async function pipInstall(pkg) {
  if (!ensureVenv()) return { ok: false, msg: 'нет python/pip — не могу установить' }
  const py = venvPython() || pythonBin()
  const spec = installable[pkg]?.pkg || pkg
  // Учитываем возможность PEP-668 (externally managed): добавим флаг, но свежий
  // pip обычно ставит в venv без проблем, т.к. venv не является externally managed.
  const res = await run([py, '-m', 'pip', 'install', '--quiet', spec], { timeout: pipTimeoutMs })
  return { ok: res.ok, msg: res.ok ? `установлен ${spec}` : res.err.slice(0, 400) }
}

// Каталог инструментов.
export const tools = {
  bbot: {
    kind: 'collection', label: 'BBOT', group: 'Первичный сбор',
    description: 'Оркестратор пассивного/активного сбора: WHOIS, DNS, поддомены, Shodan.',
    detect() {
      if (which('bbot')) return true
      const py = venvPython()
      return Boolean(py && whichFromPy(py, 'bbot'))
    },
    install() { return pipInstall('bbot') },
  },
  theharvester: {
    kind: 'collection', label: 'theHarvester', group: 'Первичный сбор',
    description: 'Email/поддомены/имена по домену (пассивные источники).',
    detect() { return Boolean(which('theHarvester') || pyHas('theHarvester')) },
    install() { return pipInstall('theharvester') },
  },
  sherlock: {
    kind: 'collection', label: 'Sherlock', group: 'Поиск по нику',
    description: 'Поиск никнейма на сотнях сайтов.',
    detect() { return Boolean(which('sherlock') || pyHas('sherlock_project')) },
    install() { return pipInstall('sherlock-project') },
  },
  maigret: {
    kind: 'collection', label: 'Maigret', group: 'Поиск по нику',
    description: 'Агрегатор профилей по имени пользователя.',
    detect() { return Boolean(which('maigret') || pyHas('maigret')) },
    install() { return pipInstall('maigret') },
  },
  snscrape: {
    kind: 'collection', label: 'snscrape', group: 'Соцсети · Twitter/X',
    description: 'Сбор твитов/пользователей Twitter/X без API.',
    detect() { return Boolean(pyHas('snscrape')) },
    install() { return pipInstall('snscrape') },
  },
  tgspyder: {
    kind: 'collection', label: 'TGSpyder', group: 'Соцсети · Telegram',
    description: 'Сбор данных из Telegram (Telethon): lookup юзера, сообщения, инвайты.',
    detect() { return Boolean(which('tgspyder') || pyHas('tgspyder') || (venvPython() && whichFromPy(venvPython(), 'tgspyder'))) },
    // ВАЖНО: пакета tgspyder нет на PyPI — ставим CLI из GitHub
    // (https://github.com/Darksight-Analytics/tgspyder) как исполняемый пакет.
    async install() {
      if (!ensureVenv()) return { ok: false, msg: 'нет python/pip — не могу установить' }
      const py = venvPython() || pythonBin()
      const srcDir = path.join(config.workDir, '.tgspyder-src')
      const cloned = await run(['git', 'clone', '--depth', '1', 'https://github.com/Darksight-Analytics/tgspyder.git', srcDir], { timeout: pipTimeoutMs })
      if (!cloned.ok) return { ok: false, msg: `git clone tgspyder: ${(cloned.err || cloned.out || '').slice(0, 300)}` }
      const inst = await run([py, '-m', 'pip', 'install', '--quiet', srcDir], { timeout: pipTimeoutMs })
      if (!inst.ok) return { ok: false, msg: `pip install tgspyder: ${inst.err.slice(0, 300)}` }
      return { ok: true, msg: 'TGSpyder установлен из GitHub (требует настройки ~/.tgspyder.conf)' }
    },
  },
  crawler: {
    kind: 'collection', label: 'Краулер', group: 'Веб-краулинг',
    description: 'Обход найденных ссылок: текст страниц → regex+spaCy, изображения → exiftool.',
    detect() { return true },
    install() { return { ok: true, msg: 'встроен' } },
  },
  searxng: {
    kind: 'collection', label: 'SearXNG', group: 'Метапоиск',
    description: 'Свой агрегатор поисковиков без API-ключей.',
    detect() { return Boolean(config.searxng.url || config.searxng.json) },
    install() { return { ok: false, msg: 'SearXNG — отдельный сервис; укажите SEARXNG_URL в .env' } },
  },
  regex: {
    kind: 'extraction', label: 'Regex', group: 'Извлечение',
    description: 'Экстракция структурных сущностей: email, телефон, IP, ники.',
    detect() { return true },
    install() { return { ok: true, msg: 'встроен' } },
  },
  spacy: {
    kind: 'extraction', label: 'spaCy', group: 'Извлечение',
    description: 'NER: люди, организации, геолокации (en_core_web_lg/sm).',
    detect() { return Boolean(pyHas('spacy')) },
    async install() {
      const r = await pipInstall('spacy')
      if (!r.ok) return r
      const res = await pyRun(['-m', 'spacy', 'download', 'en_core_web_sm'], { timeout: pipTimeoutMs })
      return { ok: res.ok, msg: res.ok ? 'spaCy + en_core_web_sm' : res.err.slice(0, 300) }
    },
  },
  exiftool: {
    kind: 'extraction', label: 'exiftool', group: 'Метаданные',
    description: 'EXIF/GPS-метаданные из изображений и файлов.',
    detect() { return Boolean(which('exiftool')) },
    install() { return { ok: false, msg: 'exiftool — системный бинарь ExifTool; добавьте в PATH' } },
  },
}

function whichFromPy(py, cmd) {
  const dir = path.dirname(py)
  const files = process.platform === 'win32'
    ? [`${cmd}.exe`, `${cmd}.cmd`, `${cmd}.bat`, cmd]
    : [cmd, `${cmd}.exe`]
  for (const f of files) {
    try {
      if (fs.statSync(path.join(dir, f)).isFile()) return true
    } catch {}
  }
  return false
}

export function toolStatus(name) {
  const t = tools[name]
  if (!t) return null
  let available = false
  try {
    available = t.detect()
  } catch {
    available = false
  }
  return { name, label: t.label, kind: t.kind, group: t.group, description: t.description, available }
}

export function allToolStatus() {
  return Object.keys(tools).map(toolStatus)
}
