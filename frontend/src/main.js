/**
 * COGNITIVE Frontend - Main Entry Point
 * ======================================
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Import global styles
import './styles/main.css';
import './styles/animations.css';
import './styles/components.css';

// Create app
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error handler:', err);
  console.error('Instance:', instance);
  console.error('Info:', info);
  
  // You can add error reporting here
  // e.g., Sentry.captureException(err);
};

// Global warning handler
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Global warning handler:', msg);
  if (trace) {
    console.warn('Trace:', trace);
  }
};

// Global properties
app.config.globalProperties.$appName = 'COGNITIVE';
app.config.globalProperties.$version = '1.0.0';

// Mount app
app.mount('#app');

// Export for testing
export { app };
