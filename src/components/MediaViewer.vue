<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, ref } from 'vue'

const props = defineProps<{
  /** Base64 image data (without data URL prefix) */
  imageBase64?: string
  /** Full data URL for image display */
  imageSrc?: string
  /** PDF base64 data (without data URL prefix) */
  pdfBase64?: string
  /** OCR markdown text */
  ocrMarkdown?: string
}>()

const open = defineModel<boolean>({ default: false })

const viewTab = ref<'image' | 'ocr'>('image')

const imageDataUrl = computed(() => {
  if (props.imageSrc)
    return props.imageSrc
  if (props.imageBase64) {
    const isJpeg = props.imageBase64.startsWith('/9j/')
    return `data:image/${isJpeg ? 'jpeg' : 'webp'};base64,${props.imageBase64}`
  }
  return ''
})

const pdfDataUrl = computed(() => {
  if (props.pdfBase64)
    return `data:application/pdf;base64,${props.pdfBase64}`
  return ''
})

const renderedOcr = computed(() => {
  if (!props.ocrMarkdown)
    return ''
  return DOMPurify.sanitize(marked.parse(props.ocrMarkdown) as string)
})

const hasOcr = computed(() => !!props.ocrMarkdown?.trim())
const hasImage = computed(() => !!imageDataUrl.value)
const hasPdf = computed(() => !!pdfDataUrl.value)
</script>

<template>
  <q-dialog v-model="open" maximized transition-show="fade" transition-hide="fade">
    <q-card class="column full-height bg-black">
      <q-toolbar class="bg-black text-white">
        <q-tabs v-if="hasOcr && (hasImage || hasPdf)" v-model="viewTab" dense shrink class="text-white">
          <q-tab name="image" :icon="hasPdf ? 'picture_as_pdf' : 'image'" :label="hasPdf ? 'PDF' : 'Bild'" />
          <q-tab name="ocr" icon="article" label="OCR-Text" />
        </q-tabs>
        <q-space />
        <q-btn flat round dense icon="close" color="white" @click="open = false" />
      </q-toolbar>

      <div class="col relative-position overflow-hidden">
        <!-- Image view -->
        <div
          v-if="viewTab === 'image' && hasImage"
          class="fit media-viewer-image"
        >
          <img
            :src="imageDataUrl"
            class="fit"
            style="object-fit: contain"
          >
        </div>

        <!-- PDF view -->
        <div v-else-if="viewTab === 'image' && hasPdf" class="fit">
          <iframe
            :src="pdfDataUrl"
            class="fit"
            style="border: none; background: white"
          />
        </div>

        <!-- OCR Markdown view -->
        <div v-else-if="viewTab === 'ocr' && hasOcr" class="fit overflow-auto bg-white q-pa-md">
          <div class="ocr-markdown" v-html="renderedOcr" />
        </div>

        <!-- Fallback: only OCR, no image -->
        <div v-else-if="hasOcr" class="fit overflow-auto bg-white q-pa-md">
          <div class="ocr-markdown" v-html="renderedOcr" />
        </div>
      </div>

      <div v-if="hasImage && viewTab === 'image'" class="bg-black text-grey-6 text-caption text-center q-pa-xs">
        Bilder werden automatisch optimiert: auf 1540 px verkleinert, gedreht und als WebP gespeichert.
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.media-viewer-image {
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: pinch-zoom;
  overflow: auto;
}

.media-viewer-image img {
  max-width: 100%;
  max-height: 100%;
}

.ocr-markdown {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
  font-size: 14px;
  color: #333;
}
</style>

<style>
.ocr-markdown table {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}
.ocr-markdown th,
.ocr-markdown td {
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0.3em 0.5em;
  text-align: left;
}
.ocr-markdown pre {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.5em;
  border-radius: 4px;
  overflow-x: auto;
}
.ocr-markdown h1,
.ocr-markdown h2,
.ocr-markdown h3 {
  margin: 0.5em 0 0.3em;
}
</style>
