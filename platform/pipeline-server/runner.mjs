// pipeline-server/runner.mjs — общие утилиты запуска процессов и python-окружения.

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.mjs'

const { venvDir, pipTimeoutMs } = config

export function which(cmd) {
  const paths = process.env.PATH ? process.env.PATH.split(path.delimiter) : []
  for (const dir of paths) {
    if (!dir) continue
    const exts = process.platform === 'win32' ? [cmd, `${cmd}.exe`, `${cmd}.cmd`, `${cmd}.bat`] : [cmd]
    for (const exe of exts) {
      try {
        if (fs.statSync(path.join(dir, exe)).isFile()) return path.join(dir, exe)
      } catch {}
    }
  }
  try {
    return execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' })
      .split(/\r?\n/)[0].trim() || null
  } catch {
    return null
  }
}

export function venvPython() {
  const exe = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python')
  return fs.existsSync(exe) ? exe : null
}

let _venvReady = null
export function ensureVenv() {
  if (_venvReady !== null) return _venvReady
  const py = pythonBin()
  if (!py) {
    _venvReady = false
    return false
  }
  if (venvPython()) {
    _venvReady = true
    return true
  }
  try {
    fs.mkdirSync(venvDir, { recursive: true })
    execFileSync(py, ['-m', 'venv', venvDir], { stdio: 'pipe', timeout: pipTimeoutMs })
    _venvReady = Boolean(venvPython())
  } catch {
    _venvReady = false
  }
  return _venvReady
}

export function pythonBin() {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']
  for (const c of candidates) {
    const p = which(c)
    if (p) {
      try {
        execFileSync(p, ['--version'], { stdio: 'pipe' })
        return p
      } catch {}
    }
  }
  return null
}

export function run(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      ...opts,
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
    }, opts.timeout || 60000)
    opts.signal?.addEventListener('abort', () => {
      try { child.kill('SIGKILL') } catch {}
    }, { once: true })
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, out, err: String(e.message), code: -1 })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, out, err, code })
    })
  })
}

export function pyRun(args, opts = {}) {
  const py = venvPython() || pythonBin()
  return run([py, ...args], opts)
}

export function pyHas(moduleName) {
  ensureVenv()
  const py = venvPython() || pythonBin()
  if (!py) return false
  try {
    execFileSync(py, ['-c', `import importlib.util; raise SystemExit(0 if importlib.util.find_spec('${moduleName}') else 1)`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
