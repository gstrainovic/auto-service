<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { onMounted, ref } from 'vue'
import VehicleCard from '../components/VehicleCard.vue'
import VehicleForm from '../components/VehicleForm.vue'
import { useVehiclesStore } from '../stores/vehicles'

const store = useVehiclesStore()
const showForm = ref(false)

onMounted(() => store.load())

async function onSave(data: any) {
  await store.add(data)
  showForm.value = false
}
</script>

<template>
  <main class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        Fahrzeuge
      </h2>
      <Button
        icon="pi pi-plus"
        label="Hinzufügen"
        @click="showForm = true"
      />
    </div>

    <div v-if="store.vehicles.length === 0" class="empty-state">
      Noch keine Fahrzeuge. Füge dein erstes Auto hinzu.
    </div>

    <VehicleCard
      v-for="v in store.vehicles"
      :key="v.id"
      :vehicle="v"
      @delete="store.remove($event)"
    />

    <Dialog
      v-model:visible="showForm"
      header="Neues Fahrzeug"
      modal
      :style="{ minWidth: '350px' }"
    >
      <VehicleForm @save="onSave" />
    </Dialog>
  </main>
</template>

<style scoped>
.page-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--p-text-muted-color);
}
</style>
