import { createApp } from '../vendor/vue.js';
import { createPinia } from '../vendor/pinia.js';
import ElementPlus from '../vendor/element-plus.js';


import * as ElementPlusIconsVue from '../vendor/element-plus-icons.js';

import App from './App.js';
// Enable Element Plus dark mode by default
document.documentElement.classList.add('dark');
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(ElementPlus);
// Register all Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}
app.mount('#app');
