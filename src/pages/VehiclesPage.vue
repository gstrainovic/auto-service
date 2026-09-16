<script setup lang="ts">
import type { Plan } from '@strainovic/ai-proxy/plans'
import type { Vehicle } from '../stores/vehicles'
import { PLANS } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LastServicesDialog from '../components/LastServicesDialog.vue'
import SellVehicleDialog from '../components/SellVehicleDialog.vue'
import VehicleCard from '../components/VehicleCard.vue'
import VehicleForm from '../components/VehicleForm.vue'
import { fetchUsage } from '../services/ai-access'
import { vehicleLimit } from '../services/vehicle-limit'
import { activeVehicles, soldVehicles } from '../services/vehicle-status'
import { useVehiclesStore } from '../stores/vehicles'

const route = useRoute()
const store = useVehiclesStore()
const showForm = ref(false)
// Fahrzeug, dessen Löschung gerade bestätigt wird (gleicher Dialog und gleiche Kaskade wie auf der Detailseite)
const confirmDeleteId = ref<string | null>(null)

onMounted(async () => {
  await store.load()
  if (route.query.action === 'add')
    showForm.value = true
})

// Nach dem Anlegen gleich nach den letzten Wartungen fragen; ohne sie gibt es keine Fälligkeit und keine Erinnerung
const lastServicesFor = ref<{ id: string, name: string } | null>(null)

async function onSave(data: any) {
  const id = await store.add(data)
  showForm.value = false
  if (id)
    lastServicesFor.value = { id, name: `${data.make} ${data.model}` }
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

// Verkauft statt gelöscht: aus dem Löschdialog heraus erreichbar
const sellVehicle = ref<Vehicle | null>(null)
function openSell(): void {
  sellVehicle.value = store.vehicles.find(v => v.id === confirmDeleteId.value) ?? null
  confirmDeleteId.value = null
}

async function deleteVehicle(): Promise<void> {
  if (!confirmDeleteId.value)
    return
  await store.removeWithRelated(confirmDeleteId.value)
  confirmDeleteId.value = null
}
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
      @delete="confirmDeleteId = $event"
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
          @delete="confirmDeleteId = $event"
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

    <LastServicesDialog
      :visible="!!lastServicesFor"
      :vehicle-id="lastServicesFor?.id ?? null"
      :vehicle-name="lastServicesFor?.name"
      @update:visible="v => { if (!v) lastServicesFor = null }"
    />

    <Dialog
      :visible="!!confirmDeleteId"
      modal
      header="Fahrzeug löschen?"
      @update:visible="v => { if (!v) confirmDeleteId = null }"
    >
      <p>Alle Rechnungen und Wartungseinträge werden ebenfalls gelöscht.</p>
      <p class="delete-hint">
        Verkauft? Dann besser «Verkauft eintragen»: Das Fahrzeug verschwindet aus den Fälligkeiten, Kosten und Belege
        bleiben für den Jahresabschluss erhalten.
      </p>
      <template #footer>
        <Button label="Abbrechen" text @click="confirmDeleteId = null" />
        <Button label="Verkauft eintragen" icon="pi pi-tag" outlined @click="openSell" />
        <Button label="Löschen" severity="danger" @click="deleteVehicle" />
      </template>
    </Dialog>

    <SellVehicleDialog :vehicle="sellVehicle" @close="sellVehicle = null" />
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

.delete-hint {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}
</style>
