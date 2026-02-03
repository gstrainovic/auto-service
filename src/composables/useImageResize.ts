import { createWorker } from 'tesseract.js'

/**
 * Resize images before sending to Vision APIs.
 * Uses createImageBitmap() to correctly handle EXIF orientation.
 * Output: Grayscale WebP at 75% quality (~58% smaller than JPEG 80%).
 *
 * Mistral Vision Limits (docs.mistral.ai/capabilities/vision):
 * - Max 8 images per request, max 10 MB per image
 * - Max 10.000×10.000 px (error above), formats: JPEG, PNG, WEBP, GIF
 * - Mistral Small: internally downscales to 1540×1540
 * - Tokens per image: (W × H) / 784 ≈ max 3.025 at 1540×1540
 */

const OUTPUT_MIME = 'image/webp'
const OUTPUT_QUALITY = 0.75

/**
 * Check if browser supports WebP canvas export; fall back to JPEG if not.
 */
let _webpSupported: boolean | null = null
function supportsWebpExport(): boolean {
  if (_webpSupported !== null)
    return _webpSupported
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  _webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp')
  return _webpSupported
}

function getOutputFormat(): { mime: string, quality: number } {
  if (supportsWebpExport())
    return { mime: OUTPUT_MIME, quality: OUTPUT_QUALITY }
  return { mime: 'image/jpeg', quality: 0.8 }
}

export function getImageMimeType(): string {
  return getOutputFormat().mime
}

export async function resizeImage(
  file: File,
  maxSize = 1540,
): Promise<{ dataUrl: string, base64: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let { width, height } = bitmap
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1)'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const { mime, quality } = getOutputFormat()
  const dataUrl = canvas.toDataURL(mime, quality)
  return { dataUrl, base64: dataUrl.split(',')[1] ?? '' }
}

/**
 * Resize a base64-encoded image string (without data URL prefix).
 * Useful when the image is already in base64 but needs to be resized.
 */
export async function resizeBase64Image(
  base64: string,
  maxSize = 1540,
): Promise<string> {
  const { mime, quality } = getOutputFormat()
  const resp = await fetch(`data:${mime};base64,${base64}`)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  let { width, height } = bitmap
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1)'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const dataUrl = canvas.toDataURL(mime, quality)
  return dataUrl.split(',')[1] ?? ''
}

/**
 * Rotate a base64-encoded image by the given degrees (90, 180, 270) clockwise.
 * Returns a new base64 string (without data URL prefix).
 */
export async function rotateBase64Image(
  base64: string,
  degrees: 90 | 180 | 270,
): Promise<string> {
  const { mime, quality } = getOutputFormat()
  const resp = await fetch(`data:${mime};base64,${base64}`)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  const swap = degrees === 90 || degrees === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? height : width
  canvas.height = swap ? width : height
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(bitmap, -width / 2, -height / 2)
  bitmap.close()
  const dataUrl = canvas.toDataURL(mime, quality)
  return dataUrl.split(',')[1] ?? ''
}

/**
 * Detect text orientation using Tesseract.js OSD (free, runs in browser via WASM).
 * Returns the degrees the image needs to be rotated CW to make text upright.
 * Returns 0 if detection fails or text is already upright.
 */
async function detectOrientation(base64: string): Promise<0 | 90 | 180 | 270> {
  try {
    const { mime } = getOutputFormat()
    const worker = await createWorker('osd', 0, {
      legacyCore: true,
      legacyLang: true,
    })
    const result = await worker.detect(`data:${mime};base64,${base64}`)
    await worker.terminate()
    const deg = result.data?.orientation_degrees
    if (deg === 90 || deg === 180 || deg === 270)
      return deg
    return 0
  }
  catch {
    return 0
  }
}

/**
 * Auto-rotate document images using Tesseract.js OSD (free, local, no API calls).
 * Only rotates landscape images where text is sideways.
 */
export async function autoRotateForDocument(
  base64: string,
): Promise<string> {
  const { mime } = getOutputFormat()
  const resp = await fetch(`data:${mime};base64,${base64}`)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  if (width <= height)
    return base64

  const degrees = await detectOrientation(base64)
  if (degrees === 0)
    return rotateBase64Image(base64, 90)
  return rotateBase64Image(base64, degrees)
}
