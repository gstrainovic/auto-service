import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const routes = [
  { path: '/', component: () => import('../pages/LandingPage.vue'), meta: { public: true } },
  { path: '/login', component: () => import('../pages/LoginPage.vue'), meta: { public: true } },
  { path: '/impressum', component: () => import('../pages/ImpressumPage.vue'), meta: { public: true } },
  { path: '/datenschutz', component: () => import('../pages/DatenschutzPage.vue'), meta: { public: true } },
  { path: '/dashboard', component: () => import('../pages/DashboardPage.vue') },
  { path: '/vehicles', component: () => import('../pages/VehiclesPage.vue') },
  { path: '/vehicles/:id', component: () => import('../pages/VehicleDetailPage.vue') },
  { path: '/scan', redirect: '/dashboard?chat=open' },
  { path: '/settings', component: () => import('../pages/SettingsPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash)
      return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const { user, authReady } = useAuth()
  await authReady

  // Eingeloggt + Landing Page → Dashboard
  if (user.value && to.path === '/')
    return '/dashboard'

  if (to.meta.public)
    return true

  // Nicht eingeloggt → Login
  if (!user.value)
    return '/login'

  return true
})

export default router
