<script setup lang="ts">
/**
 * Einrichtung eines Fahrzeugs: empfohlene Reihenfolge, jeder Schritt überspringbar. Haken kommen aus den Daten
 * (services/vehicle-setup.ts), der erste offene Schritt ist der Hauptknopf.
 */
import type { SetupStep, SetupStepKey } from '../services/vehicle-setup'
import Button from 'primevue/button'
import { computed } from 'vue'
import { nextSetupStep } from '../services/vehicle-setup'

const props = defineProps<{ steps: SetupStep[] }>()
const emit = defineEmits<{ action: [key: SetupStepKey], hide: [] }>()

const next = computed(() => nextSetupStep(props.steps))
const doneCount = computed(() => props.steps.filter(s => s.done).length)
</script>

<template>
  <section class="setup" aria-label="Einrichtung" data-testid="setup-checklist">
    <div class="setup-header">
      <h3>Einrichten <span class="setup-count">{{ doneCount }} von {{ steps.length }}</span></h3>
      <Button label="Ausblenden" text size="small" severity="secondary" @click="emit('hide')" />
    </div>
    <ol class="setup-steps">
      <!-- Nur der nächste Schritt erklärt sich und hat den Hauptknopf; die übrigen bleiben eine Zeile, damit die
           Checkliste am Handy nicht den ganzen ersten Bildschirm füllt -->
      <li v-for="step in steps" :key="step.key" :data-step="step.key" :class="{ done: step.done, next: step.key === next?.key }">
        <i :class="step.done ? 'pi pi-check-circle' : 'pi pi-circle'" class="setup-icon" aria-hidden="true" />
        <!-- Erledigt: nur die Bezeichnung. Nächster Schritt: Bezeichnung, Hinweis, Hauptknopf. Übrige: nur der Knopf,
             seine Beschriftung nennt die Sache schon («Serviceheft fotografieren») -->
        <div v-if="step.done || step.key === next?.key" class="setup-text">
          <span class="setup-label">{{ step.label }}</span>
          <small v-if="step.key === next?.key" class="setup-hint">{{ step.hint }}</small>
          <Button v-if="step.key === next?.key" :label="step.action" size="small" class="setup-action" @click="emit('action', step.key)" />
        </div>
        <div v-else class="setup-text">
          <Button :label="step.action" size="small" text class="setup-action setup-action-quiet" @click="emit('action', step.key)" />
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.setup {
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin: 0 0 1rem;
}

.setup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setup-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.setup-count {
  font-weight: 400;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  margin-left: 0.25rem;
}

.setup-steps {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setup-steps li {
  display: grid;
  grid-template-columns: 1.25rem 1fr;
  gap: 0.5rem;
  align-items: center;
}

.setup-action {
  align-self: flex-start;
  margin-top: 0.35rem;
}

.setup-action-quiet {
  margin-top: 0;
  padding-inline: 0;
}

.setup-icon {
  color: var(--p-text-muted-color);
}

.done .setup-icon {
  color: var(--status-success, var(--p-green-500));
}

.done .setup-label {
  color: var(--p-text-muted-color);
}

.setup-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.setup-label {
  font-weight: 500;
}

.setup-hint {
  color: var(--p-text-muted-color);
  line-height: 1.35;
}
</style>
