import { ref } from 'vue'
import { resizeImage } from './useImageResize'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function useImageUpload(maxSize = 1540) {
  const imagePreview = ref<string | null>(null)
  const imageBase64 = ref<string | null>(null)
  const error = ref<string | null>(null)
  const isProcessing = ref(false)

  async function handleFile(file: File) {
    error.value = null
    if (!ALLOWED_TYPES.includes(file.type)) {
      error.value = 'Nur JPEG, PNG oder WebP erlaubt'
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      error.value = 'Datei zu groß (max 10 MB)'
      return
    }

    isProcessing.value = true
    try {
      const { dataUrl, base64 } = await resizeImage(file, maxSize)
      imagePreview.value = dataUrl
      imageBase64.value = base64
    }
    catch {
      error.value = 'Bild konnte nicht verarbeitet werden'
    }
    finally {
      isProcessing.value = false
    }
  }

  function clear() {
    imagePreview.value = null
    imageBase64.value = null
    error.value = null
  }

  return { imagePreview, imageBase64, error, isProcessing, handleFile, clear }
}
