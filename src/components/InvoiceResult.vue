<script setup lang="ts">
import type { ParsedInvoice } from '../services/ai'

defineProps<{ result: ParsedInvoice }>()
defineEmits<{ save: [], discard: [] }>()
</script>

<template>
  <q-card class="q-mt-md">
    <q-card-section>
      <div class="text-h6">
        Erkannte Daten
      </div>
    </q-card-section>
    <q-card-section>
      <q-field label="Werkstatt" stack-label borderless>
        <template #control>
          {{ result.workshopName }}
        </template>
      </q-field>
      <q-field label="Datum" stack-label borderless>
        <template #control>
          {{ result.date }}
        </template>
      </q-field>
      <q-field label="Gesamtbetrag" stack-label borderless>
        <template #control>
          {{ result.totalAmount?.toFixed(2) }} €
        </template>
      </q-field>
      <q-field v-if="result.mileageAtService" label="Kilometerstand" stack-label borderless>
        <template #control>
          {{ result.mileageAtService?.toLocaleString('de-DE') }} km
        </template>
      </q-field>

      <div class="text-subtitle1 q-mt-md">
        Positionen
      </div>
      <q-list bordered separator>
        <q-item v-for="(item, i) in result.items" :key="i">
          <q-item-section>
            <q-item-label>{{ item.description }}</q-item-label>
            <q-item-label caption>
              {{ item.category }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            {{ item.amount.toFixed(2) }} €
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <q-card-actions>
      <q-btn color="primary" label="Speichern" @click="$emit('save')" />
      <q-btn flat label="Verwerfen" @click="$emit('discard')" />
    </q-card-actions>
  </q-card>
</template>
