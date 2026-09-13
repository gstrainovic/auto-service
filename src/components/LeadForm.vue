<script setup lang="ts">
import type { LeadSegment } from '../lib/leads'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { ref } from 'vue'
import { leadSchema } from '../lib/leads'
import { useLeadsStore } from '../stores/leads'

const props = defineProps<{
  segment: LeadSegment
  /** Beschriftung des optionalen Zusatzfelds, z. B. «Anzahl Fahrzeuge»; ohne Angabe kein Zusatzfeld */
  noteLabel?: string
}>()

const leads = useLeadsStore()
const email = ref('')
const note = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function submit() {
  error.value = ''
  const parsed = leadSchema.safeParse({ email: email.value, segment: props.segment, note: note.value })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Eingabe prüfen.'
    return
  }
  loading.value = true
  try {
    await leads.add(parsed.data)
    done.value = true
  }
  catch {
    error.value = 'Speichern fehlgeschlagen. Bitte später nochmals versuchen.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="lead-form">
    <p v-if="done" class="lead-done">
      Danke, wir melden uns per E-Mail.
    </p>
    <form v-else novalidate @submit.prevent="submit">
      <Message v-if="error" severity="error" :closable="false">
        {{ error }}
      </Message>
      <div class="lead-field">
        <label for="lead-email">E-Mail</label>
        <InputText id="lead-email" v-model="email" type="email" autocomplete="email" fluid />
      </div>
      <div v-if="noteLabel" class="lead-field">
        <label for="lead-note">{{ noteLabel }}</label>
        <InputText id="lead-note" v-model="note" fluid />
      </div>
      <Button type="submit" label="Absenden" :loading="loading" fluid />
      <p class="lead-hint">
        Kein Newsletter, keine Weitergabe. Eine E-Mail von uns, mehr nicht.
      </p>
    </form>
  </div>
</template>

<style scoped>
.lead-form {
  max-width: 420px;
  margin: 0 auto;
  text-align: left;
}

.lead-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 1rem 0;
}

.lead-field label {
  font-size: 0.9rem;
  font-weight: 600;
}

.lead-hint {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

.lead-done {
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
}
</style>
