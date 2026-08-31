#!/usr/bin/env python
"""Единый патч BBOT 3.x для Windows (NT).
1) os.geteuid — Unix-only, на NT подменяем на lambda:1 (не-root).
2) install_core_deps — ansible-based установка unzip/7z неприменима на NT -> skip.
3) _write_secret_text - POSIX 0666 & 0o077 всегда фейлится на NTFS -> пишем без chmod."""
import pathlib, sys, re

ROOT = pathlib.Path('platform/pipeline-server/.pipeline-venv/Lib/site-packages/bbot')
changed = []

# --- 1) os.geteuid compat ---
EUID_GUARD = '_gev_euid_compat'
for rel in ['core/helpers/command.py', 'core/helpers/misc.py', 'core/helpers/depsinstaller/installer.py']:
    f = ROOT / rel
    if not f.exists():
        continue
    src = f.read_text(encoding='utf-8')
    if EUID_GUARD in src:
        continue
    if 'os.geteuid()' not in src:
        continue
    m = re.search(r'^import os\b.*$', src, flags=re.M)
    if not m:
        continue
    inject = (
        '\ntry:  # ' + EUID_GUARD + '\n'
        '    _gev_euid = os.geteuid\n'
        'except AttributeError:\n'
        '    def _gev_euid():\n'
        '        return 1  # non-root on platforms without geteuid (Windows)\n'
        'os.geteuid = _gev_euid\n'
    )
    src = src[:m.end()] + inject + src[m.end():]
    f.write_text(src, encoding='utf-8')
    changed.append(rel + ': geteuid')

# --- 2) install_core_deps skip on Windows ---
DEPS_GUARD = '_gev_skip_core_deps_win'
f = ROOT / 'core/helpers/depsinstaller/installer.py'
src = f.read_text(encoding='utf-8')
if DEPS_GUARD not in src and 'async def install_core_deps(self):' in src:
    src = src.replace(
        '    async def install_core_deps(self):\n',
        '    async def install_core_deps(self):\n'
        '        if os.name == "nt":  # ' + DEPS_GUARD + ': ansible system-deps are Linux-only\n'
        '            log.debug("Skipping core dependency installation (Windows)")\n'
        '            return\n',
        1,
    )
    f.write_text(src, encoding='utf-8')
    changed.append('installer.py: core-deps skip')

# --- 3) _write_secret_text Windows-safe ---
SEC_GUARD = '_gev_windows_fix'
f = ROOT / 'core/modules.py'
src = f.read_text(encoding='utf-8')
if SEC_GUARD not in src and 'def _write_secret_text(path, text):' in src:
    start = src.index('    @staticmethod\n    def _write_secret_text(path, text):\n')
    end = src.index('MODULE_LOADER = ModuleLoader()')
    new_body = (
        '    @staticmethod\n'
        '    def _write_secret_text(path, text):  # ' + SEC_GUARD + '\n'
        '        """Windows-safe: skip POSIX mode checks that always fail on NTFS."""\n'
        '        path = Path(path)\n'
        '        fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")\n'
        '        try:\n'
        '            if os.name != "nt":\n'
        '                mode = 0o600\n'
        '                with suppress(FileNotFoundError):\n'
        '                    existing_mode = stat.S_IMODE(path.stat().st_mode)\n'
        '                    if not existing_mode & 0o077:\n'
        '                        mode = existing_mode\n'
        '                os.fchmod(fd, mode)\n'
        '            with os.fdopen(fd, "w") as f:\n'
        '                f.write(text)\n'
        '            os.replace(tmp, str(path))\n'
        '        except BaseException:\n'
        '            with suppress(FileNotFoundError, PermissionError, OSError):\n'
        '                os.unlink(tmp)\n'
        '            raise\n'
        '\n'
        '\n'
    )
    src = src[:start] + new_body + src[end:]
    f.write_text(src, encoding='utf-8')
    changed.append('modules.py: write_secret')

if changed:
    print('PATCHED:', ', '.join(changed))
else:
    print('all patches already applied')
