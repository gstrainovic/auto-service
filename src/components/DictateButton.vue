<script setup lang="ts">
/**
 * Mikrofon-Knopf für Freitextfelder und die Chat-Eingabe: antippen, sprechen, nochmals antippen.
 * Der erkannte Text kommt als Ereignis zurück, das aufrufende Feld entscheidet, ob es ihn anhängt oder ersetzt.
 * Ohne Mikrofon oder ohne Erlaubnis verschwindet der Knopf lautlos — getippt werden kann immer.
 */
import Button from 'primevue/button'
import { useDictation } from '../composables/useDictation'

const props = withDefaults(defineProps<{
  /** Beschriftung für Hilfstechnik; sagt, welches Feld gefüllt wird */
  label?: string
  size?: 'small' | 'large'
}>(), { label: 'Diktieren', size: 'small' })

const emit = defineEmits<{ text: [text: string], fehler: [meldung: string] }>()

const { verfuegbar, laeuft, verarbeitet, sekunden, fehler, starten, stoppen } = useDictation()

async function umschalten(): Promise<void> {
  if (verarbeitet.value)
    return
  if (!laeuft.value) {
    await starten()
    if (fehler.value)
      emit('fehler', fehler.value)
    return
  }
  const text = await stoppen()
  if (text)
    emit('text', text)
  else if (fehler.value)
    emit('fehler', fehler.value)
}
</script>

<template>
  <Button
    v-if="verfuegbar"
    :icon="laeuft ? 'pi pi-stop-circle' : 'pi pi-microphone'"
    :severity="laeuft ? 'danger' : 'secondary'"
    :loading="verarbeitet"
    :aria-label="laeuft ? `Aufnahme stoppen (${sekunden} Sekunden)` : props.label"
    :title="laeuft ? 'Aufnahme stoppen' : props.label"
    text
    rounded
    :size="props.size"
    class="dictate-btn"
    data-testid="dictate-button"
    @click="umschalten"
  />
</template>

<style scoped>
.dictate-btn {
  flex: none;
}
</style>
