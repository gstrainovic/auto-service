<script setup lang="ts">
import type { ChatMessage } from '../services/chat'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Divider from 'primevue/divider'
import Drawer from 'primevue/drawer'
import ProgressSpinner from 'primevue/progressspinner'
import ScrollPanel from 'primevue/scrollpanel'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { autoRotateForDocument, resizeImage } from '../composables/useImageResize'
import { db, tx } from '../lib/instantdb'
import { hashImage } from '../services/ai'
import { sendChatMessage, WELCOME_MESSAGE } from '../services/chat'
import { useSettingsStore } from '../stores/settings'
import MediaViewer from './MediaViewer.vue'
import ToolResultCard from './ToolResultCard.vue'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50 MB (Mistral OCR Limit)

marked.setOptions({ breaks: true })

function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string)
}

const open = defineModel<boolean>({ default: false })

const toast = useToast()
const settings = useSettingsStore()

const messages = ref<ChatMessage[]>([WELCOME_MESSAGE])
const input = ref('')
const loading = ref(false)
const pendingFiles = ref<{ file: File, type: 'image' | 'pdf', name: string, preview: string, base64: string }[]>([])
const scrollArea = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const maximized = ref(false)
const mediaViewerOpen = ref(false)
const mediaViewerImageSrc = ref('')
const mediaViewerPdfBase64 = ref('')
const mediaViewerOcr = ref('')
// Session-only storage for PDF base64 data (too large to persist)
const pdfDataByMsgId = new Map<string, string>()

// Chat-Verlauf aus InstantDB laden
onMounted(async () => {
  try {
    const result = await db.queryOnce({ chatmessages: {} })
    const docs = (result.data.chatmessages || [])
      .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0))
    if (docs.length) {
      messages.value = [
        WELCOME_MESSAGE,
        ...docs.map((d: any) => ({
          id: d.id,
          role: d.role,
          content: d.content,
          attachments: d.attachments?.length ? d.attachments : undefined,
          toolResults: d.toolResults?.length ? d.toolResults : undefined,
        })),
      ]
    }
  }
  catch {}
})

async function saveMessage(msg: ChatMessage) {
  try {
    await db.transact([
      tx.chatmessages[msg.id].update({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments || [],
        toolResults: msg.toolResults || [],
        createdAt: Date.now(),
      }),
    ])
  }
  catch {}
}

const allToolResults = computed(() =>
  messages.value.flatMap(m =>
    (m.toolResults || []).map(tr => ({ ...tr, msgId: m.id })),
  ),
)

const showSplit = computed(() => maximized.value && allToolResults.value.length > 0)

// Show suggestions only when no chat history (just welcome message)
const showSuggestions = computed(() => messages.value.length === 1 && messages.value[0].id === 'welcome')

const suggestions = [
  { icon: 'pi pi-receipt', label: 'Rechnung scannen', prompt: 'Ich möchte eine Rechnung scannen' },
  { icon: 'pi pi-car', label: 'Fahrzeug anlegen', prompt: 'Neues Fahrzeug anlegen' },
  { icon: 'pi pi-wrench', label: 'Wartungsstatus', prompt: 'Zeige den Wartungsstatus meiner Fahrzeuge' },
]

function applySuggestion(prompt: string) {
  input.value = prompt
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) {
      const el = scrollArea.value.$el || scrollArea.value
      const content = el.querySelector('.p-scrollpanel-content')
      if (content)
        content.scrollTop = content.scrollHeight
    }
  })
}

watch(() => messages.value.length, scrollToBottom)

function pickFile() {
  fileInput.value?.click()
}

function pickCamera() {
  cameraInput.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files?.length)
    return
  processFiles(files)
  target.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value.splice(index, 1)
}

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files?.length)
    return
  processFiles(files)
}

function processFiles(files: FileList) {
  for (const file of Array.from(files)) {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      if (file.size > MAX_PDF_SIZE) {
        toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: `PDF zu groß (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum: 50 MB.`,
          life: 5000,
        })
        continue
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        pendingFiles.value.push({
          file,
          type: 'pdf',
          name: file.name,
          preview: '',
          base64,
        })
        if (!input.value.trim())
          input.value = 'Bitte erfassen'
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
        if (!input.value.trim())
          input.value = 'Bitte erfassen'
      })
    }
  }
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
  const pdfFiles = files.filter(f => f.type === 'pdf')

  if (pdfFiles.length === 1)
    pdfDataByMsgId.set(userMsg.id, pdfFiles[0].base64)

  messages.value.push(userMsg)
  await saveMessage(userMsg)
  input.value = ''
  pendingFiles.value = []
  loading.value = true

  const pdfBase64s = pdfFiles.map(f => f.base64)

  try {
    const response = await sendChatMessage(messages.value, {
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey,
      model: settings.aiModel || undefined,
    }, imagesBase64.length ? imagesBase64 : undefined, pdfBase64s.length ? pdfBase64s : undefined)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.text || 'Erledigt.',
      toolResults: response.toolResults,
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

  // OCR-Text aus InstantDB laden (falls vorhanden)
  try {
    const base64 = src.split(',')[1]
    if (base64) {
      const hash = await hashImage(base64)
      const result = await db.queryOnce({ ocrcache: {} })
      const entries = result.data.ocrcache || []
      const doc = entries.find((e: any) => e.hash === hash)
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
  try {
    const result = await db.queryOnce({ chatmessages: {} })
    const msgs = result.data.chatmessages || []
    if (msgs.length) {
      await db.transact(msgs.map((m: any) => tx.chatmessages[m.id].delete()))
    }
  }
  catch {}
  messages.value = [WELCOME_MESSAGE]
}
</script>

<template>
  <Button
    icon="pi pi-comments"
    rounded
    class="chat-fab"
    @click="open = true"
  />

  <Drawer
    v-model:visible="open"
    position="right"
    :style="{ width: maximized ? '100vw' : '400px', maxWidth: '100vw' }"
    class="chat-drawer"
    :class="{ 'chat-maximized': maximized }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <template #header>
      <div class="chat-header">
        <span class="chat-title">KI-Assistent</span>
        <div class="chat-header-actions">
          <Button
            v-tooltip.bottom="'Chat löschen'"
            icon="pi pi-trash"
            text
            rounded
            severity="secondary"
            @click="clearChat"
          />
        </div>
      </div>
    </template>

    <div v-if="isDragging" class="chat-drop-overlay">
      <i class="pi pi-cloud-upload" style="font-size: 2rem" />
      <div>Dateien hier ablegen</div>
    </div>

    <div v-if="showSplit" class="chat-split-layout">
      <ScrollPanel class="chat-cards-panel">
        <div class="chat-cards-list">
          <ToolResultCard
            v-for="(tr, ti) in allToolResults"
            :key="ti"
            :result="tr"
          />
        </div>
      </ScrollPanel>
      <ScrollPanel ref="scrollArea" class="chat-main-panel">
        <div class="chat-messages">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="chat-message"
            :class="msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'"
          >
            <div class="chat-message-name">
              {{ msg.role === 'user' ? 'Du' : 'Assistent' }}
            </div>
            <div class="chat-message-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'">
              <template v-if="msg.attachments?.length">
                <div class="attachment-row">
                  <template v-for="(att, i) in msg.attachments" :key="i">
                    <img
                      v-if="att.type === 'image' && att.preview"
                      :src="att.preview"
                      class="attachment-image"
                      @click="openImageViewer(att.preview!)"
                    >
                    <div
                      v-else-if="att.type === 'pdf'"
                      class="attachment-pdf"
                      @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
                    >
                      <i class="pi pi-file-pdf" />
                      {{ att.name }}
                    </div>
                  </template>
                </div>
              </template>
              <template v-else-if="msg.attachment">
                <img
                  v-if="msg.attachment.type === 'image' && msg.attachment.preview"
                  :src="msg.attachment.preview"
                  class="attachment-image-large"
                  @click="openImageViewer(msg.attachment!.preview!)"
                >
                <div
                  v-if="msg.attachment.type === 'pdf'"
                  class="attachment-pdf"
                  @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
                >
                  <i class="pi pi-file-pdf" />
                  {{ msg.attachment.name }}
                </div>
              </template>
              <div class="chat-markdown" v-html="renderMarkdown(msg.content)" />
            </div>
          </div>

          <div v-if="loading" class="chat-message chat-message-assistant">
            <div class="chat-message-name">
              Assistent
            </div>
            <div class="chat-message-bubble bubble-assistant">
              <ProgressSpinner style="width: 24px; height: 24px" stroke-width="4" />
            </div>
          </div>
        </div>
      </ScrollPanel>
    </div>

    <ScrollPanel v-else ref="scrollArea" class="chat-scroll">
      <div class="chat-messages">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-message"
          :class="msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'"
        >
          <div class="chat-message-name">
            {{ msg.role === 'user' ? 'Du' : 'Assistent' }}
          </div>
          <div class="chat-message-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'">
            <template v-if="msg.attachments?.length">
              <div class="attachment-row">
                <template v-for="(att, i) in msg.attachments" :key="i">
                  <img
                    v-if="att.type === 'image' && att.preview"
                    :src="att.preview"
                    class="attachment-image"
                    @click="openImageViewer(att.preview!)"
                  >
                  <div
                    v-else-if="att.type === 'pdf'"
                    class="attachment-pdf"
                    @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
                  >
                    <i class="pi pi-file-pdf" />
                    {{ att.name }}
                  </div>
                </template>
              </div>
            </template>
            <template v-else-if="msg.attachment">
              <img
                v-if="msg.attachment.type === 'image' && msg.attachment.preview"
                :src="msg.attachment.preview"
                class="attachment-image-large"
                @click="openImageViewer(msg.attachment!.preview!)"
              >
              <div
                v-if="msg.attachment.type === 'pdf'"
                class="attachment-pdf"
                @click="pdfDataByMsgId.has(msg.id) && openPdfViewer(pdfDataByMsgId.get(msg.id)!)"
              >
                <i class="pi pi-file-pdf" />
                {{ msg.attachment.name }}
              </div>
            </template>
            <div class="chat-markdown" v-html="renderMarkdown(msg.content)" />
            <template v-if="msg.toolResults?.length">
              <ToolResultCard
                v-for="(tr, ti) in msg.toolResults"
                :key="ti"
                :result="tr"
              />
            </template>
          </div>
        </div>

        <div v-if="showSuggestions" class="chat-suggestions">
          <button
            v-for="s in suggestions"
            :key="s.label"
            class="chat-suggestion-chip"
            @click="applySuggestion(s.prompt)"
          >
            <i :class="s.icon" />
            {{ s.label }}
          </button>
        </div>

        <div v-if="loading" class="chat-message chat-message-assistant">
          <div class="chat-message-name">
            Assistent
          </div>
          <div class="chat-message-bubble bubble-assistant">
            <ProgressSpinner style="width: 24px; height: 24px" stroke-width="4" />
          </div>
        </div>
      </div>
    </ScrollPanel>

    <template #footer>
      <Divider class="chat-divider" />

      <div v-if="pendingFiles.length" class="pending-files">
        <Chip
          v-for="(pf, i) in pendingFiles"
          :key="pf.name"
          :label="pf.name"
          :icon="pf.type === 'image' ? 'pi pi-image' : 'pi pi-file-pdf'"
          removable
          @remove="removePendingFile(i)"
        />
      </div>

      <div class="chat-drop-hint" @click="pickFile">
        <i class="pi pi-cloud-upload" />
        <span>Dateien hierher ziehen oder klicken</span>
      </div>

      <div class="chat-input-row">
        <input
          ref="fileInput"
          type="file"
          accept="image/*,application/pdf"
          multiple
          style="display: none"
          @change="onFileChange"
        >
        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          style="display: none"
          @change="onFileChange"
        >
        <Button
          v-tooltip.top="'Foto aufnehmen'"
          icon="pi pi-camera"
          text
          rounded
          severity="secondary"
          class="chat-camera-btn"
          @click="pickCamera"
        />
        <Button
          v-tooltip.top="'Chat maximieren'"
          :icon="maximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          text
          rounded
          severity="secondary"
          class="chat-maximize-btn"
          @click="maximized = !maximized"
        />
        <Textarea
          v-model="input"
          class="chat-input"
          placeholder="Nachricht..."
          auto-resize
          rows="1"
          @keydown.enter.exact.prevent="send"
        />
        <Button
          class="chat-fab-send"
          icon="pi pi-send"
          rounded
          :loading="loading"
          @click="send"
        />
      </div>
    </template>
  </Drawer>

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

.chat-drawer :deep(.p-drawer-content) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.chat-title {
  font-weight: 600;
  font-size: 1.1rem;
}

.chat-header-actions {
  display: flex;
  gap: 0.25rem;
}

.chat-scroll {
  flex: 1;
  width: 100%;
  height: 100%;
}

.chat-scroll :deep(.p-scrollpanel-content) {
  padding: 1rem;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-message {
  display: flex;
  flex-direction: column;
}

.chat-message-user {
  align-items: flex-end;
}

.chat-message-assistant {
  align-items: flex-start;
}

.chat-message-name {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

.chat-message-bubble {
  max-width: 85%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  word-break: break-word;
}

.bubble-user {
  background: linear-gradient(135deg, var(--p-primary-color), var(--p-primary-600));
  color: var(--p-primary-contrast-color);
  border-bottom-right-radius: 0.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.bubble-assistant {
  background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
  color: var(--p-text-color);
  border: 1px solid color-mix(in srgb, var(--p-text-color) 15%, transparent);
  border-bottom-left-radius: 0.25rem;
}

.attachment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.attachment-image {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
}

.attachment-image-large {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.attachment-pdf {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.attachment-pdf i {
  font-size: 1.25rem;
}

.chat-divider {
  margin: 0;
}

.pending-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 1rem 0;
}

.chat-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.chat-input {
  flex: 1;
}

.chat-drop-hint {
  border: 1px dashed var(--p-surface-300);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.chat-drop-hint:hover {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.chat-split-layout {
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.chat-cards-panel {
  width: 30%;
  min-width: 250px;
  border-right: 1px solid color-mix(in srgb, var(--p-text-color) 15%, transparent);
}

.chat-cards-panel :deep(.p-scrollpanel-content) {
  padding: 1rem;
}

.chat-cards-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-main-panel {
  flex: 1;
  width: 70%;
}

.chat-main-panel :deep(.p-scrollpanel-content) {
  padding: 1rem;
}

.chat-drop-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-ground));
  border: 2px dashed var(--p-primary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  z-index: 10;
  color: var(--p-primary-color);
  font-weight: 500;
}

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.chat-suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  border-radius: 1.5rem;
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 40%, transparent);
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  color: var(--p-primary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.chat-suggestion-chip:hover {
  background: color-mix(in srgb, var(--p-primary-color) 18%, transparent);
  border-color: var(--p-primary-color);
}

.chat-suggestion-chip i {
  font-size: 0.9rem;
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
