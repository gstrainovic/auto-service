<script setup lang="ts">
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
  <q-page padding>
    <div class="row items-center q-mb-md">
      <h5 class="q-my-none">
        Fahrzeuge
      </h5>
      <q-space />
      <q-btn color="primary" icon="add" label="Hinzufügen" @click="showForm = true" />
    </div>

    <div v-if="store.vehicles.length === 0" class="text-center q-pa-xl text-grey">
      Noch keine Fahrzeuge. Füge dein erstes Auto hinzu.
    </div>

    <VehicleCard
      v-for="v in store.vehicles"
      :key="v.id"
      :vehicle="v"
      @delete="store.remove($event)"
    />

    <q-dialog v-model="showForm">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">
            Neues Fahrzeug
          </div>
        </q-card-section>
        <q-card-section>
          <VehicleForm @save="onSave" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>
