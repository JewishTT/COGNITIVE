<template>
  <div class="shell" :data-theme="isDark ? 'dark' : 'light'">
    <header class="shell-header">
      <div class="header-brand">
        <span class="brand-logo"></span>
        <span class="brand-divider"></span>
        <div class="brand-text">
          <span class="brand-word">COGNITIVE</span>
          <span class="brand-sub">PLATFORM // v{{ version }}</span>
        </div>
      </div>

      <nav class="shell-nav">
        <router-link v-for="item in nav" :key="item.path" :to="item.path"
          class="nav-link" :class="{ active: item.path === currentPath }">
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="header-right">
        <button class="h-search" @click="searchOpen = true" title="Поиск (Ctrl+K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span class="h-search-txt">Поиск…</span>
          <kbd class="h-kbd">Ctrl K</kbd>
        </button>

        <div class="sys-led" :class="sysStatus">
          <span class="led-dot"></span>
          <span class="led-label">{{ sysStatusLabel }}</span>
        </div>

        <span class="h-clock">{{ currentTime }}</span>

        <button class="h-icon" :title="isDark ? 'Светлая тема' : 'Тёмная тема'" @click="toggleTheme">
          <svg v-if="isDark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <ChatWindow />

        <div class="user" @click="toggleUserMenu">
          <span class="user-avatar">A</span>
        </div>

        <div v-if="userMenuOpen" class="user-menu" @click.stop>
          <div class="um-head">
            <span class="user-avatar lg">A</span>
            <div class="um-id">
              <div class="um-name">{{ userName }}</div>
              <div class="um-mail">{{ userEmail }}</div>
            </div>
          </div>
          <div class="um-sep"></div>
          <div class="um-item" @click="userMenuOpen = false">Профиль</div>
          <div class="um-item" @click="userMenuOpen = false">Настройки</div>
          <div class="um-sep"></div>
          <div class="um-item danger" @click="userMenuOpen = false">Выйти</div>
        </div>
      </div>
    </header>
    <div class="header-glow"></div>

    <main class="shell-content">
      <router-view />
    </main>

    <footer class="shell-footer">
      <span class="f-cell">COGNITIVE CORE</span>
      <span class="f-sep">·</span>
      <span class="f-cell mono">v{{ version }}</span>
      <span class="f-sep">·</span>
      <span class="f-cell mono">{{ currentTime }}</span>
      <span class="f-spacer"></span>
      <span class="f-status"><span class="f-led"></span>OPERATIONAL</span>
    </footer>

    <div v-if="searchOpen" class="cmd-overlay" @click.self="searchOpen = false">
      <div class="cmd-palette">
        <div class="cmd-head">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref="cmdInput" v-model="cmdQuery" placeholder="Поиск по платформе…" @keydown.enter="runCmd" />
          <kbd>ESC</kbd>
        </div>
        <div class="cmd-list">
          <a v-for="r in cmdResults" :key="r.path" class="cmd-item" :href="'#' + r.path" @click="closeCmd">
            <span class="cmd-kind">{{ r.kind }}</span>
            <span class="cmd-title">{{ r.title }}</span>
            <span class="cmd-path">{{ r.path }}</span>
          </a>
          <div v-if="!cmdResults.length" class="cmd-empty">Нет совпадений</div>
        </div>
        <div class="cmd-foot"><span><kbd>↵</kbd> открыть</span><span class="cmd-foot-brand">COGNITIVE</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import ChatWindow from '@/chat/components/ChatWindow.vue'

const route = useRoute()
const currentPath = computed(() => route.path)

const isDark = ref(true)
const userMenuOpen = ref(false)
const searchOpen = ref(false)
const cmdQuery = ref('')
const cmdInput = ref<HTMLInputElement | null>(null)
const userName = ref('Admin')
const userEmail = ref('admin@cognitive.ai')
const version = ref('2.1.0')
const currentTime = ref('')

const nav = [
  { path: '/', label: 'Обзор' },
  { path: '/globe', label: 'Глобус' },
  { path: '/osint', label: 'Осинт' },
  { path: '/factory', label: 'Фабрика' },
  { path: '/ecommerce', label: 'Проекты' },
]

const sysStatus = computed(() => (route.path === '/globe' ? 'busy' : 'ok'))
const sysStatusLabel = computed(() => (sysStatus.value === 'busy' ? 'Обработка' : 'В сети'))

const commands = [
  { path: '/', title: 'Обзор — командный центр', kind: 'ГЛАВ' },
  { path: '/globe', title: 'Глобус — 3D мониторинг', kind: '3D' },
  { path: '/osint', title: 'Осинт — граф расследований', kind: 'ОСНТ' },
  { path: '/factory', title: 'Фабрика — AI контент', kind: 'ФБРК' },
  { path: '/ecommerce', title: 'Проекты — коммерция', kind: 'ПРКТ' },
]

const cmdResults = computed(() => {
  const q = cmdQuery.value.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => (c.title + c.kind + c.path).toLowerCase().includes(q))
})

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme()
}

const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const toggleUserMenu = (e: Event) => { e.stopPropagation(); userMenuOpen.value = !userMenuOpen.value }
const closeMenu = () => { userMenuOpen.value = false }

const openCmd = () => { searchOpen.value = true; nextTick(() => cmdInput.value?.focus()) }
const closeCmd = () => { searchOpen.value = false; cmdQuery.value = '' }

const runCmd = (e: KeyboardEvent) => {
  e.preventDefault()
  if (!cmdResults.value.length) return
  window.location.hash = cmdResults.value[0].path
  closeCmd()
}

const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

const onKey = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd() }
  if (e.key === 'Escape') closeCmd()
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'dark'
  isDark.value = savedTheme === 'dark'
  applyTheme()
  updateTime()
  const interval = setInterval(updateTime, 1000)
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', onKey)
  onUnmounted(() => {
    clearInterval(interval)
    document.removeEventListener('click', closeMenu)
    document.removeEventListener('keydown', onKey)
  })
})
</script>

<style scoped>
.shell {
  --b: var(--border-default);
  --b2: var(--border-strong);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--fg-primary);
  font-family: var(--font-sans);
}

/* CYBER-PALANTIR frame accent under header */
.header-glow {
  height: 2px;
  flex-shrink: 0;
  background: linear-gradient(90deg, var(--accent), var(--accent-2), transparent 60%);
  opacity: 0.6;
}

/* ============ HEADER ============ */
.shell-header {
  height: 48px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 10px 0 0;
  background: var(--surface-1);
  border-bottom: 1px solid var(--b);
  position: sticky;
  top: 0;
  z-index: 40;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  padding: 0 18px;
  border-right: 1px solid var(--b);
  flex-shrink: 0;
}
.brand-logo {
  width: 14px;
  height: 22px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  border-radius: 1px;
  box-shadow: var(--glow-accent);
}
.brand-divider { width: 1px; height: 18px; background: var(--b2); }
.brand-text { display: flex; flex-direction: column; line-height: 1; }
.brand-word {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--fg-primary);
}
.brand-sub {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 1.5px;
  color: var(--fg-muted);
  text-transform: uppercase;
}

.shell-nav {
  display: flex;
  align-items: center;
  height: 100%;
  flex: 1;
  min-width: 0;
  gap: 2px;
  padding: 0 8px;
}
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-muted);
  text-decoration: none;
  white-space: nowrap;
  transition: color 150ms, background 150ms;
}
.nav-link:hover { color: var(--fg-secondary); background: var(--surface-2); }
.nav-link.active { color: var(--fg-primary); }
.nav-link.active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow-accent);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  border-left: 1px solid var(--b);
  flex-shrink: 0;
}

.h-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 8px;
  background: var(--surface-0);
  border: 1px solid var(--b);
  border-radius: 3px;
  color: var(--fg-muted);
  cursor: pointer;
  font-family: var(--font-sans);
  transition: border-color 150ms, box-shadow 150ms;
}
.h-search:hover { border-color: rgba(58, 160, 255, 0.4); box-shadow: 0 0 0 2px var(--accent-glow); }
.h-search-txt { font-size: 12px; }
.h-kbd {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--fg-muted);
  border: 1px solid var(--b2);
  border-radius: 2px;
  padding: 1px 4px;
}

.sys-led { display: flex; align-items: center; gap: 6px; padding: 0 8px; }
.led-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--status-success);
  box-shadow: var(--glow-status);
  animation: ledPulse 2.2s ease-in-out infinite;
}
.sys-led.busy .led-dot { background: var(--status-warning); box-shadow: 0 0 8px rgba(251,191,36,0.6); }
.led-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--fg-secondary);
  text-transform: uppercase;
}
.sys-led.busy .led-label { color: var(--status-warning); }
@keyframes ledPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

.h-clock {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-secondary);
  padding: 0 6px;
  letter-spacing: 0.5px;
}

.h-icon {
  width: 28px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent; border-radius: 3px;
  color: var(--fg-muted); cursor: pointer;
  transition: color 150ms, border-color 150ms, background 150ms;
}
.h-icon:hover { color: var(--fg-primary); background: var(--surface-2); border-color: var(--b); }

.user { display: flex; align-items: center; cursor: pointer; }
.user-avatar {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  color: var(--fg-secondary); background: var(--surface-2);
  border: 1px solid var(--b2); border-radius: 3px;
}
.user-avatar.lg { width: 30px; height: 30px; font-size: 12px; }

.user-menu {
  position: absolute; top: 48px; right: 8px; width: 220px;
  background: var(--surface-2); border: 1px solid var(--b2); border-radius: 4px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.45); z-index: 60;
}
.um-head { display: flex; align-items: center; gap: 10px; padding: 12px; }
.um-name { font-size: 12px; font-weight: 600; color: var(--fg-primary); }
.um-mail { font-size: 10px; color: var(--fg-muted); }
.um-sep { height: 1px; background: var(--b); }
.um-item {
  padding: 7px 12px; font-size: 11px; color: var(--fg-secondary);
  cursor: pointer; transition: background 150ms, color 150ms;
}
.um-item:hover { background: var(--surface-active); color: var(--fg-primary); }
.um-item.danger { color: var(--status-error); }
.um-item.danger:hover { background: color-mix(in srgb, var(--status-error) 10%, transparent); }

/* ============ CONTENT ============ */
.shell-content {
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
}

/* ============ FOOTER ============ */
.shell-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--b);
  background: var(--surface-1);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.6px;
  color: var(--fg-muted);
}
.f-cell { color: var(--fg-secondary); }
.f-cell.mono { color: var(--fg-muted); }
.f-sep { color: var(--b2); }
.f-spacer { flex: 1; }
.f-status { display: flex; align-items: center; gap: 6px; color: var(--status-success); letter-spacing: 1px; }
.f-led {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--status-success);
  box-shadow: var(--glow-status);
  animation: ledPulse 1.6s ease-in-out infinite;
}

/* ============ COMMAND PALETTE ============ */
.cmd-overlay {
  position: fixed; inset: 0;
  background: rgba(4, 8, 18, 0.6);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; z-index: 80;
}
.cmd-palette {
  width: 560px; max-width: 92vw;
  background: var(--surface-2);
  border: 1px solid var(--accent-2-glow);
  border-radius: 4px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5), var(--glow-accent);
  overflow: hidden;
}
.cmd-head {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--b);
  color: var(--fg-muted);
}
.cmd-head input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--fg-primary); font-family: var(--font-sans); font-size: 14px;
}
.cmd-head input::placeholder { color: var(--fg-muted); }
.cmd-head kbd, .cmd-foot kbd {
  font-family: var(--font-mono); font-size: 10px; color: var(--fg-secondary);
  border: 1px solid var(--b2); border-radius: 2px; padding: 1px 5px;
}
.cmd-list { max-height: 320px; overflow-y: auto; padding: 6px; }
.cmd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; text-decoration: none; color: var(--fg-secondary); cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.cmd-item:hover { background: var(--surface-active); color: var(--fg-primary); border-left-color: var(--accent); }
.cmd-kind {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.5px;
  padding: 2px 6px; border: 1px solid var(--b2); border-radius: 2px;
  color: var(--fg-muted); flex-shrink: 0;
}
.cmd-title { flex: 1; font-size: 12px; }
.cmd-path { font-family: var(--font-mono); font-size: 10px; color: var(--fg-muted); }
.cmd-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--fg-muted); }
.cmd-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 14px; border-top: 1px solid var(--b);
  font-size: 10px; color: var(--fg-muted);
}
.cmd-foot-brand {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 1px;
  color: var(--accent);
}

/* ============ LIGHT THEME ============ */
.shell[data-theme='light'] {
  --surface-0: #f5f6f8;
  --surface-1: #ffffff;
  --surface-2: #eceef1;
  --surface-active: #e1e4e9;
  --fg-primary: #16181d;
  --fg-secondary: #4a4f58;
  --fg-muted: #7a8089;
  --border-default: #e2e4e8;
  --border-strong: #c9cdd4;
}

@media (max-width: 768px) {
  .brand-sub { display: none; }
  .h-clock { display: none; }
  .sys-led .led-label { display: none; }
  .h-search-txt, .h-kbd { display: none; }
  .nav-link { padding: 0 10px; }
}
</style>
