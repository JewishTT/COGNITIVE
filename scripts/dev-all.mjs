// dev-all.mjs — запускает фронтенд целиком в одном терминале:
//   1) корневой vite-сервер (глобус) на :4173
//   2) dev-сервер платформы (Vue) на :5180 (iframe Глобуса → :4173, Фабрики → :4007)
//   3) пайплайн-сервер 0-слоя на :5181
//   4) Фабрика (Postiz) на :4007 через docker compose
// Завершается по Ctrl+C, корректно останавливая все процессы.
import { spawn } from 'node:child_process';

const procs = [
  'npm run dev:globe',
  'npm run dev:platform',
  'npm run dev:pipeline',
  'npm run dev:factory',
].map((cmd) => spawn(cmd, { shell: true, stdio: 'inherit' }));

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(code ?? 0);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const p of procs) {
  p.on('exit', (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
}
