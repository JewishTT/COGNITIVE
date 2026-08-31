<template>
  <section class="view view-embed">
    <header class="view-head view-head-embed">
      <h1>Глобус</h1>
      <span class="chip">В РАМКЕ · ОДИН ПРОЦЕСС</span>
    </header>
    <p class="embed-hint">
      Живой 3D-мониторинг встроен в страницу напрямую — без отдельной вкладки и без внешней ссылки.
    </p>
    <div class="embed-frame">
      <iframe :src="globeUrl" title="Глобус — живой 3D-мониторинг"></iframe>
    </div>
  </section>
</template>

<script setup lang="ts">
// Глобус обслуживает отдельный vite-сервер (по умолчанию :4173, см. vite.config.js).
// Чтобы встроенный iframe корректно грузил абсолютные ассеты глобуса, он должен
// смотреть напрямую в источник глобуса, а не проксироваться через оболочку
// (прокси /globe в vite.platform.config.js отрезает путь и отдаёт оболочку).
// В production-сборке корень и глобус — один сервер, поэтому GLOBE_EMBED_URL=/globe.
const envGlobe = (import.meta.env as Record<string, unknown>).GLOBE_EMBED_URL as string | undefined
const globeUrl = envGlobe || `http://${window.location.hostname}:4173/globe`
</script>