<template>
  <section class="view">
    <header class="view-head">
      <h1>Центр управления</h1>
      <p>Платформа объединяет глобус, OSINT-граф и фабрику контента.</p>
    </header>

    <div class="tile-grid">
      <router-link to="/globe" class="tile">
        <span class="tile-icon">🌐</span>
        <strong>Глобус</strong>
        <small>Живой 3D-мониторинг планеты</small>
      </router-link>
      <router-link to="/osint" class="tile">
        <span class="tile-icon">🕵️</span>
        <strong>ОСИНТ</strong>
        <small>Графовое расследование связей</small>
      </router-link>
      <router-link to="/factory" class="tile">
        <span class="tile-icon">🏭</span>
        <strong>Фабрика контента</strong>
        <small>AI-конвейер для соцсетей</small>
      </router-link>
      <router-link to="/ecommerce" class="tile">
        <span class="tile-icon">💳</span>
        <strong>Коммерция</strong>
        <small>Командный центр коммерческих проектов</small>
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts"></script>
