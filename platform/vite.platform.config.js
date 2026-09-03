import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [vue(), cesium()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {},
  server: {
    port: 5180,
    strictPort: true,
    // Прокси на шарик (раздел-embed) и на Фабрику (Postiz).
    proxy: {
      // Раздел «Шарик» — embed существующего глобуса, работающего на :4173.
      // Путь /globe сохраняем как есть: корневой сервер отдаёт по /globe сам
      // глобус (см. platformRootShell в vite.config.js), а не оболочку.
      '/globe': {
        target: 'http://localhost:4173',
        changeOrigin: true,
      },
      // Фабрика — Postiz на :4007.
      '/factory': {
        target: 'http://localhost:4007',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/factory/, ''),
      },
      // Глубокое слияние с Flowsint: платформа — это нативный UI движка
      // Flowsint. Запросы проксируются в pipeline-server (:5181), без
      // iframe и без отдельного React-приложения.
      '/flowsint-api': {
        target: 'http://localhost:5181',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/flowsint-api/, ''),
      },
      // 0-слой: пайплайн первичного сбора (BBOT/theHarvester/sherlock/maigret/
      // snscrape/TGSpyder/SearXNG → regex+spaCy+exiftool → Neo4j). Отдельный
      // сервис, пишет в Neo4j через flowsint-api.
      '/pipeline': {
        target: 'http://localhost:5181',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/pipeline/, ''),
      },
    },
  },
});
