import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import ShellLayout from './components/ShellLayout.vue';
import DashboardView from './views/DashboardView.vue';
import GlobeView from './views/GlobeView.vue';
import OsintView from './pages/osint/index.vue';
import FactoryView from './views/FactoryView.vue';
import EcommerceView from './views/EcommerceView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: ShellLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'globe', name: 'globe', component: GlobeView },
        { path: 'osint', name: 'osint', component: OsintView },
        { path: 'factory', name: 'factory', component: FactoryView },
        { path: 'ecommerce', name: 'ecommerce', component: EcommerceView },
        // Глубокое слияние: Flowsint больше не отдельная вкладка. Движок
        // (flowsint-api, Neo4j) — нативный слой раздела /osint.
        { path: 'flowsint', name: 'flowsint', redirect: '/osint' },
      ],
    },
  ],
});

createApp(App).use(router).mount('#platform-app');
