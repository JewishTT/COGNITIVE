<template>
  <div class="shell">
    <!-- Top command bar: brand + nav + AI chat -->
    <header class="shell-header">
      <div class="shell-brand">
        <span class="shell-logo">G7</span>
        <div class="shell-brand-text">
          <strong>ПЛАТФОРМА</strong>
          <small>командный центр · GHOST-7</small>
        </div>
        <span class="shell-scanner"></span>
      </div>

      <nav class="shell-nav" aria-label="Разделы платформы">
        <router-link
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="shell-link"
          :class="{ active: item.path === currentPath }"
          :title="item.title"
        >
          <span class="shell-link-ico">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.dot" class="shell-nav-dot" :class="item.dot"></span>
        </router-link>
      </nav>

      <div class="shell-ctrl">
        <ChatWindow />
      </div>
    </header>

    <main class="shell-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ChatWindow from '@/chat/components/ChatWindow.vue'

const route = useRoute()
const currentPath = computed(() => route.path)

const nav = [
  { path: '/', label: 'Дашборд', icon: '⌂', title: 'Центр управления', dot: 'green' },
  { path: '/globe', label: 'Глобус', icon: '🌐', title: 'Живой 3D-мониторинг', dot: 'green' },
  { path: '/osint', label: 'ОСИНТ', icon: '🕵️', title: 'Графовое расследование · движок Flowsint (Neo4j) · TheBigBrother · TDA', dot: 'yellow' },
  { path: '/factory', label: 'Фабрика', icon: '🏭', title: 'AI-конвейер контента', dot: 'green' },
  { path: '/ecommerce', label: 'Коммерция', icon: '💳', title: 'Коммерческие проекты', dot: '' },
]
</script>
