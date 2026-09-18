<script setup lang="ts">
import type { Plan } from '@strainovic/ai-proxy/plans'
import { PLANS } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VehicleCard from '../components/VehicleCard.vue'
import VehicleForm from '../components/VehicleForm.vue'
import { fetchUsage } from '../services/ai-access'
import { vehicleLimit } from '../services/vehicle-limit'
import { activeVehicles, soldVehicles } from '../services/vehicle-status'
import { useVehiclesStore } from '../stores/vehicles'

const route = useRoute()
const router = useRouter()
const store = useVehiclesStore()
const showForm = ref(false)

onMounted(async () => {
  await store.load()
  if (route.query.action === 'add')
    showForm.value = true
})

// Nach dem Anlegen auf die Fahrzeugseite: dort führt die Einrichtungs-Checkliste durch Ausweis, Serviceheft,
// letzte Wartungen und Rechnungen
async function onSave(data: any) {
  const id = await store.add(data)
  showForm.value = false
  if (id)
    router.push(`/vehicles/${id}`)
}

// Fahrzeuge der Preisstaffel: Hinweis erst, wenn es einen Zahlungsweg gibt (services/vehicle-limit.ts)
const plan = ref<Plan | undefined>()
onMounted(async () => {
  try {
    const usage = await fetchUsage()
    plan.value = PLANS[usage.plan as keyof typeof PLANS]
  }
  catch {}
})
const limit = computed(() => vehicleLimit(activeVehicles(store.vehicles).length, plan.value, import.meta.env.VITE_BILLING_ENABLED === 'true'))

const active = computed(() => activeVehicles(store.vehicles))
const sold = computed(() => soldVehicles(store.vehicles))
const showSold = ref(false)
</script>

<template>
  <main class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        Fahrzeuge
      </h2>
      <Button
        v-if="store.vehicles.length > 0"
        icon="pi pi-plus"
        label="Hinzufügen"
        @click="showForm = true"
      />
    </div>

    <Message v-if="limit.note" severity="secondary" :closable="false" class="limit-note">
      <template #icon>
        <i class="pi pi-info-circle" />
      </template>
      {{ limit.note }}
    </Message>

    <div v-if="store.vehicles.length === 0" class="empty-state">
      <i class="pi pi-car empty-icon" />
      <div class="empty-title">
        Keine Fahrzeuge
      </div>
      <div class="empty-text">
        Füge dein erstes Fahrzeug hinzu.
      </div>
      <Button label="Fahrzeug hinzufügen" icon="pi pi-plus" @click="showForm = true" />
    </div>

    <VehicleCard
      v-for="v in active"
      :key="v.id"
      :vehicle="v"
    />

    <!-- Verkaufte Fahrzeuge bleiben für Kosten und Belege erhalten, stehen aber zugeklappt unten -->
    <section v-if="sold.length" class="sold-section">
      <Button
        :label="`${sold.length} ${sold.length === 1 ? 'verkauftes Fahrzeug' : 'verkaufte Fahrzeuge'}`"
        :icon="showSold ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        severity="secondary"
        @click="showSold = !showSold"
      />
      <template v-if="showSold">
        <VehicleCard
          v-for="v in sold"
          :key="v.id"
          :vehicle="v"
        />
      </template>
    </section>

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
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--p-text-muted-color);
}

.empty-icon {
  font-size: 4rem;
  color: var(--p-primary-color);
  opacity: 0.5;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-text {
  margin-bottom: 1.5rem;
}

.sold-section {
  margin-top: 1.5rem;
}
</style>
