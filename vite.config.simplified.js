/**
 * COGNITIVE PLATFORM - VITE CONFIGURATION (SIMPLIFIED)
 * 
 * Build configuration. All runtime config moved to config/ and core/config/
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    cesium(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@cognitive/core': resolve(__dirname, './core'),
      '@config': resolve(__dirname, './config'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/pipeline': {
        target: process.env.PIPELINE_URL || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: !process.env.CI,
    rollupOptions: {
      output: {
        manualChunks: {
          'cesium': ['cesium'],
          'vue': ['vue', 'vue-router'],
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
