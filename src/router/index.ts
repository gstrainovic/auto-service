import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../pages/DashboardPage.vue') },
  { path: '/vehicles', component: () => import('../pages/VehiclesPage.vue') },
  { path: '/vehicles/:id', component: () => import('../pages/VehicleDetailPage.vue') },
  { path: '/scan', redirect: '/?chat=open' },
  { path: '/settings', component: () => import('../pages/SettingsPage.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
