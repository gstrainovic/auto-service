/**
 * Resize images before sending to Vision APIs.
 * Mistral Small 3.1 internally caps at 1540px (longest side)
 * and tokenizes at 28×28 px per token — anything larger is wasted bandwidth.
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
