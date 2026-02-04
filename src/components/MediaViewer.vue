<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import Dialog from 'primevue/dialog'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
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
  <Dialog
    v-model:visible="open"
    modal
    maximizable
    :maximized="true"
    :closable="true"
    :show-header="true"
    :pt="{
      root: { class: 'media-viewer-dialog' },
      content: { class: 'media-viewer-content' },
      header: { class: 'media-viewer-header' },
    }"
  >
    <template #header>
      <div class="flex items-center gap-4 w-full">
        <Tabs v-if="hasOcr && (hasImage || hasPdf)" v-model:value="viewTab" class="media-viewer-tabs">
          <TabList>
            <Tab value="image">
              <i :class="hasPdf ? 'pi pi-file-pdf' : 'pi pi-image'" class="mr-2" />
              {{ hasPdf ? 'PDF' : 'Bild' }}
            </Tab>
            <Tab value="ocr">
              <i class="pi pi-file-edit mr-2" />
              OCR-Text
            </Tab>
          </TabList>
        </Tabs>
        <div class="flex-1" />
      </div>
    </template>

    <div class="media-viewer-body">
      <!-- Image view -->
      <div
        v-if="viewTab === 'image' && hasImage"
        class="media-viewer-image"
      >
        <img
          :src="imageDataUrl"
          class="media-image"
        >
      </div>

      <!-- PDF view -->
      <div v-else-if="viewTab === 'image' && hasPdf" class="media-viewer-pdf">
        <iframe
          :src="pdfDataUrl"
          class="pdf-iframe"
        />
      </div>

      <!-- OCR Markdown view -->
      <div v-else-if="viewTab === 'ocr' && hasOcr" class="media-viewer-ocr">
        <div class="ocr-markdown" v-html="renderedOcr" />
      </div>

      <!-- Fallback: only OCR, no image -->
      <div v-else-if="hasOcr" class="media-viewer-ocr">
        <div class="ocr-markdown" v-html="renderedOcr" />
      </div>
    </div>

    <template #footer>
      <div v-if="hasImage && viewTab === 'image'" class="media-viewer-footer">
        Bilder werden automatisch optimiert: auf 1540 px verkleinert, gedreht und als WebP gespeichert.
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.media-viewer-dialog {
  background: black;
}

.media-viewer-header {
  background: black;
  color: white;
  padding: 0.5rem 1rem;
}

.media-viewer-content {
  background: black;
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.media-viewer-tabs :deep(.p-tablist) {
  background: transparent;
  border: none;
}

.media-viewer-tabs :deep(.p-tab) {
  color: white;
  background: transparent;
}

.media-viewer-tabs :deep(.p-tab-active) {
  color: white;
  border-color: white;
}

.media-viewer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
}

.media-viewer-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: pinch-zoom;
  overflow: auto;
}

.media-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.media-viewer-pdf {
  flex: 1;
  display: flex;
}

.pdf-iframe {
  flex: 1;
  border: none;
  background: white;
}

.media-viewer-ocr {
  flex: 1;
  overflow: auto;
  background: white;
  padding: 1rem;
}

.ocr-markdown {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
  font-size: 14px;
  color: #333;
}

.media-viewer-footer {
  background: black;
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.25rem;
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
