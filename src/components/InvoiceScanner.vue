<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import { resizeImage } from '../composables/useImageResize'

const emit = defineEmits<{ captured: [base64: string] }>()
const preview = ref('')
const useCamera = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

async function handleFile(file: File): Promise<void> {
  const { dataUrl, base64 } = await resizeImage(file)
  preview.value = dataUrl
  emit('captured', base64)
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  await handleFile(file)
  input.value = ''
}

function triggerFileSelect(): void {
  if (fileInputRef.value) {
    fileInputRef.value.capture = useCamera.value ? 'environment' : ''
    fileInputRef.value.click()
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  isDragging.value = false
  const files = event.dataTransfer?.files
  const file = files?.[0]
  if (file)
    await handleFile(file)
}
</script>

<template>
  <div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="onFileSelected"
    >

    <Button
      :label="useCamera ? 'Kamera' : 'Datei wählen'"
      :icon="useCamera ? 'pi pi-camera' : 'pi pi-upload'"
      outlined
      class="w-full"
      @click="triggerFileSelect"
    />

    <div class="flex gap-2 mt-2">
      <Button
        icon="pi pi-camera"
        label="Kamera"
        :text="!useCamera"
        :severity="useCamera ? undefined : 'secondary'"
        @click="useCamera = true"
      />
      <Button
        icon="pi pi-upload"
        label="Datei"
        :text="useCamera"
        :severity="!useCamera ? undefined : 'secondary'"
        @click="useCamera = false"
      />
    </div>

    <div
      class="drop-zone"
      :class="{ 'drop-zone-active': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <i class="pi pi-cloud-upload drop-icon" />
      <div>Foto oder PDF hierher ziehen</div>
    </div>

    <img v-if="preview" :src="preview" class="preview-image mt-4">
  </div>
</template>

<style scoped>
.hidden-file-input {
  display: none;
}

.preview-image {
  max-height: 300px;
  max-width: 100%;
  object-fit: contain;
}

.drop-zone {
  border: 2px dashed var(--p-surface-300);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
  transition: all 0.2s;
  margin-top: 1rem;
}

.drop-zone-active {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.drop-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
</style>
