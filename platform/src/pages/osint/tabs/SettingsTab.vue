<template>
  <div class="settings-tab">
    <!-- Settings Header -->
    <div class="settings-header">
      <div class="settings-info">
        <h2 class="settings-title">
          <span class="title-icon"><UiIcon name="settings" /></span>
          Настройки OSINT
        </h2>
        <p class="settings-description">
          Конфигурация модулей, интеграций и параметров анализа
        </p>
      </div>
      <div class="settings-actions">
        <button class="btn btn-secondary" @click="resetSettings" :disabled="loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Сбросить
        </button>
        <button class="btn btn-primary" @click="saveSettings" :disabled="loading">
          <span class="btn-icon animate-spin" v-if="loading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
            </svg>
          </span>
          <span v-else>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            </svg>
            Сохранить
          </span>
        </button>
      </div>
    </div>

    <!-- Settings Navigation -->
    <div class="settings-nav glass-card">
      <button 
        v-for="section in settingsSections" 
        :key="section.id" 
        class="nav-item" 
        :class="{ active: activeSection === section.id }"
        @click="activeSection = section.id"
      >
        <span class="nav-icon">{{ section.icon }}</span>
        <span class="nav-label">{{ section.label }}</span>
        <span class="nav-count" v-if="section.count">{{ section.count }}</span>
      </button>
    </div>

    <!-- Settings Content -->
    <div class="settings-content">
      <transition name="fade" mode="out-in">
        <!-- General Settings -->
        <div class="settings-section" v-if="activeSection === 'general'" key="general">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon"><UiIcon name="clipboard" /></span>
              Общие настройки
            </h3>
            <p class="section-description">
              Основные параметры модуля OSINT
            </p>
          </div>
          
          <div class="settings-grid">
            <div class="setting-group">
              <label class="setting-label">Язык интерфейса</label>
              <select v-model="settings.general.language" class="form-select" :disabled="loading">
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="uk">Українська</option>
              </select>
            </div>
            
            <div class="setting-group">
              <label class="setting-label">Тема по умолчанию</label>
              <select v-model="settings.general.theme" class="form-select" :disabled="loading">
                <option value="dark">Темная</option>
                <option value="light">Светлая</option>
                <option value="system">Системная</option>
              </select>
            </div>
            
            <div class="setting-group">
              <label class="setting-label">Количество элементов на странице</label>
              <input 
                type="number" 
                v-model.number="settings.general.pageSize" 
                class="form-input" 
                min="10" 
                max="100"
                :disabled="loading"
              />
            </div>
            
            <div class="setting-group">
              <label class="setting-label">Автообновление данных (сек)</label>
              <input 
                type="number" 
                v-model.number="settings.general.autoRefresh" 
                class="form-input" 
                min="0" 
                max="300"
                :disabled="loading"
              />
              <span class="setting-hint">0 - отключено</span>
            </div>
            
            <div class="setting-group setting-group-checkbox">
              <label class="setting-checkbox">
                <input type="checkbox" v-model="settings.general.enableNotifications" :disabled="loading">
                <span class="checkbox-label">Включить уведомления</span>
              </label>
            </div>
            
            <div class="setting-group setting-group-checkbox">
              <label class="setting-checkbox">
                <input type="checkbox" v-model="settings.general.enableAnalytics" :disabled="loading">
                <span class="checkbox-label">Собирать аналитику</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Module Settings -->
        <div class="settings-section" v-else-if="activeSection === 'modules'" key="modules">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon"><UiIcon name="puzzle" /></span>
              Модули OSINT
            </h3>
            <p class="section-description">
              Настройка и управление модулями
            </p>
          </div>
          
          <div class="modules-container">
            <div class="module-card" v-for="module in modules" :key="module.id">
              <div class="module-header">
                <div class="module-info">
                  <span class="module-icon">{{ module.icon }}</span>
                  <div class="module-details">
                    <h4 class="module-name">{{ module.name }}</h4>
                    <p class="module-description">{{ module.description }}</p>
                  </div>
                </div>
                <div class="module-actions">
                  <label class="switch-label">
                    <input 
                      type="checkbox" 
                      v-model="module.enabled" 
                      class="form-switch" 
                      :disabled="loading"
                    />
                    <span class="switch-text">{{ module.enabled ? 'Включено' : 'Отключено' }}</span>
                  </label>
                  <button class="module-btn" @click="configureModule(module.id)" title="Настроить">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="module-status" :class="module.status">
                <span class="status-dot"></span>
                <span class="status-text">{{ statusLabels[module.status] }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Integrations Settings -->
        <div class="settings-section" v-else-if="activeSection === 'integrations'" key="integrations">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon"><UiIcon name="link" /></span>
              Интеграции
            </h3>
            <p class="section-description">
              Настройка подключений к внешним сервисам
            </p>
          </div>
          
          <div class="integrations-container">
            <div class="integration-card" v-for="integration in integrations" :key="integration.id">
              <div class="integration-header">
                <div class="integration-info">
                  <span class="integration-icon" :style="{ background: integration.color }">
                    {{ integration.icon }}
                  </span>
                  <div class="integration-details">
                    <h4 class="integration-name">{{ integration.name }}</h4>
                    <p class="integration-description">{{ integration.description }}</p>
                  </div>
                </div>
                <div class="integration-status" :class="integration.connected ? 'connected' : 'disconnected'">
                  {{ integration.connected ? 'Подключено' : 'Отключено' }}
                </div>
              </div>
              <div class="integration-content">
                <div class="integration-fields" v-if="integration.connected">
                  <div class="field" v-for="field in integration.fields" :key="field.id">
                    <label class="field-label">{{ field.label }}</label>
                    <input 
                      :type="field.type === 'password' ? 'password' : 'text'" 
                      v-model="field.value" 
                      class="form-input" 
                      :placeholder="field.placeholder"
                      :disabled="loading"
                    />
                  </div>
                </div>
                <div class="integration-actions">
                  <button 
                    class="btn" 
                    :class="integration.connected ? 'btn-danger' : 'btn-primary'" 
                    @click="toggleIntegration(integration.id)"
                    :disabled="loading"
                  >
                    {{ integration.connected ? 'Отключить' : 'Подключить' }}
                  </button>
                  <button 
                    class="btn btn-secondary" 
                    @click="testConnection(integration.id)"
                    :disabled="loading || !integration.connected"
                  >
                    <span class="btn-icon animate-spin" v-if="testing === integration.id">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
                      </svg>
                    </span>
                    <span v-else>Проверить</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Settings -->
        <div class="settings-section" v-else-if="activeSection === 'analysis'" key="analysis">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon"><UiIcon name="chartBar" /></span>
              Настройки анализа
            </h3>
            <p class="section-description">
              Параметры алгоритмов и методов анализа
            </p>
          </div>
          
          <div class="analysis-container">
            <div class="analysis-category">
              <h4 class="category-title">Алгоритмы поиска сообществ</h4>
              <div class="category-content">
                <div class="algorithm-option" v-for="algo in communityAlgorithms" :key="algo.id">
                  <label class="algorithm-label">
                    <input 
                      type="radio" 
                      v-model="settings.analysis.communityAlgorithm" 
                      :value="algo.id" 
                      :disabled="loading"
                    />
                    <span class="algorithm-name">{{ algo.name }}</span>
                  </label>
                  <span class="algorithm-description">{{ algo.description }}</span>
                </div>
              </div>
            </div>
            
            <div class="analysis-category">
              <h4 class="category-title">Метрики центральности</h4>
              <div class="category-content">
                <div class="metric-options">
                  <label class="metric-option" v-for="metric in centralityMetrics" :key="metric.id">
                    <input 
                      type="checkbox" 
                      v-model="settings.analysis.enabledMetrics" 
                      :value="metric.id" 
                      :disabled="loading"
                    />
                    <span class="metric-name">{{ metric.name }}</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div class="analysis-category">
              <h4 class="category-title">Параметры TDA</h4>
              <div class="category-content">
                <div class="tda-settings-grid">
                  <div class="tda-setting">
                    <label class="tda-label">Размерность</label>
                    <select v-model="settings.analysis.tdaDimension" class="form-select" :disabled="loading">
                      <option value="2">2D</option>
                      <option value="3">3D</option>
                    </select>
                  </div>
                  <div class="tda-setting">
                    <label class="tda-label">Метрика расстояния</label>
                    <select v-model="settings.analysis.tdaDistanceMetric" class="form-select" :disabled="loading">
                      <option value="euclidean">Евклидова</option>
                      <option value="cosine">Косинусная</option>
                    </select>
                  </div>
                  <div class="tda-setting">
                    <label class="tda-label">Радиус ε</label>
                    <input 
                      type="number" 
                      v-model.number="settings.analysis.tdaRadius" 
                      class="form-input" 
                      min="0.1" 
                      max="10" 
                      step="0.1"
                      :disabled="loading"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div class="settings-section" v-else-if="activeSection === 'advanced'" key="advanced">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon"><UiIcon name="wrench" /></span>
              Дополнительные настройки
            </h3>
            <p class="section-description">
              Расширенные параметры и экспериментальные функции
            </p>
          </div>
          
          <div class="advanced-container">
            <div class="advanced-category">
              <h4 class="category-title">Кэширование</h4>
              <div class="category-content">
                <div class="cache-settings">
                  <div class="cache-setting">
                    <label class="setting-label">Тип кэша</label>
                    <select v-model="settings.advanced.cacheType" class="form-select" :disabled="loading">
                      <option value="memory">Память</option>
                      <option value="localStorage">LocalStorage</option>
                      <option value="redis">Redis</option>
                      <option value="hybrid">Гибридный</option>
                    </select>
                  </div>
                  <div class="cache-setting">
                    <label class="setting-label">Время жизни кэша (мин)</label>
                    <input 
                      type="number" 
                      v-model.number="settings.advanced.cacheTTL" 
                      class="form-input" 
                      min="1" 
                      max="1440"
                      :disabled="loading"
                    />
                  </div>
                  <div class="cache-setting">
                    <label class="setting-label">Макс. размер кэша (МБ)</label>
                    <input 
                      type="number" 
                      v-model.number="settings.advanced.cacheMaxSize" 
                      class="form-input" 
                      min="1" 
                      max="1024"
                      :disabled="loading"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div class="advanced-category">
              <h4 class="category-title">Fallback механизмы</h4>
              <div class="category-content">
                <div class="fallback-settings">
                  <div class="fallback-setting">
                    <label class="setting-label">Включить fallback</label>
                    <input 
                      type="checkbox" 
                      v-model="settings.advanced.enableFallback" 
                      class="form-checkbox"
                      :disabled="loading"
                    />
                  </div>
                  <div class="fallback-setting">
                    <label class="setting-label">Макс. попыток</label>
                    <input 
                      type="number" 
                      v-model.number="settings.advanced.maxRetries" 
                      class="form-input" 
                      min="1" 
                      max="10"
                      :disabled="loading"
                    />
                  </div>
                  <div class="fallback-setting">
                    <label class="setting-label">Таймаут запроса (мс)</label>
                    <input 
                      type="number" 
                      v-model.number="settings.advanced.requestTimeout" 
                      class="form-input" 
                      min="100" 
                      max="30000"
                      :disabled="loading"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div class="advanced-category">
              <h4 class="category-title">Экспериментальные функции</h4>
              <div class="category-content">
                <div class="experimental-settings">
                  <label class="setting-checkbox" v-for="feature in experimentalFeatures" :key="feature.id">
                    <input 
                      type="checkbox" 
                      v-model="feature.enabled" 
                      :disabled="loading"
                    />
                    <span class="checkbox-label">{{ feature.name }}</span>
                    <span class="feature-badge" v-if="feature.beta">BETA</span>
                    <span class="feature-badge" v-if="feature.alpha">ALPHA</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// State
const loading = ref(false)
const testing = ref<string | null>(null)

// Settings sections
const settingsSections = [
  { id: 'general', label: 'Общие', icon: 'clipboard', count: 0 },
  { id: 'modules', label: 'Модули', icon: 'puzzle', count: 8 },
  { id: 'integrations', label: 'Интеграции', icon: 'link', count: 6 },
  { id: 'analysis', label: 'Анализ', icon: 'chartBar', count: 0 },
  { id: 'advanced', label: 'Дополнительно', icon: 'wrench', count: 0 },
]

const activeSection = ref('general')

// Settings data
const settings = ref({
  general: {
    language: 'ru',
    theme: 'dark',
    pageSize: 25,
    autoRefresh: 30,
    enableNotifications: true,
    enableAnalytics: true,
  },
  analysis: {
    communityAlgorithm: 'louvain',
    enabledMetrics: ['degree', 'betweenness', 'closeness'],
    tdaDimension: 2,
    tdaDistanceMetric: 'euclidean',
    tdaRadius: 1.0,
  },
  advanced: {
    cacheType: 'hybrid',
    cacheTTL: 60,
    cacheMaxSize: 256,
    enableFallback: true,
    maxRetries: 3,
    requestTimeout: 5000,
  },
})

// Modules
const modules = ref([
  { 
    id: 'flowsint', 
    icon: 'palette', 
    name: 'Flowsint UI', 
    description: 'Интерфейс для работы с графами',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'pipeline', 
    icon: 'factory', 
    name: 'Конвейеры', 
    description: 'Обработка данных через конвейеры',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'tda', 
    icon: 'calculator', 
    name: 'TDA Анализ', 
    description: 'Топологический анализ данных',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'enrichment', 
    icon: 'search', 
    name: 'Обогащение', 
    description: 'Обогащение данных из внешних источников',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'export', 
    icon: 'upload', 
    name: 'Экспорт', 
    description: 'Экспорт данных в различные форматы',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'import', 
    icon: 'download', 
    name: 'Импорт', 
    description: 'Импорт данных из различных источников',
    enabled: false,
    status: 'inactive' as const
  },
  { 
    id: 'visualization', 
    icon: 'chartBar', 
    name: 'Визуализация', 
    description: '3D визуализация графов',
    enabled: true,
    status: 'active' as const
  },
  { 
    id: 'ai', 
    icon: 'robot', 
    name: 'AI Ассистент', 
    description: 'Искусственный интеллект для анализа',
    enabled: true,
    status: 'active' as const
  },
])

// Integrations
const integrations = ref([
  { 
    id: 'neo4j', 
    icon: 'N', 
    name: 'Neo4j', 
    description: 'Графовая база данных',
    color: '#008cc9',
    connected: true,
    fields: [
      { id: 'url', label: 'URL', type: 'text', value: 'bolt://localhost:7687', placeholder: 'bolt://localhost:7687' },
      { id: 'username', label: 'Пользователь', type: 'text', value: 'neo4j', placeholder: 'neo4j' },
      { id: 'password', label: 'Пароль', type: 'password', value: '', placeholder: '••••••••' },
    ]
  },
  { 
    id: 'redis', 
    icon: 'R', 
    name: 'Redis', 
    description: 'Кэш и Pub/Sub',
    color: '#d82c20',
    connected: true,
    fields: [
      { id: 'url', label: 'URL', type: 'text', value: 'redis://localhost:6379', placeholder: 'redis://localhost:6379' },
      { id: 'password', label: 'Пароль', type: 'password', value: '', placeholder: '••••••••' },
    ]
  },
  { 
    id: 'stix', 
    icon: 'S', 
    name: 'STIX/TAXII', 
    description: 'Стандарт обмена угрозами',
    color: '#4a90e2',
    connected: false,
    fields: [
      { id: 'server', label: 'Сервер', type: 'text', value: '', placeholder: 'https://stix-server.com' },
      { id: 'apiKey', label: 'API Ключ', type: 'password', value: '', placeholder: '••••••••' },
    ]
  },
  { 
    id: 'elasticsearch', 
    icon: 'E', 
    name: 'Elasticsearch', 
    description: 'Поиск и аналитика',
    color: '#005571',
    connected: false,
    fields: [
      { id: 'url', label: 'URL', type: 'text', value: '', placeholder: 'http://localhost:9200' },
      { id: 'index', label: 'Индекс', type: 'text', value: 'osint', placeholder: 'osint' },
    ]
  },
  { 
    id: 'postgresql', 
    icon: 'P', 
    name: 'PostgreSQL', 
    description: 'Реляционная база данных',
    color: '#336791',
    connected: false,
    fields: [
      { id: 'host', label: 'Хост', type: 'text', value: 'localhost', placeholder: 'localhost' },
      { id: 'port', label: 'Порт', type: 'text', value: '5432', placeholder: '5432' },
      { id: 'database', label: 'База данных', type: 'text', value: 'osint', placeholder: 'osint' },
      { id: 'username', label: 'Пользователь', type: 'text', value: 'postgres', placeholder: 'postgres' },
      { id: 'password', label: 'Пароль', type: 'password', value: '', placeholder: '••••••••' },
    ]
  },
  { 
    id: 'github', 
    icon: 'G', 
    name: 'GitHub', 
    description: 'Интеграция с GitHub',
    color: '#24292e',
    connected: false,
    fields: [
      { id: 'token', label: 'Токен', type: 'password', value: '', placeholder: 'ghp_••••••••••••••••••' },
    ]
  },
])

// Analysis settings
const communityAlgorithms = [
  { id: 'louvain', name: 'Louvain', description: 'Быстрый и эффективный' },
  { id: 'leiden', name: 'Leiden', description: 'Улучшенный Louvain' },
  { id: 'labelPropagation', name: 'Label Propagation', description: 'Распространение меток' },
  { id: 'fastGreedy', name: 'Fast Greedy', description: 'Жадный алгоритм' },
]

const centralityMetrics = [
  { id: 'degree', name: 'Степень' },
  { id: 'betweenness', name: 'Посредничество' },
  { id: 'closeness', name: 'Близость' },
  { id: 'eigenvector', name: 'Собственный вектор' },
  { id: 'pagerank', name: 'PageRank' },
  { id: 'hubs', name: 'Hubs' },
  { id: 'authority', name: 'Authority' },
]

// Experimental features
const experimentalFeatures = ref([
  { id: 'aiAnalysis', name: 'AI Анализ', enabled: true, beta: true },
  { id: 'realTimeTda', name: 'TDA в реальном времени', enabled: false, alpha: true },
  { id: 'predictiveAnalytics', name: 'Прогнозная аналитика', enabled: false, alpha: true },
  { id: 'federatedSearch', name: 'Федеративный поиск', enabled: false, beta: true },
  { id: 'blockchainVerification', name: 'Блокчейн верификация', enabled: false, alpha: true },
])

// Status labels
const statusLabels = {
  active: 'Активен',
  inactive: 'Неактивен',
  error: 'Ошибка',
  loading: 'Загрузка',
}

// Actions
const resetSettings = () => {
  if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
    loading.value = true
    // Reset to defaults
    setTimeout(() => {
      loading.value = false
    }, 500)
  }
}

const saveSettings = () => {
  loading.value = true
  // Save settings
  setTimeout(() => {
    loading.value = false
    alert('Настройки сохранены')
  }, 500)
}

const configureModule = (moduleId: string) => {
  // Open module configuration
}

const toggleIntegration = (integrationId: string) => {
  const integration = integrations.value.find(i => i.id === integrationId)
  if (integration) {
    integration.connected = !integration.connected
  }
}

const testConnection = async (integrationId: string) => {
  testing.value = integrationId
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 2000))
  testing.value = null
  alert('Проверка соединения выполнена')
}

// Initialize
onMounted(() => {
  // Load settings from storage or API
})
</script>

<style scoped>
/* ==========================================================================
   SETTINGS TAB - PREMIUM DESIGN
   ========================================================================== */

.settings-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--space-lg);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
}

.settings-info {
  flex: 1;
}

.settings-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.title-icon {
  font-size: var(--font-size-3xl);
}

.settings-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 600px;
}

.settings-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* ==========================================================================
   NAVIGATION
   ========================================================================== */

.settings-nav {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow-x: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.nav-item.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.nav-icon {
  font-size: var(--font-size-base);
}

.nav-count {
  font-size: var(--font-size-xs);
  padding: 0 var(--space-xs);
  background: var(--color-primary-500);
  color: white;
  border-radius: var(--radius-full);
  margin-left: auto;
}

/* ==========================================================================
   SETTINGS CONTENT
   ========================================================================== */

.settings-content {
  flex: 1;
  min-height: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  overflow-y: auto;
}

.settings-section {
  height: 100%;
  min-height: 0;
}

/* ==========================================================================
   SECTION HEADER
   ========================================================================== */

.section-header {
  margin-bottom: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.section-icon {
  font-size: var(--font-size-2xl);
}

.section-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}

/* ==========================================================================
   SETTINGS GRID
   ========================================================================== */

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.setting-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.setting-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.setting-group-checkbox {
  flex-direction: row;
  align-items: center;
}

.setting-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.setting-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary-500);
}

.checkbox-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

/* ==========================================================================
   MODULES
   ========================================================================== */

.modules-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.module-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  transition: all var(--transition-fast);
}

.module-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-lg);
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.module-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.module-icon {
  font-size: var(--font-size-2xl);
}

.module-details {
  display: flex;
  flex-direction: column;
}

.module-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.module-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.module-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.switch-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.module-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.module-btn:hover {
  background: var(--color-surface-active);
  color: var(--color-text);
  border-color: var(--color-border-light);
}

.module-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
}

.module-status.active {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-500);
}

.module-status.inactive {
  background: rgba(107, 114, 128, 0.2);
  color: var(--color-text-muted);
}

.module-status.error {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-danger-500);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.module-status.active .status-dot {
  background: var(--color-success-500);
  animation: pulse 2s ease-in-out infinite;
}

.module-status.inactive .status-dot {
  background: var(--color-text-muted);
}

.module-status.error .status-dot {
  background: var(--color-danger-500);
}

/* ==========================================================================
   INTEGRATIONS
   ========================================================================== */

.integrations-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-lg);
}

.integration-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.integration-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.integration-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.integration-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  color: white;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
}

.integration-details {
  display: flex;
  flex-direction: column;
}

.integration-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.integration-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.integration-status {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
}

.integration-status.connected {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-500);
}

.integration-status.disconnected {
  background: rgba(107, 114, 128, 0.2);
  color: var(--color-text-muted);
}

.integration-content {
  padding: var(--space-lg);
}

.integration-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.integration-actions {
  display: flex;
  gap: var(--space-sm);
}

/* ==========================================================================
   ANALYSIS SETTINGS
   ========================================================================== */

.analysis-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.analysis-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.category-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.category-content {
  padding: var(--space-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.algorithm-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.algorithm-option:hover {
  background: var(--color-surface);
}

.algorithm-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.algorithm-label input[type="radio"] {
  accent-color: var(--color-primary-500);
}

.algorithm-name {
  font-weight: var(--font-weight-medium);
}

.algorithm-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.metric-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.metric-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.metric-option input[type="checkbox"] {
  accent-color: var(--color-primary-500);
}

.metric-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.tda-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.tda-setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tda-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* ==========================================================================
   ADVANCED SETTINGS
   ========================================================================== */

.advanced-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.advanced-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.cache-settings,
.fallback-settings,
.experimental-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
}

.cache-setting,
.fallback-setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.experimental-settings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.feature-badge {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  background: var(--color-warning-500);
  color: white;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-bold);
  margin-left: auto;
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1200px) {
  .modules-container,
  .integrations-container {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 1024px) {
  .settings-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .settings-actions {
    width: 100%;
  }
  
  .settings-nav {
    flex-wrap: wrap;
  }
  
  .nav-item {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .nav-label {
    display: none;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .modules-container,
  .integrations-container {
    grid-template-columns: 1fr;
  }
  
  .tda-settings-grid {
    grid-template-columns: 1fr;
  }
  
  .metric-options {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .settings-title {
    font-size: var(--font-size-xl);
  }
  
  .settings-description {
    display: none;
  }
  
  .nav-icon {
    font-size: var(--font-size-lg);
  }
  
  .module-card {
    padding: var(--space-md);
  }
  
  .module-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }
  
  .module-info {
    gap: var(--space-sm);
  }
  
  .module-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .integration-card {
    padding: var(--space-md);
  }
  
  .integration-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }
  
  .integration-info {
    gap: var(--space-sm);
  }
  
  .integration-actions {
    width: 100%;
    flex-direction: column;
  }
  
  .integration-actions .btn {
    width: 100%;
  }
  
  .algorithm-option {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
  
  .metric-option {
    width: 100%;
  }
  
  .cache-settings,
  .fallback-settings {
    padding: var(--space-sm);
  }
  
  .experimental-settings {
    flex-direction: column;
  }
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ==========================================================================
   ACCESSIBILITY
   ========================================================================== */

:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* ==========================================================================
   REDUCED MOTION
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
