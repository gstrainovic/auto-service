<script setup lang="ts">
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ChatDrawer from './components/ChatDrawer.vue'
import { useAuth } from './composables/useAuth'

const router = useRouter()
const route = useRoute()
const drawer = ref(false)
const chatOpen = ref(false)
const { user, isLoading, signOut } = useAuth()

// Nach Login → Dashboard, nach Logout → Login
watch(user, (u) => {
  if (u && route.path === '/login')
    router.replace('/')
  else if (!u && !isLoading.value && route.path !== '/login')
    router.replace('/login')
})

function openChat() {
  drawer.value = false
  router.push('/?chat=open')
}

function handleSignOut() {
  drawer.value = false
  signOut()
}
</script>

<template>
  <div class="app-layout">
    <template v-if="user">
      <header class="app-header">
        <div class="app-toolbar">
          <Button
            icon="pi pi-bars"
            text
            rounded
            aria-label="Menu"
            @click="drawer = !drawer"
          />
          <span class="app-title">Auto-Service</span>
        </div>
      </header>

      <Drawer v-model:visible="drawer" header="Navigation">
        <nav class="nav-list">
          <RouterLink to="/" class="nav-item" @click="drawer = false">
            <i class="pi pi-home" />
            <span>Dashboard</span>
          </RouterLink>
          <RouterLink to="/vehicles" class="nav-item" @click="drawer = false">
            <i class="pi pi-car" />
            <span>Fahrzeuge</span>
          </RouterLink>
          <a class="nav-item" href="#" @click.prevent="openChat">
            <i class="pi pi-comments" />
            <span>KI-Assistent</span>
          </a>
          <RouterLink to="/settings" class="nav-item" @click="drawer = false">
            <i class="pi pi-cog" />
            <span>Einstellungen</span>
          </RouterLink>
          <a class="nav-item nav-signout" href="#" @click.prevent="handleSignOut">
            <i class="pi pi-sign-out" />
            <span>Abmelden</span>
          </a>
        </nav>
      </Drawer>

      <main class="app-main">
        <router-view />
      </main>

      <ChatDrawer v-model="chatOpen" />
    </template>

    <router-view v-else />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-toolbar {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  gap: 0.5rem;
}

.app-toolbar :deep(.p-button) {
  color: var(--p-primary-contrast-color);
}

.app-title {
  font-size: 1.25rem;
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 1rem;
  background: var(--p-surface-ground);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--p-border-radius);
  color: var(--p-text-color);
  text-decoration: none;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background: var(--p-surface-hover);
}

.nav-item.router-link-exact-active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.nav-item i {
  font-size: 1.25rem;
}

.nav-signout {
  margin-top: auto;
  border-top: 1px solid var(--p-surface-border);
  padding-top: 0.75rem;
  color: var(--p-text-muted-color);
}
</style>
