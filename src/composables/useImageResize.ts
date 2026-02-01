/**
 * Resize images before sending to Vision APIs.
 *
 * Mistral Vision Limits (docs.mistral.ai/capabilities/vision):
 * - Max 8 images per request, max 10 MB per image
 * - Max 10.000×10.000 px (error above), formats: JPEG, PNG, WEBP, GIF
 * - Mistral Small: internally downscales to 1540×1540
 * - Tokens per image: (W × H) / 784 ≈ max 3.025 at 1540×1540
 */
export function resizeImage(
  file: File,
  maxSize = 1540,
  quality = 0.8,
): Promise<{ dataUrl: string, base64: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve({ dataUrl, base64: dataUrl.split(',')[1] ?? '' })
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Resize a base64-encoded image string (without data URL prefix).
 * Useful when the image is already in base64 but needs to be resized.
 */
export function resizeBase64Image(
  base64: string,
  maxSize = 1540,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1] ?? '')
    }
    img.src = `data:image/jpeg;base64,${base64}`
  })
}
