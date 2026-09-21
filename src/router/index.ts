import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { applyMetaToDocument } from '../lib/page-meta-document'

const routes = [
  { path: '/', component: () => import('../pages/LandingPage.vue'), meta: { public: true } },
  { path: '/login', component: () => import('../pages/LoginPage.vue'), meta: { public: true } },
  { path: '/impressum', component: () => import('../pages/ImpressumPage.vue'), meta: { public: true } },
  { path: '/datenschutz', component: () => import('../pages/DatenschutzPage.vue'), meta: { public: true } },
  { path: '/agb', component: () => import('../pages/AgbPage.vue'), meta: { public: true } },
  { path: '/hilfe', component: () => import('../pages/HilfePage.vue'), meta: { public: true } },
  { path: '/betrieb', component: () => import('../pages/BetriebPage.vue'), meta: { public: true } },
  { path: '/privathalter', component: () => import('../pages/PrivathalterPage.vue'), meta: { public: true } },
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

// Titel, Beschreibung und kanonische Adresse pro Seite (src/lib/page-meta.ts)
router.afterEach(to => applyMetaToDocument(document, to.path))

export default router
