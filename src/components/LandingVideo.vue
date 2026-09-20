<script setup lang="ts">
/**
 * Kurzfilm auf den Landing Pages. Läuft stumm und erst auf Klick, damit die Seite nicht von selbst lärmt und
 * das Handy kein Datenvolumen verbraucht. Die Filme entstehen aus `npm run video` und `scripts/video-build.sh`
 * (Drehbücher in `video-scripts/`); fehlt die Datei, zeigt die Seite den Abschnitt gar nicht.
 */
import { onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** Datei unter public/, ohne Pfad */
  file?: string
  title?: string
  subtitle?: string
}>(), {
  file: 'film-privat.webm',
  title: 'In einer Minute gesehen',
  subtitle: 'Vom Foto der Werkstattrechnung bis zum Serviceheft für den Verkauf.',
})

const src = `/${props.file}`
const vorhanden = ref(false)
const laeuft = ref(false)
const video = ref<HTMLVideoElement | null>(null)

onMounted(async () => {
  // Die Filme liegen nicht im Git; ohne Datei bleibt der Abschnitt weg statt kaputt zu wirken
  try {
    const res = await fetch(src, { method: 'HEAD' })
    vorhanden.value = res.ok && (res.headers.get('content-type') ?? '').startsWith('video')
  }
  catch {
    vorhanden.value = false
  }
})

function abspielen(): void {
  laeuft.value = true
  video.value?.play().catch(() => {
    laeuft.value = false
  })
}
</script>

<template>
  <section v-if="vorhanden" class="video-section" data-testid="landing-video">
    <div class="video-inner">
      <h2>{{ title }}</h2>
      <p class="video-subtitle">
        {{ subtitle }}
      </p>
      <div class="video-frame">
        <video
          ref="video"
          :src="src"
          muted
          playsinline
          loop
          preload="metadata"
          controls
          @play="laeuft = true"
          @pause="laeuft = false"
        />
        <button v-if="!laeuft" class="video-play" type="button" aria-label="Film abspielen" @click="abspielen">
          <i class="pi pi-play" />
        </button>
      </div>
      <p class="video-note">
        Ohne Ton, 30 Sekunden. Gezeigt wird die App mit erfundenen Beispieldaten.
      </p>
    </div>
  </section>
</template>

<style scoped>
.video-section {
  padding: 3.5rem 1rem;
}

.video-inner {
  max-width: 460px;
  margin: 0 auto;
  text-align: center;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.6rem;
}

.video-subtitle {
  margin: 0 0 1.5rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.video-frame {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  background: #17181c;
  box-shadow: 0 18px 40px rgb(0 0 0 / 35%);
}

.video-frame video {
  display: block;
  width: 100%;
  aspect-ratio: 585 / 1266;
}

.video-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  width: 100%;
  border: 0;
  background: rgb(0 0 0 / 25%);
  color: #fff;
  cursor: pointer;
}

.video-play i {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  font-size: 1.8rem;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.video-note {
  margin: 0.9rem 0 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
</style>
