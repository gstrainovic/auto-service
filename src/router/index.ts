import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const routes = [
  { path: '/login', component: () => import('../pages/LoginPage.vue'), meta: { public: true } },
  { path: '/', component: () => import('../pages/DashboardPage.vue') },
  { path: '/vehicles', component: () => import('../pages/VehiclesPage.vue') },
  { path: '/vehicles/:id', component: () => import('../pages/VehicleDetailPage.vue') },
  { path: '/scan', redirect: '/?chat=open' },
  { path: '/settings', component: () => import('../pages/SettingsPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public)
    return true

  const { user, authReady } = useAuth()

  // Warten bis Auth-State bekannt ist
  await authReady

  // Nicht eingeloggt → Login
  if (!user.value)
    return '/login'

  return true
})

export default router
