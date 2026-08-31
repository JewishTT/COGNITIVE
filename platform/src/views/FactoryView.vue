<template>
  <section class="view view-embed">
    <header class="view-head view-head-embed">
      <h1>Фабрика контента</h1>
      <span class="chip">В РАМКЕ · POSTIZ</span>
    </header>

    <div class="osint-status-card">
      <span class="osint-status-dot" :class="dotClass"></span>
      <div>
        <strong>Postiz — AI-планировщик соцсетей</strong>
        <small>{{ statusText }}</small>
      </div>
      <span class="chip" :class="chipClass">{{ chipText }}</span>
    </div>

    <p class="embed-hint">
      Встроен из self-hosted Postiz прямо на страницу. Вход администратора выполняется автоматически — формы входа на экране нет.
    </p>

    <div v-if="status === 'online'" class="embed-frame">
      <iframe :src="factoryUrl" title="Фабрика — контент-планировщик и постинг"></iframe>
    </div>
    <div v-else class="osint-placeholder">
      <template v-if="status === 'offline'">
        <strong>Postiz не запущен</strong>
        <div class="muted">Поднимите стек: docker compose -f platform/factory/docker-compose.yaml up -d</div>
      </template>
      <template v-else-if="status === 'needsLogin'">
        <strong>Не удалось открыть сессию</strong>
        <div class="muted">{{ message }}</div>
      </template>
      <template v-else>
        <strong>Подключение к Postiz…</strong>
      </template>
      <button class="btn" style="margin-top: 16px" @click="ensureSession">Повторить</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const FACTORY_ORIGIN = `http://${window.location.hostname}:4007`
const ADMIN_EMAIL = (import.meta.env.POSTIZ_ADMIN_EMAIL as string) || 'admin@gev.local'
const ADMIN_PASSWORD = (import.meta.env.POSTIZ_ADMIN_PASSWORD as string) || 'PostizAdmin123!'

const factoryUrl = FACTORY_ORIGIN + '/'

type FactoryStatus = 'booting' | 'online' | 'needsLogin' | 'offline'
const status = ref<FactoryStatus>('booting')
const message = ref('')

const dotClass = computed(() => ({
  'osint-status-dot--down': status.value === 'offline',
  'osint-status-dot--warn': status.value === 'needsLogin',
}))
const chipClass = computed(() => ({
  'chip--down': status.value === 'offline' || status.value === 'needsLogin',
}))
const chipText = computed(() => {
  switch (status.value) {
    case 'online': return 'АКТИВНО'
    case 'needsLogin': return 'НУЖЕН ВХОД'
    case 'offline': return 'ОФЛАЙН'
    default: return 'ПОДКЛЮЧЕНИЕ…'
  }
})
const statusText = computed(() => {
  switch (status.value) {
    case 'online': return 'Вход администратора выполнен автоматически'
    case 'needsLogin': return message.value || 'Требуется вход администратора'
    case 'offline': return 'Движок Postiz недоступен на :4007'
    default: return 'Устанавливаем автоматическую сессию'
  }
})

async function ensureSession() {
  status.value = 'booting'
  message.value = ''
  try {
    let res = await fetch('/factory/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'LOCAL', email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })
    if (!res.ok) {
      res = await fetch('/factory/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'LOCAL',
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          company: 'Gods Eye',
        }),
      })
    }
    if (res.ok) {
      status.value = 'online'
      return
    }
    const text = await res.text().catch(() => '')
    status.value = 'needsLogin'
    message.value = text || `Ошибка ${res.status} от Postiz API`
  } catch (e) {
    status.value = 'offline'
    message.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(ensureSession)
</script>