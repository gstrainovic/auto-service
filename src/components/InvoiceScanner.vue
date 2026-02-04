<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import { resizeImage } from '../composables/useImageResize'

const emit = defineEmits<{ captured: [base64: string] }>()
const preview = ref('')
const useCamera = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const { dataUrl, base64 } = await resizeImage(file)
  preview.value = dataUrl
  emit('captured', base64)
  input.value = ''
}

function triggerFileSelect(): void {
  if (fileInputRef.value) {
    fileInputRef.value.capture = useCamera.value ? 'environment' : ''
    fileInputRef.value.click()
  }
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
</style>
