<script setup lang="ts">
import type { ChatMessage } from '../services/chat'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Notify } from 'quasar'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { autoRotateForDocument, resizeImage } from '../composables/useImageResize'
import { hashImage } from '../services/ai'
import { sendChatMessage, WELCOME_MESSAGE } from '../services/chat'
import { useSettingsStore } from '../stores/settings'
import MediaViewer from './MediaViewer.vue'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50 MB (Mistral OCR Limit)

marked.setOptions({ breaks: true })

function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string)
}

const open = defineModel<boolean>({ default: false })

const settings = useSettingsStore()
const { dbPromise } = useDatabase()

const messages = ref<ChatMessage[]>([WELCOME_MESSAGE])
const input = ref('')
const loading = ref(false)
const pendingFiles = ref<{ file: File, type: 'image' | 'pdf', name: string, preview: string, base64: string }[]>([])
const scrollArea = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const mediaViewerOpen = ref(false)
const mediaViewerImageSrc = ref('')
const mediaViewerPdfBase64 = ref('')
const mediaViewerOcr = ref('')
// Session-only storage for PDF base64 data (too large to persist)
const pdfDataByMsgId = new Map<string, string>()

// Chat-Verlauf aus RxDB laden
onMounted(async () => {
  const db = await dbPromise
  const docs = await (db as any).chatmessages.find({ sort: [{ createdAt: 'asc' }] }).exec()
  if (docs.length) {
    messages.value = [
      WELCOME_MESSAGE,
      ...docs.map((d: any) => ({
        id: d.id,
        role: d.role,
        content: d.content,
        attachments: d.attachments?.length ? d.attachments : undefined,
      })),
    ]
  }
})

async function saveMessage(msg: ChatMessage) {
  const db = await dbPromise
  try {
    await (db as any).chatmessages.insert({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      attachments: msg.attachments || [],
      createdAt: new Date().toISOString(),
    })
  }
  catch {}
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) {
      const el = scrollArea.value.$el || scrollArea.value
      const target = el.querySelector('.q-scrollarea__container')
      if (target)
        target.scrollTop = target.scrollHeight
    }
  })
}

watch(() => messages.value.length, scrollToBottom)

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files?.length)
    return

  for (const file of Array.from(files)) {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      if (file.size > MAX_PDF_SIZE) {
        Notify.create({ type: 'negative', message: `PDF zu groß (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum: 50 MB.` })
        break
      }
      pendingFiles.value = []
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        pendingFiles.value = [{
          file,
          type: 'pdf',
          name: file.name,
          preview: '',
          base64,
        }]
      }
      reader.readAsDataURL(file)
    }
    else {
      resizeImage(file).then(async ({ dataUrl, base64 }) => {
        const rotatedBase64 = await autoRotateForDocument(base64)
        const isOriginal = rotatedBase64 === base64
        const finalBase64 = rotatedBase64
        const finalDataUrl = isOriginal ? dataUrl : `data:image/webp;base64,${rotatedBase64}`
        pendingFiles.value.push({
          file,
          type: 'image',
          name: file.name,
          preview: finalDataUrl,
          base64: finalBase64,
        })
      })
    }
  }
  target.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value.splice(index, 1)
}

async function send() {
  const text = input.value.trim()
  if (!text && !pendingFiles.value.length)
    return

  const files = pendingFiles.value
  const attachments = files.map(f => ({ type: f.type, name: f.name, preview: f.preview }))

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text || files.map(f => `[${f.name}]`).join(' '),
    attachment: attachments[0],
    attachments: attachments.length ? attachments : undefined,
  }

  const imagesBase64 = files.filter(f => f.type === 'image').map(f => f.base64)
  const pdfFile = files.find(f => f.type === 'pdf')

  if (pdfFile)
    pdfDataByMsgId.set(userMsg.id, pdfFile.base64)

  messages.value.push(userMsg)
  await saveMessage(userMsg)
  input.value = ''
  pendingFiles.value = []
  loading.value = true

  try {
    const db = await dbPromise
    const response = await sendChatMessage(db, messages.value, {
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey,
      model: settings.aiModel || undefined,
    }, imagesBase64.length ? imagesBase64 : undefined, pdfFile?.base64)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response || 'Erledigt.',
    }
    messages.value.push(assistantMsg)
    await saveMessage(assistantMsg)
  }
  catch (e: any) {
    const errorMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Fehler: ${e.message}`,
    }
    messages.value.push(errorMsg)
    await saveMessage(errorMsg)
  }
  finally {
    loading.value = false
  }
}

async function openImageViewer(src: string) {
  mediaViewerImageSrc.value = src
  mediaViewerPdfBase64.value = ''
  mediaViewerOcr.value = ''
  mediaViewerOpen.value = true

  // OCR-Text aus RxDB laden (falls vorhanden)
  try {
    const base64 = src.split(',')[1]
    if (base64) {
      const hash = await hashImage(base64)
      const db = await dbPromise
      const doc = await (db as any).ocrcache.findOne({ selector: { id: hash } }).exec()
      if (doc)
        mediaViewerOcr.value = doc.markdown
    }
  }
  catch {}
}

function openPdfViewer(base64: string) {
  mediaViewerImageSrc.value = ''
  mediaViewerPdfBase64.value = base64
  mediaViewerOpen.value = true
}

async function clearChat() {
  const db = await dbPromise
  await (db as any).chatmessages.find().remove()
  messages.value = [WELCOME_MESSAGE]
}
</script>

<template>
  <q-btn
    fab
    icon="chat"
    color="primary"
    class="chat-fab"
    @click="open = true"
  />

  <q-dialog v-model="open" position="right" full-height maximized>
    <q-card style="width: 400px; max-width: 100vw" class="column full-height">
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title class="text-subtitle1">
          KI-Assistent
        </q-toolbar-title>
        <q-btn flat round dense icon="delete_sweep" @click="clearChat">
          <q-tooltip>Chat löschen</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="close" @click="open = false" />
      </q-toolbar>

      <q-scroll-area ref="scrollArea" class="col">
        <div class="q-pa-md q-gutter-md">
          <q-chat-message
            v-for="msg in messages"
            :key="msg.id"
            :name="msg.role === 'user' ? 'Du' : 'Assistent'"
            :sent="msg.role === 'user'"
            :bg-color="msg.role === 'user' ? 'primary' : 'grey-3'"
            :text-color="msg.role === 'user' ? 'white' : 'dark'"
          >
            <div>
              <template v-if="msg.attachments?.length">
                <div class="row q-gutter-xs q-mb-xs" style="flex-wrap: wrap">
                  <template v-for="(att, i) in msg.attachments" :key="i">
                    <img
                      v-if="att.type === 'image' && att.preview"
                      :src="att.preview"
                      style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; cursor: pointer"
                      @click="openImageViewer(att.preview!)"
                    >
                    <div
                      v-else-if="att.type === 'pdf'"
                      style="cursor: pointer"
                      @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
                    >
                      <q-icon name="picture_as_pdf" size="sm" />
                      {{ att.name }}
                    </div>
                  </template>
                </div>
              </template>
              <template v-else-if="msg.attachment">
                <img
                  v-if="msg.attachment.type === 'image' && msg.attachment.preview"
                  :src="msg.attachment.preview"
                  style="max-width: 200px; max-height: 150px; border-radius: 8px; cursor: pointer"
                  class="q-mb-xs"
                  @click="openImageViewer(msg.attachment!.preview!)"
                >
                <div
                  v-if="msg.attachment.type === 'pdf'" class="q-mb-xs"
                  style="cursor: pointer"
                  @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
                >
                  <q-icon name="picture_as_pdf" size="sm" />
                  {{ msg.attachment.name }}
                </div>
              </template>
              <div class="chat-markdown" v-html="renderMarkdown(msg.content)" />
            </div>
          </q-chat-message>

          <q-chat-message v-if="loading" name="Assistent" bg-color="grey-3">
            <q-spinner-dots size="2em" />
          </q-chat-message>
        </div>
      </q-scroll-area>

      <q-separator />

      <div v-if="pendingFiles.length" class="q-px-md q-pt-sm row q-gutter-xs" style="flex-wrap: wrap">
        <q-chip
          v-for="(pf, i) in pendingFiles"
          :key="i"
          removable
          color="primary"
          text-color="white"
          :icon="pf.type === 'image' ? 'image' : 'picture_as_pdf'"
          @remove="removePendingFile(i)"
        >
          {{ pf.name }}
        </q-chip>
      </div>

      <div class="q-pa-sm row items-end no-wrap q-gutter-xs">
        <input
          ref="fileInput"
          type="file"
          accept="image/*,application/pdf"
          multiple
          style="display: none"
          @change="onFileChange"
        >
        <q-btn flat round dense icon="attach_file" @click="pickFile">
          <q-tooltip>Fotos oder PDF anhängen (max. 50 MB)</q-tooltip>
        </q-btn>
        <q-input
          v-model="input"
          class="col"
          outlined
          dense
          rounded
          placeholder="Nachricht..."
          @keyup.enter="send"
        />
        <q-btn round dense color="primary" icon="send" :loading="loading" @click="send" />
      </div>
    </q-card>
  </q-dialog>

  <MediaViewer
    v-model="mediaViewerOpen"
    :image-src="mediaViewerImageSrc"
    :pdf-base64="mediaViewerPdfBase64"
    :ocr-markdown="mediaViewerOcr"
  />
</template>

<style scoped>
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}
</style>

<style>
.chat-markdown {
  line-height: 1.5;
}
.chat-markdown p {
  margin: 0 0 0.5em;
}
.chat-markdown p:last-child {
  margin-bottom: 0;
}
.chat-markdown ul,
.chat-markdown ol {
  margin: 0 0 0.5em;
  padding-left: 1.5em;
}
.chat-markdown li {
  margin-bottom: 0.2em;
}
.chat-markdown strong {
  font-weight: 600;
}
.chat-markdown h1,
.chat-markdown h2,
.chat-markdown h3 {
  margin: 0.5em 0 0.3em;
  font-size: 1em;
  font-weight: 600;
}
.chat-markdown code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.9em;
}
.chat-markdown pre {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.5em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.chat-markdown pre code {
  background: none;
  padding: 0;
}
.chat-markdown table {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}
.chat-markdown th,
.chat-markdown td {
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0.3em 0.5em;
  text-align: left;
}
.chat-markdown hr {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 0.5em 0;
}
</style>
