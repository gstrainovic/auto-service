<script setup lang="ts">
import { ref } from 'vue'
import { resizeImage } from '../composables/useImageResize'

const emit = defineEmits<{ captured: [base64: string] }>()
const file = ref<File | null>(null)
const preview = ref('')
const useCamera = ref(true)

async function onFileSelected(f: File | null) {
  if (!f)
    return
  const { dataUrl, base64 } = await resizeImage(f)
  preview.value = dataUrl
  emit('captured', base64)
}
</script>

<template>
  <div>
    <q-file
      v-model="file"
      label="Rechnung fotografieren oder hochladen"
      outlined
      accept="image/*"
      :capture="useCamera ? 'environment' : undefined"
      @update:model-value="onFileSelected"
    >
      <template #prepend>
        <q-icon name="attach_file" />
      </template>
    </q-file>

    <div class="q-mt-sm q-gutter-sm">
      <q-btn
        flat
        :color="useCamera ? 'primary' : 'grey'"
        icon="photo_camera"
        label="Kamera"
        @click="useCamera = true"
      />
      <q-btn
        flat
        :color="!useCamera ? 'primary' : 'grey'"
        icon="upload_file"
        label="Datei"
        @click="useCamera = false"
      />
    </div>

    <q-img v-if="preview" :src="preview" class="q-mt-md" style="max-height: 300px" />
  </div>
</template>
