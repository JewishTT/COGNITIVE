<script setup>
/**
 * COGNITIVE - Root Application Component
 * ========================================
 */

import { useRouter } from 'vue-router';
import { useDark, useToggle } from '@vueuse/core';

const router = useRouter();
const isDark = useDark();
const toggleDark = useToggle(isDark);
</script>

<template>
  <div class="app-container" :class="{ 'dark-mode': isDark }">
    <!-- Shell Layout with Header and Navigation -->
    <div class="app-shell">
      <!-- Header -->
      <header class="app-header">
        <div class="header-content">
          <!-- Logo -->
          <div class="logo">
            <img src="/public/logo.svg" alt="COGNITIVE" class="logo-image" />
            <span class="logo-text">COGNITIVE</span>
          </div>
          
          <!-- Navigation -->
          <nav class="nav">
            <router-link to="/" class="nav-link">
              <span class="nav-icon">🏠</span>
              <span>Home</span>
            </router-link>
            <router-link to="/osint" class="nav-link">
              <span class="nav-icon">🔍</span>
              <span>OSINT</span>
            </router-link>
            <router-link to="/globe" class="nav-link">
              <span class="nav-icon">🌍</span>
              <span>Globe</span>
            </router-link>
            <router-link to="/factory" class="nav-link">
              <span class="nav-icon">🏭</span>
              <span>Factory</span>
            </router-link>
            <router-link to="/settings" class="nav-link">
              <span class="nav-icon">⚙️</span>
              <span>Settings</span>
            </router-link>
          </nav>
          
          <!-- User Menu -->
          <div class="user-menu">
            <button class="btn btn-icon" @click="toggleDark()" title="Toggle Dark Mode">
              <span v-if="isDark">☀️</span>
              <span v-else>🌙</span>
            </button>
            <button class="btn btn-primary">
              <span class="btn-icon">👤</span>
              <span>Account</span>
            </button>
          </div>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      
      <!-- Footer -->
      <footer class="app-footer">
        <div class="footer-content">
          <p>© 2024 COGNITIVE Platform</p>
          <p class="version">v1.0.0</p>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* App Container */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Shell Layout */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header */
.app-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0.75rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-image {
  width: 32px;
  height: 32px;
  filter: var(--logo-filter);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.05em;
}

/* Navigation */
.nav {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-link.router-link-exact-active {
  background: var(--bg-tertiary);
  color: var(--accent-primary);
}

.nav-icon {
  font-size: 1.1rem;
}

/* User Menu */
.user-menu {
  display: flex;
  gap: 0.75rem;
}

/* Main Content */
.app-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* Footer */
.app-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 1rem 1.5rem;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.version {
  color: var(--text-tertiary);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .nav {
    order: 3;
    width: 100%;
    justify-content: center;
    gap: 0.25rem;
  }
  
  .nav-link {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
  
  .user-menu {
    order: 2;
  }
  
  .app-main {
    padding: 1rem;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
