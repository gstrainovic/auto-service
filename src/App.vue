<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="drawer = !drawer" />
        <q-toolbar-title>Auto-Service</q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" bordered>
      <q-list>
        <q-item clickable to="/" exact>
          <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
          <q-item-section>Dashboard</q-item-section>
        </q-item>
        <q-item clickable to="/vehicles">
          <q-item-section avatar><q-icon name="directions_car" /></q-item-section>
          <q-item-section>Fahrzeuge</q-item-section>
        </q-item>
        <q-item clickable to="/scan">
          <q-item-section avatar><q-icon name="document_scanner" /></q-item-section>
          <q-item-section>Rechnung scannen</q-item-section>
        </q-item>
        <q-item clickable to="/settings">
          <q-item-section avatar><q-icon name="settings" /></q-item-section>
          <q-item-section>Einstellungen</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const drawer = ref(false)
</script>
