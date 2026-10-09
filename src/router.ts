import { createRouter, createWebHistory } from 'vue-router'

import { loadSession, session } from './session'
import HomeView from './views/HomeView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /** Full-screen views hide the navigation bar. */
    fullscreen?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue') },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('./views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('./views/ProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // No id: a new ship.
      path: '/editor/:id?',
      name: 'editor',
      component: () => import('./views/EditorView.vue'),
      meta: { requiresAuth: true, fullscreen: true },
    },
    { path: '/game', name: 'game', component: () => import('./views/GameView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  await loadSession()
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
