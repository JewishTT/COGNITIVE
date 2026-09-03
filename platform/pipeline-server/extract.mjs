// pipeline-server/extract.mjs — этап «Извлечение сущностей» 0-слоя.
//
// Гибридный конвейер: сначала быстрые regex (email/телефон/IP/ники/URL),
// затем spaCy NER (люди/организации/гео) когда модель установлена, и exiftool
// для EXIF/GPS-метаданных из бинарных файлов. Всё — через venv python.
// Регулярные выражения всегда доступны (чистый JS).

import { run, pyRun, pyHas, venvPython } from './runner.mjs'
import { execFile } from 'node:child_process'

// --- regex (всегда) --------------------------------------------------------

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g
const IP = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g
const URL_RE = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,24}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/g
const BTC_RE = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g
const ETH_RE = /\b0x[a-fA-F0-9]{40}\b/g

export function extractRegex(text) {
  const out = { emails: new Set(), phones: new Set(), ips: new Set(), urls: new Set() }
  const s = String(text || '')
  for (const m of s.matchAll(EMAIL)) out.emails.add(m[0].toLowerCase())
  for (const m of s.matchAll(PHONE)) out.phones.add(m[0].trim())
  for (const m of s.matchAll(IP)) out.ips.add(m[0])
  for (const m of s.matchAll(URL_RE)) out.urls.add(m[0])
  return { emails: [...out.emails], phones: [...out.phones], ips: [...out.ips], urls: [...out.urls] }
}

export function extractCrypto(text) {
  const s = String(text || '')
  const btc = [...new Set([...s.matchAll(BTC_RE)].map(m => m[0]).filter(v => v.length >= 25 && v.length <= 34 && (v[0] === '1' || v[0] === '3')))]
  const eth = [...new Set([...s.matchAll(ETH_RE)].map(m => m[0]).filter(v => v.length === 42))]
  return { btc, eth }
}

// --- spaCy NER (опционально) ------------------------------------------------

const SPA = `import sys, json
blocks = json.load(sys.stdin)
try:
    import spacy
except Exception:
    print(json.dumps({"error": "no-spacy"})); sys.exit(0)
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    print(json.dumps({"error": "no-model"})); sys.exit(0)
out = {"persons": [], "orgs": [], "gpes": []}
for text in blocks:
    doc = nlp(text or "")
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            out["persons"].append(ent.text)
        elif ent.label_ == "ORG":
            out["orgs"].append(ent.text)
        elif ent.label_ in ("GPE", "LOC"):
            out["gpes"].append(ent.text)
print(json.dumps(out))
`

export async function extractSpaCy(textBlocks, signal) {
  const py = venvPython()
  if (!py || !pyHas('spacy')) return { available: false, persons: [], orgs: [], gpes: [] }
  return new Promise((resolve) => {
    const child = execFile(py, ['-c', SPA], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      try { if (signal) signal.removeEventListener('abort', onAbort) } catch {}
      if (err) return resolve({ available: false, persons: [], orgs: [], gpes: [] })
      try {
        const j = JSON.parse(stdout)
        if (j.error) return resolve({ available: false, persons: [], orgs: [], gpes: [] })
        resolve({
          available: true,
          persons: [...new Set(j.persons || [])],
          orgs: [...new Set(j.orgs || [])],
          gpes: [...new Set(j.gpes || [])],
        })
      } catch {
        resolve({ available: false, persons: [], orgs: [], gpes: [] })
      }
    })
    const onAbort = () => {
      try { child.kill('SIGKILL') } catch {}
    }
    if (signal) {
      if (signal.aborted) { return onAbort() }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    child.stdin.write(JSON.stringify(textBlocks))
    child.stdin.end()
  })
}

// --- exiftool (опционально) -------------------------------------------------

export async function extractExif(filePaths) {
  if (!filePaths || !filePaths.length) return { available: false, results: [] }
  const args = ['-j', '-gps:all', '-Artist', '-Copyright', '-Model', '-DateTimeOriginal'].concat(filePaths)
  const res = await run(['exiftool', ...args], { timeout: 30000 })
  if (!res.ok) return { available: false, results: [] }
  try {
    const arr = JSON.parse(res.out)
    const results = arr.map((o) => ({
      file: o.SourceFile,
      artist: o.Artist,
      copyright: (o.Copyright || o.Rights),
      camera: o.Model,
      gps: (o.GPSLatitude != null && o.GPSLongitude != null) ? { lat: o.GPSLatitude, lon: o.GPSLongitude } : null,
      source: 'exiftool',
    }))
    return { available: true, results }
  } catch {
    return { available: false, results: [] }
  }
}

/**
 * Собирает все тексты из результатов сбора и пропускает их через
 * regex+spaCy, возвращая итоговые сущности.
 */
export async function extractEntities(collected, onEvent, signal) {
  onEvent && onEvent('stage', 'extract', 'Этап ИЗВЛЕЧЕНИЕ: regex + spaCy + exiftool')
  const texts = []
  for (const r of (collected.all.texts || [])) if (r.text) texts.push(r.text)
  for (const r of (collected.all.profiles || [])) if (r.url) texts.push(`${r.platform || ''} ${r.url} ${r.handle || ''}`)
  for (const r of (collected.all.links || [])) if (r.description || r.title) texts.push(`${r.title || ''} ${r.description || ''} ${r.url || ''}`)

  const joined = texts.join('\n')
  const rx = extractRegex(joined)
  const crypto = extractCrypto(joined)

  let nlp = { available: false, persons: [], orgs: [], gpes: [] }
  if (texts.length && !(signal && signal.aborted)) {
    onEvent && onEvent('info', 'extract', `spaCy NER по ${texts.length} текстовым блокам`)
    nlp = await extractSpaCy(texts, signal)
  }

  // Мержим сущности из этапа сбора (theHarvester/BBOT/TGSpyder/crawler):
  // email'ы и телефоны, найденные структурными тулами, не должны потеряться.
  const emailSet = new Set(rx.emails)
  for (const e of (collected.all.emails || [])) if (e.email) emailSet.add(String(e.email).toLowerCase())
  const emails = [...emailSet]
  const phoneSet = new Set(rx.phones)
  for (const p of (collected.all.phones || [])) if (p.phone) phoneSet.add(String(p.phone).trim())
  const phones = [...phoneSet]
  const ipSet = new Set(rx.ips)
  for (const i of (collected.all.hosts || [])) if (i.host && /^\d+\.\d+\.\d+\.\d+$/.test(i.host)) ipSet.add(i.host)
  const ips = [...ipSet]

  // exiftool: обрабатываем файлы, которые принёс этап сбора (crawler качает
  // изображения под EXIF/GPS-анализ). exiftool — системный бинарь в PATH.
  let exif = { available: false, results: [] }
  const files = []
  for (const f of (collected.all.files || [])) if (f.path) files.push(f.path)
  if (files.length && !(signal && signal.aborted)) {
    onEvent && onEvent('info', 'extract', `exiftool по ${files.length} файлам (EXIF/GPS)`)
    exif = await extractExif(files)
  }

  onEvent && onEvent('stage_done', 'extract', `Извлечено: ${emails.length} email, ${phones.length} тел., ${ips.length} IP, ${crypto.btc.length} BTC, ${crypto.eth.length} ETH, ${nlp.persons.length} персон, ${nlp.orgs.length} орг., exif: ${exif.results.length}`)
  return {
    emails,
    phones,
    ips,
    urls: rx.urls,
    btc: crypto.btc,
    eth: crypto.eth,
    persons: dedupeFilter(nlp.persons),
    orgs: dedupeFilter(nlp.orgs),
    gpes: dedupeFilter(nlp.gpes),
    nlpAvailable: nlp.available,
    exif: exif,
    files: files.map((_) => true),
  }
}

// small-модель spaCy иногда размечает email/URL/IP как ORG/PERSON — такие
// «сущности» выкидываем, чтобы не засорять граф.
function isStructuredEntity(v) {
  const s = String(v || '').trim()
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)
    || /^https?:\/\//i.test(s)
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(s)
}

function dedupeFilter(entities) {
  return [...new Set((entities || []).filter((v) => !isStructuredEntity(v)))]
}
