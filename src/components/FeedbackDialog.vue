<script setup lang="ts">
/**
 * Rückmeldung an den Betreiber: Sprachnachricht, Text oder beides, dazu die Adresse zum Kopieren.
 * Drei Wege, weil jeder woanders scheitert: `mailto` hat auf dem Rechner oft kein Mailprogramm, Tippen ist auf
 * der Baustelle mühsam, und wer nicht sprechen mag oder darf, schreibt. Die Aufnahme transkribiert der AI-Proxy
 * (Voxtral) und schickt sie mit der Mail an `info@wartungsheft.ch`.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { userMessage } from '../lib/errors'
import { sendFeedback } from '../services/ai-access'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const CONTACT_EMAIL = 'info@wartungsheft.ch'
/** Länger als drei Minuten ist keine Rückmeldung mehr, sondern ein Anruf */
const MAX_SEKUNDEN = 180

const route = useRoute()
const toast = useToast()

const text = ref('')
const fehler = ref('')
const sendet = ref(false)

const aufnahmeLaeuft = ref(false)
const sekunden = ref(0)
const aufnahme = ref<Blob | null>(null)
const aufnahmeUrl = ref('')
const mikrofonFehler = ref('')
let recorder: MediaRecorder | null = null
let ticker: ReturnType<typeof setInterval> | null = null

const kannAufnehmen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
const dauer = computed(() => `${Math.floor(sekunden.value / 60)}:${String(sekunden.value % 60).padStart(2, '0')}`)
const kannSenden = computed(() => (!!text.value.trim() || !!aufnahme.value) && !sendet.value && !aufnahmeLaeuft.value)

watch(() => props.visible, (offen) => {
  if (offen)
    return
  stoppen()
  verwerfen()
  text.value = ''
  fehler.value = ''
})

function stoppen(): void {
  recorder?.state === 'recording' && recorder.stop()
  recorder?.stream.getTracks().forEach(t => t.stop())
  recorder = null
  aufnahmeLaeuft.value = false
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function verwerfen(): void {
  if (aufnahmeUrl.value)
    URL.revokeObjectURL(aufnahmeUrl.value)
  aufnahmeUrl.value = ''
  aufnahme.value = null
  sekunden.value = 0
}

async function starten(): Promise<void> {
  mikrofonFehler.value = ''
  verwerfen()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const teile: Blob[] = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = e => e.data.size && teile.push(e.data)
    recorder.onstop = () => {
      aufnahme.value = new Blob(teile, { type: recorder?.mimeType || 'audio/webm' })
      aufnahmeUrl.value = URL.createObjectURL(aufnahme.value)
    }
    recorder.start()
    aufnahmeLaeuft.value = true
    sekunden.value = 0
    ticker = setInterval(() => {
      sekunden.value++
      if (sekunden.value >= MAX_SEKUNDEN)
        stoppen()
    }, 1000)
  }
  catch {
    // Verweigertes Mikrofon ist kein Fehler, sondern ein Grund, zu schreiben
    mikrofonFehler.value = 'Kein Zugriff aufs Mikrofon. Schreib die Rückmeldung einfach ins Feld unten.'
  }
}

async function adresseKopieren(): Promise<void> {
  try {
    await navigator.clipboard.writeText(CONTACT_EMAIL)
    toast.add({ severity: 'success', summary: 'Adresse kopiert', life: 2500 })
  }
  catch {
    toast.add({ severity: 'info', summary: CONTACT_EMAIL, detail: 'Bitte von Hand kopieren.', life: 6000 })
  }
}

async function senden(): Promise<void> {
  fehler.value = ''
  sendet.value = true
  try {
    await sendFeedback({ text: text.value.trim(), audio: aufnahme.value, page: route.fullPath })
    toast.add({ severity: 'success', summary: 'Danke, ist angekommen', detail: 'Wir melden uns, wenn es etwas zu sagen gibt.', life: 5000 })
    emit('close')
  }
  catch (e) {
    fehler.value = userMessage(e)
  }
  finally {
    sendet.value = false
  }
}

onBeforeUnmount(() => {
  stoppen()
  verwerfen()
})
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Fehler melden oder Wunsch"
    data-testid="feedback-dialog"
    :style="{ width: 'min(520px, 96vw)' }"
    @update:visible="emit('close')"
  >
    <p class="intro">
      Was stört, was fehlt? Sprich es auf oder schreib es — beides landet direkt bei uns.
    </p>

    <Message v-if="fehler" severity="error" :closable="false" class="hinweis">
      {{ fehler }}
    </Message>

    <div v-if="kannAufnehmen" class="aufnahme">
      <Button
        v-if="!aufnahmeLaeuft"
        :label="aufnahme ? 'Neu aufnehmen' : 'Sprachnachricht aufnehmen'"
        icon="pi pi-microphone"
        severity="secondary"
        outlined
        data-testid="feedback-record"
        @click="starten"
      />
      <Button
        v-else
        :label="`Aufnahme stoppen (${dauer})`"
        icon="pi pi-stop-circle"
        severity="danger"
        data-testid="feedback-stop"
        @click="stoppen"
      />
      <audio v-if="aufnahmeUrl" :src="aufnahmeUrl" controls class="abspielen" />
      <Button v-if="aufnahme && !aufnahmeLaeuft" label="Verwerfen" text size="small" @click="verwerfen" />
    </div>
    <small v-if="mikrofonFehler" class="hinweis-text">{{ mikrofonFehler }}</small>

    <Textarea
      v-model="text"
      rows="4"
      auto-resize
      class="feld"
      placeholder="Oder schreib es hier hin."
      data-testid="feedback-text"
    />

    <p class="adresse">
      Lieber selbst schreiben?
      <button type="button" class="kopieren" data-testid="feedback-copy" @click="adresseKopieren">
        {{ CONTACT_EMAIL }} <i class="pi pi-copy" />
      </button>
    </p>

    <template #footer>
      <Button label="Abbrechen" text severity="secondary" @click="emit('close')" />
      <Button label="Senden" icon="pi pi-send" :disabled="!kannSenden" :loading="sendet" data-testid="feedback-send" @click="senden" />
    </template>
  </Dialog>
</template>

<style scoped>
.intro {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.hinweis {
  margin-bottom: 1rem;
}

.aufnahme {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 0.9rem;
}

.abspielen {
  flex: 1 1 200px;
  height: 36px;
}

.hinweis-text {
  display: block;
  margin: -0.4rem 0 0.9rem;
  color: var(--p-text-muted-color);
}

.feld {
  width: 100%;
}

.adresse {
  margin: 0.9rem 0 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.kopieren {
  border: 0;
  background: none;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
</style>
