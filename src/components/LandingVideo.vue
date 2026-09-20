<script setup lang="ts">
/**
 * Kurzfilm auf den Landing Pages. Startet stumm und erst auf Klick, damit die Seite nicht von selbst lärmt und
 * das Handy kein Datenvolumen verbraucht; der Ton (Sprecher) lässt sich über die Bedienleiste einschalten. Die Filme entstehen aus `npm run video` und `scripts/video-build.sh`
 * (Drehbücher in `video-scripts/`); fehlt die Datei, zeigt die Seite den Abschnitt gar nicht.
 */
import { computed, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** Datei unter public/, ohne Pfad */
  file?: string
  title?: string
  subtitle?: string
}>(), {
  file: 'film-privat.webm',
  title: 'In 40 Sekunden gesehen',
  subtitle: 'Vom Foto der Werkstattrechnung bis zum Serviceheft für den Verkauf.',
})

// Auf dem Desktop die eigene Aufnahme im Desktop-Layout, am Handy die hochkant aufgenommene
const quer = ref(false)
const src = computed(() => (quer.value ? `/${props.file.replace(/\.webm$/, '-desktop.webm')}` : `/${props.file}`))
const poster = computed(() => src.value.replace(/\.webm$/, '-poster.jpg'))
const vorhanden = ref(false)
const laeuft = ref(false)
const video = ref<HTMLVideoElement | null>(null)

onMounted(async () => {
  // Auf Breitenwechsel hören, sonst bliebe nach dem Drehen des Geräts das falsche Format stehen
  const breit = window.matchMedia('(min-width: 760px)')
  quer.value = breit.matches
  breit.addEventListener('change', (e) => {
    quer.value = e.matches
  })
  // Ohne Datei bleibt der Abschnitt weg statt kaputt zu wirken
  try {
    const res = await fetch(src.value, { method: 'HEAD' })
    vorhanden.value = res.ok && (res.headers.get('content-type') ?? '').startsWith('video')
  }
  catch {
    vorhanden.value = false
  }
})

/**
 * Start über den eigenen Knopf: weil der Klick vom Menschen kommt, erlauben die Browser den Ton. Stumm ist nur
 * der Zustand davor, damit die Seite beim Laden nicht von selbst spricht.
 */
function abspielen(): void {
  laeuft.value = true
  if (video.value)
    video.value.muted = false
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
          :key="src"
          :src="src"
          :poster="poster"
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
        Gut eine halbe Minute, mit Ton und Untertiteln. Gezeigt wird die App mit erfundenen Beispieldaten.
      </p>
    </div>
  </section>
</template>

<style scoped>
.video-section {
  padding: 3.5rem 1rem;
}

.video-inner {
  max-width: 400px;
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
  max-height: 72vh;
}

/* Desktop: Querformat, damit der Film nicht den halben Bildschirm füllt */
@media (min-width: 760px) {
  .video-inner {
    max-width: 760px;
  }

  .video-frame video {
    aspect-ratio: 16 / 9;
    max-height: none;
  }
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
