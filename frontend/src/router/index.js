/**
 * COGNITIVE Frontend - Router Configuration
 * ============================================
 */

import { createRouter, createWebHistory } from 'vue-router';

// Import views
import HomeView from '../pages/HomeView.vue';
import OsintView from '../pages/osint/index.vue';
import GlobeView from '../pages/GlobeView.vue';
import FactoryView from '../pages/FactoryView.vue';
import SettingsView from '../pages/SettingsView.vue';

// Route definitions
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: 'Home - COGNITIVE',
      requiresAuth: false,
    },
  },
  {
    path: '/osint',
    name: 'osint',
    component: OsintView,
    meta: {
      title: 'OSINT - COGNITIVE',
      requiresAuth: true,
    },
    children: [
      {
        path: 'pipeline',
        name: 'osint-pipeline',
        component: () => import('../pages/osint/tabs/PipelineTab.vue'),
        meta: { title: 'Pipeline - COGNITIVE' },
      },
      {
        path: 'flowsint',
        name: 'osint-flowsint',
        component: () => import('../pages/osint/tabs/UiFlowsintTab.vue'),
        meta: { title: 'Flowsint - COGNITIVE' },
      },
      {
        path: 'tda',
        name: 'osint-tda',
        component: () => import('../pages/osint/tabs/TdaTab.vue'),
        meta: { title: 'TDA - COGNITIVE' },
      },
      {
        path: 'analytics',
        name: 'osint-analytics',
        component: () => import('../pages/osint/tabs/AnalyticsTab.vue'),
        meta: { title: 'Analytics - COGNITIVE' },
      },
      {
        path: 'settings',
        name: 'osint-settings',
        component: () => import('../pages/osint/tabs/SettingsTab.vue'),
        meta: { title: 'Settings - COGNITIVE' },
      },
    ],
  },
  {
    path: '/globe',
    name: 'globe',
    component: GlobeView,
    meta: {
      title: '3D Globe - COGNITIVE',
      requiresAuth: true,
    },
  },
  {
    path: '/factory',
    name: 'factory',
    component: FactoryView,
    meta: {
      title: 'AI Factory - COGNITIVE',
      requiresAuth: true,
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: 'Settings - COGNITIVE',
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginView.vue'),
    meta: {
      title: 'Login - COGNITIVE',
      requiresAuth: false,
      layout: 'auth',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../pages/RegisterView.vue'),
    meta: {
      title: 'Register - COGNITIVE',
      requiresAuth: false,
      layout: 'auth',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundView.vue'),
    meta: {
      title: '404 - COGNITIVE',
      requiresAuth: false,
    },
  },
];

// Create router
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0, behavior: 'smooth' };
  },
});

// Navigation guards
router.beforeEach((to, from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // Check authentication (placeholder - implement your auth logic)
  const isAuthenticated = true; // Replace with actual auth check
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } });
  }

  next();
});

router.afterEach((to, from) => {
  // Analytics or other post-navigation logic
});

// Error handler
router.onError((error) => {
  console.error('Router error:', error);
});

export default router;
