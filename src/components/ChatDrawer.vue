<script setup lang="ts">
import type { ChatMessage } from '../services/chat'
import { nextTick, ref, watch } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { sendChatMessage, WELCOME_MESSAGE } from '../services/chat'
import { useSettingsStore } from '../stores/settings'

const open = defineModel<boolean>({ default: false })

const settings = useSettingsStore()
const { dbPromise } = useDatabase()

const messages = ref<ChatMessage[]>([WELCOME_MESSAGE])
const input = ref('')
const loading = ref(false)
const pendingFile = ref<{ file: File, type: 'image' | 'pdf', name: string, preview: string, base64: string } | null>(null)
const scrollArea = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)

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
  const file = target.files?.[0]
  if (!file)
    return

  const isImage = file.type.startsWith('image/')
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    const base64 = dataUrl.split(',')[1] ?? ''
    pendingFile.value = {
      file,
      type: isImage ? 'image' : 'pdf',
      name: file.name,
      preview: isImage ? dataUrl : '',
      base64,
    }
  }
  reader.readAsDataURL(file)
  target.value = ''
}

async function send() {
  const text = input.value.trim()
  if (!text && !pendingFile.value)
    return

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text || (pendingFile.value ? `[${pendingFile.value.name}]` : ''),
    attachment: pendingFile.value
      ? { type: pendingFile.value.type, name: pendingFile.value.name, preview: pendingFile.value.preview }
      : undefined,
  }

  const imageBase64 = pendingFile.value?.type === 'image' ? pendingFile.value.base64 : undefined

  messages.value.push(userMsg)
  input.value = ''
  pendingFile.value = null
  loading.value = true

  try {
    const db = await dbPromise
    const response = await sendChatMessage(db, messages.value, {
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
    }, imageBase64)

    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response || 'Erledigt.',
    })
  }
  catch (e: any) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Fehler: ${e.message}`,
    })
  }
  finally {
    loading.value = false
  }
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
              <img
                v-if="msg.attachment?.type === 'image' && msg.attachment.preview"
                :src="msg.attachment.preview"
                style="max-width: 200px; max-height: 150px; border-radius: 8px"
                class="q-mb-xs"
              >
              <div v-if="msg.attachment?.type === 'pdf'" class="q-mb-xs">
                <q-icon name="picture_as_pdf" size="sm" />
                {{ msg.attachment.name }}
              </div>
              <div style="white-space: pre-wrap" v-text="msg.content" />
            </div>
          </q-chat-message>

          <q-chat-message v-if="loading" name="Assistent" bg-color="grey-3">
            <q-spinner-dots size="2em" />
          </q-chat-message>
        </div>
      </q-scroll-area>

      <q-separator />

      <div v-if="pendingFile" class="q-px-md q-pt-sm">
        <q-chip
          removable
          color="primary"
          text-color="white"
          :icon="pendingFile.type === 'image' ? 'image' : 'picture_as_pdf'"
          @remove="pendingFile = null"
        >
          {{ pendingFile.name }}
        </q-chip>
      </div>

      <div class="q-pa-sm row items-end no-wrap q-gutter-xs">
        <input
          ref="fileInput"
          type="file"
          accept="image/*,application/pdf"
          style="display: none"
          @change="onFileChange"
        >
        <q-btn flat round dense icon="attach_file" @click="pickFile">
          <q-tooltip>Foto oder PDF anhängen</q-tooltip>
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
</template>

<style scoped>
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}
</style>
