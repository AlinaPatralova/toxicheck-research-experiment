import { createRouter, createWebHistory } from 'vue-router';
import ResearchRootView from './research/views/ResearchRootView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', alias: '/research', name: 'research', component: ResearchRootView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 };
  }
});
