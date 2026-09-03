<template>
  <div class="pipeline-tab">
    <!-- Pipeline Header with Glass Effect -->
    <div class="pipeline-header glass-card">
      <div class="pipeline-info">
        <h2 class="pipeline-title">
          <span class="title-icon"><UiIcon name="factory" :size="20" /></span>
          OSINT Конвейеры
        </h2>
        <p class="pipeline-description">
          Создание и управление конвейерами обработки данных.
          Автоматизация процессов обогащения и анализа.
        </p>
      </div>
      <div class="pipeline-actions">
        <button class="btn btn-primary" @click="createPipeline" :disabled="loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Новый конвейер
        </button>
      </div>
    </div>

    <!-- Quick Stats Bar -->
    <div class="pipeline-stats glass-card">
      <div class="stat-item">
        <div class="stat-icon"><UiIcon name="clipboard" :size="18" /></div>
        <div class="stat-info">
          <div class="stat-value">{{ pipelines.length }}</div>
          <div class="stat-label">Конвейеров</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-icon"><UiIcon name="checkCircle" :size="18" /></div>
        <div class="stat-info">
          <div class="stat-value">{{ activePipelines }}</div>
          <div class="stat-label">Активных</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-icon"><UiIcon name="timer" :size="18" /></div>
        <div class="stat-info">
          <div class="stat-value">{{ pendingTasks }}</div>
          <div class="stat-label">Задач в очереди</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-icon"><UiIcon name="chartBar" :size="18" /></div>
        <div class="stat-info">
          <div class="stat-value">{{ completedTasks }}</div>
          <div class="stat-label">Выполнено</div>
        </div>
      </div>
    </div>

    <!-- Pipeline Tabs -->
    <div class="pipeline-tabs glass-card">
      <button 
        v-for="tab in pipelineTabs" 
        :key="tab.id" 
        class="pipeline-tab" 
        :class="{ active: activePipelineTab === tab.id }"
        @click="activePipelineTab = tab.id"
      >
        <span class="tab-icon"><UiIcon :name="tab.icon" :size="15" /></span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Pipeline List View (Default) -->
    <div class="pipeline-content" v-if="activePipelineTab === 'list'">
      <div class="pipeline-list">
        <div class="pipeline-card glass-card" v-for="pipeline in pipelines" :key="pipeline.id">
          <div class="pipeline-card-header">
            <div class="pipeline-card-info">
              <div class="pipeline-name">
                <span class="pipeline-icon"><UiIcon :name="pipeline.icon" :size="16" /></span>
                <span>{{ pipeline.name }}</span>
              </div>
              <div class="pipeline-status" :class="pipeline.status">
                <span class="status-dot"></span>
                <span class="status-text">{{ statusLabels[pipeline.status] }}</span>
              </div>
            </div>
            <div class="pipeline-card-description">{{ pipeline.description }}</div>
            <div class="pipeline-card-meta">
              <div class="meta-item">
                <span class="meta-icon"><UiIcon name="calendar" :size="13" /></span>
                <span class="meta-text">{{ formatDate(pipeline.createdAt) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><UiIcon name="timer" :size="13" /></span>
                <span class="meta-text">{{ pipeline.duration }}с</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><UiIcon name="refresh" :size="13" /></span>
                <span class="meta-text">{{ pipeline.executions }}</span>
              </div>
            </div>
            <div class="pipeline-card-actions">
              <button class="action-btn" @click="runPipeline(pipeline.id)" :disabled="pipeline.status === 'running'" title="Запустить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                </svg>
              </button>
              <button class="action-btn" @click="editPipeline(pipeline.id)" title="Редактировать">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="action-btn" @click="duplicatePipeline(pipeline.id)" title="Дублировать">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button class="action-btn action-btn-danger" @click="deletePipeline(pipeline.id)" title="Удалить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline Editor (When Editing) -->
    <div class="pipeline-content" v-else-if="activePipelineTab === 'editor' && editingPipeline">
      <div class="pipeline-editor glass-card">
        <div class="editor-header">
          <div class="editor-title">
            <input 
              type="text" 
              v-model="editingPipeline.name" 
              class="form-input form-input-title" 
              placeholder="Название конвейера"
              :disabled="loading"
            />
          </div>
          <div class="editor-actions">
            <button class="btn btn-secondary" @click="cancelEdit" :disabled="loading">
              Отмена
            </button>
            <button class="btn btn-primary" @click="savePipeline" :disabled="loading">
              <span class="btn-icon animate-spin" v-if="loading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="60"/>
                </svg>
              </span>
              <span v-else>Сохранить</span>
            </button>
          </div>
        </div>
        
        <div class="editor-body">
          <div class="editor-section">
            <h4 class="section-title">Описание</h4>
            <textarea 
              v-model="editingPipeline.description" 
              class="form-textarea" 
              placeholder="Описание конвейера..."
              rows="3"
              :disabled="loading"
            ></textarea>
          </div>
          
          <div class="editor-section">
            <h4 class="section-title">Триггеры</h4>
            <div class="triggers-grid">
              <label class="trigger-option" v-for="trigger in triggers" :key="trigger.id">
                <input 
                  type="checkbox" 
                  v-model="editingPipeline.triggers" 
                  :value="trigger.id" 
                  :disabled="loading"
                />
                <span class="trigger-name">{{ trigger.name }}</span>
                <span class="trigger-description">{{ trigger.description }}</span>
              </label>
            </div>
          </div>
          
          <div class="editor-section">
            <h4 class="section-title">Шаги конвейера</h4>
            <div class="steps-container">
              <div class="step-list">
                <div 
                  class="step-item glass-card" 
                  v-for="(step, index) in editingPipeline.steps" 
                  :key="step.id"
                  :class="{ 'step-active': activeStepIndex === index }"
                  @click="activeStepIndex = index"
                >
                  <div class="step-header">
                    <span class="step-number">{{ index + 1 }}</span>
                    <span class="step-name">{{ step.name }}</span>
                    <span class="step-type badge" :class="`badge-${step.type}`">{{ step.type }}</span>
                  </div>
                  <div class="step-description">{{ step.description }}</div>
                </div>
              </div>
              
              <div class="step-actions">
                <button class="btn btn-secondary btn-sm" @click="addStep" :disabled="loading">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Добавить шаг
                </button>
                <button class="btn btn-danger btn-sm" @click="removeStep" :disabled="loading || editingPipeline.steps.length === 0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Удалить шаг
                </button>
              </div>
            </div>
          </div>
          
          <div class="editor-section" v-if="activeStepIndex !== null">
            <h4 class="section-title">Настройки шага</h4>
            <div class="step-settings">
              <div class="settings-grid">
                <div class="setting-group">
                  <label class="setting-label">Тип шага</label>
                  <select v-model="editingPipeline.steps[activeStepIndex].type" class="form-select" :disabled="loading">
                    <option value="enrichment">Обогащение</option>
                    <option value="filter">Фильтрация</option>
                    <option value="transform">Трансформация</option>
                    <option value="analysis">Анализ</option>
                    <option value="export">Экспорт</option>
                  </select>
                </div>
                <div class="setting-group">
                  <label class="setting-label">Название</label>
                  <input 
                    type="text" 
                    v-model="editingPipeline.steps[activeStepIndex].name" 
                    class="form-input" 
                    placeholder="Название шага"
                    :disabled="loading"
                  />
                </div>
                <div class="setting-group">
                  <label class="setting-label">Описание</label>
                  <input 
                    type="text" 
                    v-model="editingPipeline.steps[activeStepIndex].description" 
                    class="form-input" 
                    placeholder="Описание шага"
                    :disabled="loading"
                  />
                </div>
                <div class="setting-group">
                  <label class="setting-label">Модуль</label>
                  <select v-model="editingPipeline.steps[activeStepIndex].module" class="form-select" :disabled="loading">
                    <option value="">Выберите модуль</option>
                    <option v-for="module in availableModules" :key="module.id" :value="module.id">
                      {{ module.name }}
                    </option>
                  </select>
                </div>
              </div>
              
              <div class="step-parameters" v-if="editingPipeline.steps[activeStepIndex].module">
                <h5 class="parameters-title">Параметры</h5>
                <div class="parameters-grid">
                  <div 
                    class="parameter" 
                    v-for="param in getModuleParameters(editingPipeline.steps[activeStepIndex].module)" 
                    :key="param.id"
                  >
                    <label class="parameter-label">{{ param.name }}</label>
                    <input 
                      v-if="param.type === 'text' || param.type === 'number'" 
                      :type="param.type" 
                      v-model="param.value" 
                      class="form-input" 
                      :placeholder="param.placeholder"
                      :disabled="loading"
                    />
                    <select 
                      v-else-if="param.type === 'select'" 
                      v-model="param.value" 
                      class="form-select" 
                      :disabled="loading"
                    >
                      <option v-for="option in param.options" :key="option" :value="option">
                        {{ option }}
                      </option>
                    </select>
                    <label 
                      v-else-if="param.type === 'checkbox'" 
                      class="parameter-checkbox"
                    >
                      <input 
                        type="checkbox" 
                        v-model="param.value" 
                        :disabled="loading"
                      />
                      <span class="checkbox-label">{{ param.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline Execution View -->
    <div class="pipeline-content" v-else-if="activePipelineTab === 'executions'">
      <div class="executions-container">
        <div class="executions-header">
          <h3 class="executions-title">История выполнения</h3>
          <div class="executions-filters">
            <select v-model="executionFilter" class="form-select form-select-sm" @change="filterExecutions">
              <option value="all">Все</option>
              <option value="success">Успешные</option>
              <option value="failed">Неудачные</option>
              <option value="running">Выполняются</option>
            </select>
          </div>
        </div>
        
        <div class="executions-list">
          <div class="execution-card glass-card" v-for="execution in filteredExecutions" :key="execution.id">
            <div class="execution-header">
              <div class="execution-info">
                <span class="execution-name">{{ execution.pipelineName }}</span>
                <span class="execution-id">#{{ execution.id }}</span>
              </div>
              <div class="execution-status" :class="execution.status">
                <span class="status-dot"></span>
                <span class="status-text">{{ statusLabels[execution.status] }}</span>
              </div>
            </div>
            <div class="execution-details">
              <div class="detail-item">
                <span class="detail-label">Запущен:</span>
                <span class="detail-value">{{ formatDateTime(execution.startedAt) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Завершен:</span>
                <span class="detail-value">{{ execution.finishedAt ? formatDateTime(execution.finishedAt) : '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Длительность:</span>
                <span class="detail-value">{{ execution.duration }}с</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Обработано:</span>
                <span class="detail-value">{{ execution.processed }} сущностей</span>
              </div>
            </div>
            <div class="execution-actions" v-if="execution.status === 'failed'">
              <button class="btn btn-secondary btn-sm" @click="retryExecution(execution.id)" :disabled="loading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 1 21 5 21 19"/>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Повторить
              </button>
              <button class="btn btn-primary btn-sm" @click="viewExecution(execution.id)" :disabled="loading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Лог
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline Templates View -->
    <div class="pipeline-content" v-else-if="activePipelineTab === 'templates'">
      <div class="templates-container">
        <div class="templates-header">
          <h3 class="templates-title">Шаблоны конвейеров</h3>
          <button class="btn btn-primary btn-sm" @click="createTemplate" :disabled="loading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Новый шаблон
          </button>
        </div>
        
        <div class="templates-grid">
          <div class="template-card glass-card" v-for="template in templates" :key="template.id">
            <div class="template-header">
              <span class="template-icon">{{ template.icon }}</span>
              <div class="template-info">
                <h4 class="template-name">{{ template.name }}</h4>
                <p class="template-description">{{ template.description }}</p>
              </div>
            </div>
            <div class="template-meta">
              <span class="meta-badge">{{ template.category }}</span>
              <span class="meta-badge">{{ template.steps }} шагов</span>
            </div>
            <div class="template-actions">
              <button class="btn btn-secondary btn-sm" @click="useTemplate(template.id)" :disabled="loading">
                Использовать
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// State
const loading = ref(false)
const activePipelineTab = ref('list')
const editingPipeline = ref(null)
const activeStepIndex = ref(null)
const executionFilter = ref('all')

// Data
const pipelines = ref([
  {
    id: 'pipeline_1',
    icon: 'search',
    name: 'Поиск и обогащение',
    description: 'Автоматический поиск и обогащение сущностей из различных источников',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    duration: 120,
    executions: 42,
    triggers: ['manual', 'schedule'],
    steps: [
      { id: 'step_1', name: 'Поиск в Google', type: 'enrichment', module: 'google', description: 'Поиск сущностей в Google' },
      { id: 'step_2', name: 'Обогащение из Social Media', type: 'enrichment', module: 'social', description: 'Обогащение данными из соцсетей' },
      { id: 'step_3', name: 'Фильтрация дубликатов', type: 'filter', module: 'deduplication', description: 'Удаление дублирующихся данных' },
    ]
  },
  {
    id: 'pipeline_2',
    icon: 'chartBar',
    name: 'TDA Анализ',
    description: 'Топологический анализ данных с автоматическим обнаружение сообществ',
    status: 'active',
    createdAt: '2024-01-10T14:15:00Z',
    duration: 300,
    executions: 28,
    triggers: ['manual'],
    steps: [
      { id: 'step_1', name: 'TDA Вычисления', type: 'analysis', module: 'tda', description: 'Вычисление чисел Бетти и персистентности' },
      { id: 'step_2', name: 'Обнаружение сообществ', type: 'analysis', module: 'community', description: 'Обнаружение сообществ с помощью Louvain' },
      { id: 'step_3', name: 'Визуализация', type: 'transform', module: 'visualization', description: 'Создание визуализации результатов' },
    ]
  },
  {
    id: 'pipeline_3',
    icon: 'refresh',
    name: 'Регулярное обновление',
    description: 'Регулярное обновление данных из внешних источников',
    status: 'inactive',
    createdAt: '2024-01-05T09:00:00Z',
    duration: 60,
    executions: 156,
    triggers: ['schedule'],
    steps: [
      { id: 'step_1', name: 'Проверка обновлений', type: 'enrichment', module: 'updater', description: 'Проверка наличия обновлений' },
      { id: 'step_2', name: 'Скачивание данных', type: 'enrichment', module: 'downloader', description: 'Скачивание новых данных' },
      { id: 'step_3', name: 'Обработка', type: 'transform', module: 'processor', description: 'Обработка загруженных данных' },
      { id: 'step_4', name: 'Сохранение', type: 'export', module: 'saver', description: 'Сохранение обновленных данных' },
    ]
  },
  {
    id: 'pipeline_4',
    icon: 'alert',
    name: 'Мониторинг угроз',
    description: 'Мониторинг угроз в реальном времени',
    status: 'active',
    createdAt: '2024-01-20T08:00:00Z',
    duration: 90,
    executions: 89,
    triggers: ['manual', 'schedule', 'event'],
    steps: [
      { id: 'step_1', name: 'Сбор данных', type: 'enrichment', module: 'threat_intel', description: 'Сбор данных об угрозах' },
      { id: 'step_2', name: 'Анализ угроз', type: 'analysis', module: 'threat_analysis', description: 'Анализ собранных угроз' },
      { id: 'step_3', name: 'Уведомления', type: 'export', module: 'notifier', description: 'Отправка уведомлений о новых угрозах' },
    ]
  },
])

const executions = ref([
  {
    id: 'exec_1',
    pipelineId: 'pipeline_1',
    pipelineName: 'Поиск и обогащение',
    status: 'success',
    startedAt: '2024-01-20T10:30:00Z',
    finishedAt: '2024-01-20T10:32:00Z',
    duration: 120,
    processed: 452,
  },
  {
    id: 'exec_2',
    pipelineId: 'pipeline_2',
    pipelineName: 'TDA Анализ',
    status: 'success',
    startedAt: '2024-01-20T14:15:00Z',
    finishedAt: '2024-01-20T14:20:00Z',
    duration: 300,
    processed: 15420,
  },
  {
    id: 'exec_3',
    pipelineId: 'pipeline_3',
    pipelineName: 'Регулярное обновление',
    status: 'success',
    startedAt: '2024-01-20T09:00:00Z',
    finishedAt: '2024-01-20T09:01:00Z',
    duration: 60,
    processed: 234,
  },
  {
    id: 'exec_4',
    pipelineId: 'pipeline_1',
    pipelineName: 'Поиск и обогащение',
    status: 'failed',
    startedAt: '2024-01-19T16:45:00Z',
    finishedAt: '2024-01-19T16:46:30Z',
    duration: 90,
    processed: 0,
  },
  {
    id: 'exec_5',
    pipelineId: 'pipeline_4',
    pipelineName: 'Мониторинг угроз',
    status: 'success',
    startedAt: '2024-01-20T08:00:00Z',
    finishedAt: '2024-01-20T08:01:30Z',
    duration: 90,
    processed: 89,
  },
])

const templates = ref([
  {
    id: 'template_1',
    icon: 'search',
    name: 'Быстрое обогащение',
    description: 'Шаблон для быстрого обогащения данных из основных источников',
    category: 'Обогащение',
    steps: 3,
  },
  {
    id: 'template_2',
    icon: 'chartBar',
    name: 'Полный анализ',
    description: 'Полный анализ графа с TDA и обнаружение сообществ',
    category: 'Анализ',
    steps: 5,
  },
  {
    id: 'template_3',
    icon: 'refresh',
    name: 'Регулярная синхронизация',
    description: 'Шаблон для регулярной синхронизации данных',
    category: 'Синхронизация',
    steps: 4,
  },
  {
    id: 'template_4',
    icon: 'alert',
    name: 'Мониторинг безопасности',
    description: 'Шаблон для мониторинга безопасности в реальном времени',
    category: 'Безопасность',
    steps: 6,
  },
])

const triggers = ref([
  { id: 'manual', name: 'Ручной запуск', description: 'Запуск вручную пользователем' },
  { id: 'schedule', name: 'По расписанию', description: 'Автоматический запуск по расписанию' },
  { id: 'event', name: 'По событию', description: 'Запуск при возникновении события' },
  { id: 'api', name: 'Через API', description: 'Запуск через API запрос' },
])

const availableModules = ref([
  { id: 'google', name: 'Google Search', category: 'enrichment' },
  { id: 'social', name: 'Social Media', category: 'enrichment' },
  { id: 'threat_intel', name: 'Threat Intelligence', category: 'enrichment' },
  { id: 'deduplication', name: 'Deduplication', category: 'filter' },
  { id: 'normalization', name: 'Normalization', category: 'transform' },
  { id: 'tda', name: 'TDA Analysis', category: 'analysis' },
  { id: 'community', name: 'Community Detection', category: 'analysis' },
  { id: 'centrality', name: 'Centrality Analysis', category: 'analysis' },
  { id: 'neo4j', name: 'Neo4j Export', category: 'export' },
  { id: 'json', name: 'JSON Export', category: 'export' },
  { id: 'csv', name: 'CSV Export', category: 'export' },
])

// Computed properties
const activePipelines = computed(() => {
  return pipelines.value.filter(p => p.status === 'active').length
})

const pendingTasks = computed(() => {
  return executions.value.filter(e => e.status === 'running').length
})

const completedTasks = computed(() => {
  return executions.value.filter(e => e.status === 'success').length
})

const filteredExecutions = computed(() => {
  if (executionFilter.value === 'all') return executions.value
  return executions.value.filter(e => e.status === executionFilter.value)
})

// Pipeline tabs
const pipelineTabs = computed(() => [
  { id: 'list', label: 'Список', icon: 'clipboard', count: pipelines.value.length },
  { id: 'editor', label: 'Редактор', icon: 'edit', count: editingPipeline.value ? 1 : 0 },
  { id: 'executions', label: 'Выполнения', icon: 'timer', count: executions.value.length },
  { id: 'templates', label: 'Шаблоны', icon: 'fileText', count: templates.value.length },
])

// Status labels
const statusLabels = {
  active: 'Активен',
  inactive: 'Неактивен',
  running: 'Выполняется',
  success: 'Успешно',
  failed: 'Ошибка',
  paused: 'Приостановлен',
}

// Actions
const createPipeline = () => {
  editingPipeline.value = {
    id: `pipeline_${Date.now()}`,
    icon: 'factory',
    name: 'Новый конвейер',
    description: '',
    status: 'inactive',
    createdAt: new Date().toISOString(),
    duration: 0,
    executions: 0,
    triggers: [],
    steps: [],
  }
  activePipelineTab.value = 'editor'
}

const editPipeline = (pipelineId: string) => {
  const pipeline = pipelines.value.find(p => p.id === pipelineId)
  if (pipeline) {
    editingPipeline.value = JSON.parse(JSON.stringify(pipeline))
    activePipelineTab.value = 'editor'
  }
}

const duplicatePipeline = (pipelineId: string) => {
  const pipeline = pipelines.value.find(p => p.id === pipelineId)
  if (pipeline) {
    const duplicate = JSON.parse(JSON.stringify(pipeline))
    duplicate.id = `pipeline_${Date.now()}`
    duplicate.name = `${pipeline.name} (копия)`
    pipelines.value.push(duplicate)
  }
}

const deletePipeline = (pipelineId: string) => {
  if (confirm('Удалить этот конвейер?')) {
    pipelines.value = pipelines.value.filter(p => p.id !== pipelineId)
    if (editingPipeline.value?.id === pipelineId) {
      editingPipeline.value = null
      activePipelineTab.value = 'list'
    }
  }
}

const runPipeline = (pipelineId: string) => {
  const pipeline = pipelines.value.find(p => p.id === pipelineId)
  if (pipeline) {
    pipeline.status = 'running'
    // Simulate execution
    setTimeout(() => {
      pipeline.status = 'active'
      executions.value.push({
        id: `exec_${Date.now()}`,
        pipelineId,
        pipelineName: pipeline.name,
        status: 'success',
        startedAt: new Date().toISOString(),
        finishedAt: new Date(Date.now() + pipeline.duration * 1000).toISOString(),
        duration: pipeline.duration,
        processed: Math.floor(Math.random() * 1000),
      })
    }, pipeline.duration * 1000)
  }
}

const savePipeline = () => {
  if (!editingPipeline.value) return
  
  loading.value = true
  
  // Save logic
  setTimeout(() => {
    const index = pipelines.value.findIndex(p => p.id === editingPipeline.value?.id)
    if (index !== -1) {
      pipelines.value[index] = editingPipeline.value
    } else {
      pipelines.value.push(editingPipeline.value)
    }
    
    editingPipeline.value = null
    activePipelineTab.value = 'list'
    loading.value = false
  }, 500)
}

const cancelEdit = () => {
  editingPipeline.value = null
  activeStepIndex.value = null
  activePipelineTab.value = 'list'
}

const addStep = () => {
  if (!editingPipeline.value) return
  
  editingPipeline.value.steps.push({
    id: `step_${Date.now()}`,
    name: 'Новый шаг',
    type: 'enrichment',
    module: '',
    description: '',
  })
  activeStepIndex.value = editingPipeline.value.steps.length - 1
}

const removeStep = () => {
  if (!editingPipeline.value || activeStepIndex.value === null) return
  
  editingPipeline.value.steps.splice(activeStepIndex.value, 1)
  activeStepIndex.value = null
}

const filterExecutions = () => {
  // Filter logic
}

const retryExecution = (executionId: string) => {
  const execution = executions.value.find(e => e.id === executionId)
  if (execution) {
    execution.status = 'running'
    execution.startedAt = new Date().toISOString()
    execution.finishedAt = null
    
    // Simulate re-execution
    setTimeout(() => {
      execution.status = 'success'
      execution.finishedAt = new Date().toISOString()
      execution.duration = Math.floor(Math.random() * 300)
    }, 2000)
  }
}

const viewExecution = (executionId: string) => {
  // View execution log
}

const createTemplate = () => {
  // Create new template
}

const useTemplate = (templateId: string) => {
  const template = templates.value.find(t => t.id === templateId)
  if (template) {
    // Use template to create new pipeline
    createPipeline()
    // Would populate with template data
  }
}

// Module parameters
const moduleParameters = {
  google: [
    { id: 'query', name: 'Запрос', type: 'text', placeholder: 'Введите поисковый запрос', value: '' },
    { id: 'limit', name: 'Лимит результатов', type: 'number', placeholder: '10', value: 10 },
    { id: 'language', name: 'Язык', type: 'select', options: ['ru', 'en', 'all'], value: 'ru' },
  ],
  social: [
    { id: 'platform', name: 'Платформа', type: 'select', options: ['all', 'twitter', 'facebook', 'linkedin', 'instagram'], value: 'all' },
    { id: 'depth', name: 'Глубина поиска', type: 'number', placeholder: '1', value: 1 },
    { id: 'includeFollowers', name: 'Включить подписчиков', type: 'checkbox', value: false },
  ],
  tda: [
    { id: 'dimension', name: 'Размерность', type: 'select', options: ['2', '3'], value: '2' },
    { id: 'radius', name: 'Радиус', type: 'number', placeholder: '1.0', value: 1.0 },
    { id: 'includeBarcode', name: 'Включить Barcode', type: 'checkbox', value: true },
    { id: 'includePersistence', name: 'Включить персистентность', type: 'checkbox', value: true },
  ],
  community: [
    { id: 'algorithm', name: 'Алгоритм', type: 'select', options: ['louvain', 'leiden', 'labelPropagation'], value: 'louvain' },
    { id: 'resolution', name: 'Разрешение', type: 'number', placeholder: '1.0', value: 1.0 },
    { id: 'maxIterations', name: 'Макс. итераций', type: 'number', placeholder: '100', value: 100 },
  ],
}

const getModuleParameters = (moduleId: string) => {
  return moduleParameters[moduleId as keyof typeof moduleParameters] || []
}

// Formatters
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Initialize
onMounted(() => {
  // Load pipelines from API or storage
})
</script>

<style scoped>
/* ==========================================================================
   PIPELINE TAB - PREMIUM DESIGN
   ========================================================================== */

.pipeline-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--space-lg);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.pipeline-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
  padding: var(--space-lg);
}

.pipeline-info {
  flex: 1;
}

.pipeline-title {
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

.pipeline-description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 600px;
}

.pipeline-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* ==========================================================================
   STATS BAR
   ========================================================================== */

.pipeline-stats {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.stat-icon {
  font-size: var(--font-size-lg);
}

.stat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary-400);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
}

/* ==========================================================================
   PIPELINE TABS
   ========================================================================== */

.pipeline-tabs {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.pipeline-tab {
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

.pipeline-tab:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.pipeline-tab.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-500);
}

.tab-icon {
  font-size: var(--font-size-base);
}

.tab-count {
  font-size: var(--font-size-xs);
  padding: 0 var(--space-xs);
  background: var(--color-primary-500);
  color: white;
  border-radius: var(--radius-full);
  margin-left: auto;
}

/* ==========================================================================
   PIPELINE CONTENT
   ========================================================================== */

.pipeline-content {
  flex: 1;
  min-height: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  overflow-y: auto;
}

/* ==========================================================================
   PIPELINE LIST
   ========================================================================== */

.pipeline-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-lg);
}

.pipeline-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  transition: all var(--transition-fast);
}

.pipeline-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-lg);
  transform: translateY(-5px);
}

.pipeline-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.pipeline-card-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.pipeline-name {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.pipeline-icon {
  font-size: var(--font-size-xl);
}

.pipeline-card-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  margin-bottom: var(--space-md);
}

.pipeline-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
}

.pipeline-status.active {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-500);
}

.pipeline-status.inactive {
  background: rgba(107, 114, 128, 0.2);
  color: var(--color-text-muted);
}

.pipeline-status.running {
  background: rgba(59, 130, 246, 0.2);
  color: var(--color-primary-500);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pipeline-status.active .status-dot {
  background: var(--color-success-500);
  animation: pulse 2s ease-in-out infinite;
}

.pipeline-status.inactive .status-dot {
  background: var(--color-text-muted);
}

.pipeline-status.running .status-dot {
  background: var(--color-primary-500);
  animation: pulse 2s ease-in-out infinite;
}

.pipeline-card-meta {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.meta-icon {
  font-size: var(--font-size-sm);
}

.pipeline-card-actions {
  display: flex;
  gap: var(--space-xs);
}

.action-btn {
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

.action-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-light);
  color: var(--color-text);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--color-danger-500);
  color: var(--color-danger-500);
}

/* ==========================================================================
   PIPELINE EDITOR
   ========================================================================== */

.pipeline-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.editor-title {
  flex: 1;
}

.editor-title input {
  width: 100%;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  background: transparent;
  border: none;
  padding: 0;
}

.editor-title input:focus {
  outline: none;
  border-bottom: 2px solid var(--color-primary-500);
}

.editor-actions {
  display: flex;
  gap: var(--space-sm);
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.triggers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.trigger-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.trigger-option:hover {
  background: var(--color-surface);
  border-color: var(--color-border-light);
}

.trigger-option input[type="checkbox"] {
  accent-color: var(--color-primary-500);
}

.trigger-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.trigger-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Steps */
.steps-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.step-item {
  padding: var(--space-md);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.step-item:hover {
  background: var(--color-surface);
  border-color: var(--color-border-light);
}

.step-item.step-active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--color-primary-500);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.step-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-500);
  color: white;
  border-radius: 50%;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.step-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.step-type {
  margin-left: auto;
}

.step-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.step-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Step Settings */
.step-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.parameters-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-md);
}

.parameters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.parameter {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.parameter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.parameter-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.parameter-checkbox input[type="checkbox"] {
  accent-color: var(--color-primary-500);
}

/* ==========================================================================
   EXECUTIONS
   ========================================================================== */

.executions-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.executions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.executions-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.executions-filters {
  display: flex;
  gap: var(--space-sm);
}

.executions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.execution-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.execution-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.execution-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.execution-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.execution-id {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.execution-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.detail-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.execution-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

/* ==========================================================================
   TEMPLATES
   ========================================================================== */

.templates-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.templates-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.template-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  transition: all var(--transition-fast);
}

.template-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-lg);
  transform: translateY(-5px);
}

.template-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.template-icon {
  font-size: var(--font-size-2xl);
}

.template-info {
  display: flex;
  flex-direction: column;
}

.template-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.template-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}

.template-meta {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.meta-badge {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
}

.template-actions {
  display: flex;
  justify-content: flex-end;
}

/* ==========================================================================
   BADGES
   ========================================================================== */

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-enrichment {
  background: rgba(59, 130, 246, 0.2);
  color: var(--color-primary-400);
}

.badge-filter {
  background: rgba(245, 158, 11, 0.2);
  color: var(--color-warning-400);
}

.badge-transform {
  background: rgba(142, 68, 173, 0.2);
  color: var(--color-accent-3);
}

.badge-analysis {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-400);
}

.badge-export {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-danger-400);
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1200px) {
  .pipeline-list {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
  
  .templates-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}

@media (max-width: 1024px) {
  .pipeline-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .pipeline-description {
    display: none;
  }
  
  .pipeline-stats {
    flex-wrap: wrap;
  }
  
  .stat-divider {
    display: none;
  }
  
  .stat-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
  
  .pipeline-list {
    grid-template-columns: 1fr;
  }
  
  .pipeline-card-meta {
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  
  .pipeline-card-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .triggers-grid {
    flex-direction: column;
  }
  
  .steps-container {
    flex-direction: column;
  }
  
  .step-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .parameters-grid {
    grid-template-columns: 1fr;
  }
  
  .execution-details {
    grid-template-columns: 1fr;
  }
  
  .execution-actions {
    width: 100%;
  }
  
  .templates-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .pipeline-title {
    font-size: var(--font-size-xl);
  }
  
  .pipeline-stats {
    gap: var(--space-sm);
  }
  
  .stat-item {
    padding: var(--space-xs);
  }
  
  .stat-value {
    font-size: var(--font-size-base);
  }
  
  .pipeline-tab {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .tab-label {
    display: none;
  }
  
  .pipeline-card {
    padding: var(--space-md);
  }
  
  .pipeline-card-actions {
    flex-wrap: wrap;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
  }
  
  .editor-title input {
    font-size: var(--font-size-lg);
  }
  
  .editor-actions {
    width: 100%;
    flex-direction: column;
  }
  
  .editor-actions .btn {
    width: 100%;
  }
  
  .step-item {
    padding: var(--space-sm);
  }
  
  .step-header {
    flex-wrap: wrap;
  }
  
  .step-number {
    width: 24px;
    height: 24px;
    font-size: var(--font-size-xs);
  }
  
  .step-name {
    font-size: var(--font-size-sm);
  }
  
  .step-type {
    display: none;
  }
  
  .step-description {
    display: none;
  }
  
  .execution-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }
  
  .execution-actions {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .execution-actions .btn {
    width: 100%;
  }
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

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
