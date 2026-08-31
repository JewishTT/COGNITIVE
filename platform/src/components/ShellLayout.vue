<template>
  <div class="shell">
    <!-- [38;5;240mPremium Header with Glass Effect[0m -->
    <header class="shell-header glass">
      <div class="shell-brand">
        <div class="shell-logo-container">
          <span class="shell-logo neon neon-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
            </svg>
          </span>
          <span class="shell-logo-text">COGNITIVE</span>
        </div>
        <div class="shell-brand-info">
          <strong class="shell-brand-name">[38;5;240mПлатформа[0m</strong>
          <small class="shell-brand-subtitle">[38;5;240mКомандный центр OSINT[0m</small>
        </div>
        <div class="shell-scanner">
          <div class="scanner-line"></div>
        </div>
      </div>

      <!-- [38;5;240mNavigation with Hover Effects[0m -->
      <nav class="shell-nav" aria-label="Разделы платформы">
        <router-link
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="shell-link"
          :class="{ active: item.path === currentPath }"
          :title="item.title"
        >
          <span class="shell-link-icon">{{ item.icon }}</span>
          <span class="shell-link-label">{{ item.label }}</span>
          <span v-if="item.dot" class="shell-nav-dot" :class="`dot-${item.dot}`"></span>
        </router-link>
      </nav>

      <!-- [38;5;240mControl Center[0m -->
      <div class="shell-ctrl">
        <div class="ctrl-actions">
          <!-- Theme Toggle -->
          <button 
            class="ctrl-btn tooltip-wrapper"
            @click="toggleTheme"
            :title="isDark ? 'Светлая тема' : 'Темная тема'"
          >
            <span class="ctrl-icon">
              <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </span>
          </button>
          
          <!-- Notifications -->
          <button class="ctrl-btn tooltip-wrapper" title="Уведомления">
            <span class="ctrl-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </span>
            <span v-if="notifications > 0" class="ctrl-badge">{{ notifications }}</span>
          </button>
          
          <!-- User Menu -->
          <div class="ctrl-user dropdown">
            <button class="user-btn dropdown-trigger" @click="toggleUserMenu">
              <div class="user-avatar">
                <span class="avatar-fallback">{{ userInitials }}</span>
              </div>
              <div class="user-info">
                <span class="user-name">{{ userName }}</span>
                <span class="user-role">{{ userRole }}</span>
              </div>
              <span class="user-chevron">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </span>
            </button>
            
            <div class="dropdown-menu dropdown-menu-right" :class="{ open: userMenuOpen }">
              <div class="dropdown-header">
                <div class="user-card">
                  <div class="user-card-avatar">
                    <span class="avatar-fallback avatar-lg">{{ userInitials }}</span>
                  </div>
                  <div class="user-card-info">
                    <div class="user-card-name">{{ userName }}</div>
                    <div class="user-card-email">{{ userEmail }}</div>
                  </div>
                </div>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item" @click="navigateToProfile">
                <span class="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                Профиль
              </div>
              <div class="dropdown-item" @click="navigateToSettings">
                <span class="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </span>
                Настройки
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item dropdown-item-danger" @click="logout">
                <span class="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                Выйти
              </div>
            </div>
          </div>
        </div>
        
        <!-- [38;5;240mAI Chat Toggle[0m -->
        <ChatWindow />
      </div>
    </header>

    <!-- [38;5;240mMain Content Area[0m -->
    <main class="shell-content">
      <router-view />
    </main>

    <!-- [38;5;240mPremium Footer[0m -->
    <footer class="shell-footer glass">
      <div class="footer-left">
        <span class="footer-version">v{{ version }}</span>
        <span class="footer-divider">|</span>
        <span class="footer-timestamp">{{ currentTime }}</span>
      </div>
      <div class="footer-center">
        <span class="footer-status">
          <span class="status-dot online"></span>
          Все системы работают
        </span>
      </div>
      <div class="footer-right">
        <a href="#" class="footer-link" @click.prevent="showDocs">Документация</a>
        <a href="#" class="footer-link" @click.prevent="showSupport">Поддержка</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChatWindow from '@/chat/components/ChatWindow.vue'

const route = useRoute()
const router = useRouter()
const currentPath = computed(() => route.path)

// Theme state
const isDark = ref(true)
const userMenuOpen = ref(false)
const notifications = ref(3)

// User state
const userName = ref('Администратор')
const userEmail = ref('admin@cognitive.ai')
const userRole = ref('Super Admin')
const userInitials = computed(() => {
  return userName.value.split(' ').map(n => n[0]).join('').toUpperCase()
})

// Platform info
const version = ref('2.0.0')
const currentTime = ref('')

// Navigation items
const nav = [
  { 
    path: '/', 
    label: 'Дашборд', 
    icon: '[38;5;240m🏠[0m', 
    title: 'Центр управления и аналитики', 
    dot: 'success' 
  },
  { 
    path: '/globe', 
    label: 'Глобус', 
    icon: '[38;5;240m🌍[0m', 
    title: '3D визуализация данных', 
    dot: 'info' 
  },
  { 
    path: '/osint', 
    label: 'OSINT', 
    icon: '[38;5;240m🔍[0m', 
    title: 'Расследования и анализ данных', 
    dot: 'warning' 
  },
  { 
    path: '/factory', 
    label: 'Фабрика', 
    icon: '[38;5;240m🏭[0m', 
    title: 'AI конвейеры и автоматизация', 
    dot: 'success' 
  },
  { 
    path: '/ecommerce', 
    label: 'Коммерция', 
    icon: '[38;5;240m💰[0m', 
    title: 'Мониторинг транзакций', 
    dot: '' 
  },
]

// Theme toggle
const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// User menu toggle
const toggleUserMenu = (e: Event) => {
  e.stopPropagation()
  userMenuOpen.value = !userMenuOpen.value
}

// Close user menu on outside click
const closeUserMenu = () => {
  userMenuOpen.value = false
}

// Navigation handlers
const navigateToProfile = () => {
  userMenuOpen.value = false
  router.push('/profile')
}

const navigateToSettings = () => {
  userMenuOpen.value = false
  router.push('/settings')
}

const logout = () => {
  userMenuOpen.value = false
  router.push('/login')
}

// Footer handlers
const showDocs = () => {
  window.open('https://docs.cognitive.ai', '_blank')
}

const showSupport = () => {
  window.open('https://support.cognitive.ai', '_blank')
}

// Update time
const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Lifecycle hooks
onMounted(() => {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'dark'
  isDark.value = savedTheme === 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
  
  // Start time update
  updateTime()
  const timeInterval = setInterval(updateTime, 1000)
  
  // Close menu on outside click
  document.addEventListener('click', closeUserMenu)
  
  onUnmounted(() => {
    clearInterval(timeInterval)
    document.removeEventListener('click', closeUserMenu)
  })
})

// Prevent click propagation in dropdown
const stopPropagation = (e: Event) => {
  e.stopPropagation()
}
</script>

<style scoped>
/* ==========================================================================
   SHELL LAYOUT - PREMIUM DESIGN
   ========================================================================== */

.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-background);
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.shell-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: 0 var(--space-xl);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: var(--z-fixed);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

.shell-logo-container {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.shell-logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-xl);
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
}

.shell-logo-text {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
  letter-spacing: -0.5px;
}

.shell-brand-info {
  display: flex;
  flex-direction: column;
}

.shell-brand-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  letter-spacing: -0.25px;
}

.shell-brand-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shell-scanner {
  position: relative;
  width: 40px;
  height: 20px;
  overflow: hidden;
}

.scanner-line {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--gradient-aurora);
  animation: scan 2s linear infinite;
  opacity: 0.6;
}

@keyframes scan {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* ==========================================================================
   NAVIGATION
   ========================================================================== */

.shell-nav {
  display: flex;
  gap: var(--space-xs);
  flex: 1;
  max-width: 600px;
}

.shell-link {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.shell-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--gradient-primary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.shell-link:hover {
  color: var(--color-text);
  background: rgba(59, 130, 246, 0.1);
}

.shell-link:hover::before {
  opacity: 0.1;
}

.shell-link.active {
  color: var(--color-primary-400);
  background: rgba(59, 130, 246, 0.15);
}

.shell-link.active::before {
  opacity: 0.2;
}

.shell-link-icon {
  font-size: var(--font-size-base);
}

.shell-link-label {
  font-size: var(--font-size-sm);
}

.shell-nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
}

.dot-success { background: var(--color-success-500); box-shadow: 0 0 10px var(--color-success-500); }
.dot-warning { background: var(--color-warning-500); box-shadow: 0 0 10px var(--color-warning-500); }
.dot-info { background: var(--color-info-500); box-shadow: 0 0 10px var(--color-info-500); }
.dot-danger { background: var(--color-danger-500); box-shadow: 0 0 10px var(--color-danger-500); }
.dot-yellow { background: var(--color-warning-400); box-shadow: 0 0 10px var(--color-warning-400); }
.dot-green { background: var(--color-success-400); box-shadow: 0 0 10px var(--color-success-400); }

/* ==========================================================================
   CONTROL CENTER
   ========================================================================== */

.shell-ctrl {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.ctrl-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.ctrl-btn {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ctrl-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
  border-color: var(--color-border-light);
  transform: scale(1.05);
}

.ctrl-btn:active {
  transform: scale(0.95);
}

.ctrl-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctrl-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: var(--color-danger-500);
  color: white;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-surface);
}

/* ==========================================================================
   USER MENU
   ========================================================================== */

.ctrl-user {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-light);
}

.user-avatar {
  width: 36px;
  height: 36px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.user-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.user-chevron {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.ctrl-user.open .user-chevron {
  transform: rotate(180deg);
}

.dropdown-menu {
  min-width: 280px;
  padding: var(--space-sm);
  animation: fadeInScale var(--transition-normal);
}

.dropdown-menu.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-header {
  padding: var(--space-sm);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
}

.user-card-avatar {
  width: 48px;
  height: 48px;
}

.user-card-info {
  display: flex;
  flex-direction: column;
}

.user-card-name {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
}

.user-card-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.dropdown-item-danger {
  color: var(--color-danger-500);
}

.dropdown-item-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dropdown-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-sm) 0;
}

/* ==========================================================================
   MAIN CONTENT
   ========================================================================== */

.shell-content {
  flex: 1;
  padding: var(--space-xl);
  overflow-y: auto;
}

/* ==========================================================================
   FOOTER
   ========================================================================== */

.shell-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.footer-left,
.footer-center,
.footer-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.footer-version {
  font-weight: var(--font-weight-medium);
}

.footer-divider {
  color: var(--color-border);
}

.footer-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.online {
  background: var(--color-success-500);
  animation: pulse 2s ease-in-out infinite;
}

.footer-link {
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.footer-link:hover {
  color: var(--color-primary-400);
}

/* ==========================================================================
   RESPONSIVE DESIGN
   ========================================================================== */

@media (max-width: 1024px) {
  .shell-header {
    gap: var(--space-md);
  }
  
  .shell-brand-info {
    display: none;
  }
  
  .shell-nav {
    display: none;
  }
  
  .shell-ctrl {
    gap: var(--space-xs);
  }
  
  .user-info {
    display: none;
  }
}

@media (max-width: 640px) {
  .shell-header {
    padding: 0 var(--space-md);
  }
  
  .shell-content {
    padding: var(--space-md);
  }
  
  .shell-footer {
    flex-direction: column;
    gap: var(--space-sm);
    text-align: center;
  }
  
  .footer-left,
  .footer-center,
  .footer-right {
    justify-content: center;
  }
}

/* ==========================================================================
   NEON EFFECT
   ========================================================================== */

.neon {
  position: relative;
}

.neon-primary::before,
.neon-primary::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  z-index: -1;
}

.neon-primary::before {
  background: var(--color-primary-500);
  filter: blur(10px);
  opacity: 0.3;
}

.neon-primary::after {
  background: var(--color-primary-400);
  filter: blur(20px);
  opacity: 0.1;
}

/* ==========================================================================
   GLASS EFFECT
   ========================================================================== */

.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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
