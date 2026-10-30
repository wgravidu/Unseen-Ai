// Browser-side photo quality gate and API-payload compression.
// Keeps the original untouched for preview/report; compressed copies only upload.

export const PHOTO_QUALITY_THRESHOLDS = {
  darkBrightness: 52,
  brightBrightness: 222,
  blurryDetail: 1.5,
  distantDetail: 3.5,
}

const SAMPLE_EDGE = 256

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => null)
  }
  return Promise.resolve(null)
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image could not be read'))
    }
    image.src = url
  })
}

async function loadSource(file) {
  return (await loadBitmap(file)) || loadImageElement(file)
}

function drawToCanvas(source, maxEdge) {
  const sourceWidth = source.naturalWidth || source.width
  const sourceHeight = source.naturalHeight || source.height
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0, width, height)
  return { canvas, context, width, height }
}

export function assessPixels(data, width, height) {
  const luminance = new Float32Array(width * height)
  let sum = 0
  let edgeSum = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const i = p * 4
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      luminance[p] = value
      sum += value
      if (x > 0) edgeSum += Math.abs(value - luminance[p - 1])
      if (y > 0) edgeSum += Math.abs(value - luminance[p - width])
    }
  }
  const brightness = sum / Math.max(1, width * height)
  const detail = edgeSum / Math.max(1, width * height)
  let status = 'ready'
  let reason = null
  if (brightness < PHOTO_QUALITY_THRESHOLDS.darkBrightness) {
    status = 'insufficient_evidence'
    reason = 'dark'
  } else if (brightness > PHOTO_QUALITY_THRESHOLDS.brightBrightness && detail < 6) {
    status = 'insufficient_evidence'
    reason = 'bright'
  } else if (detail < PHOTO_QUALITY_THRESHOLDS.blurryDetail) {
    status = 'insufficient_evidence'
    reason = 'blurry'
  } else if (detail < PHOTO_QUALITY_THRESHOLDS.distantDetail) {
    // Very little edge content anywhere usually means the wall fills little of
    // the frame or is too far/plain to assess. A plain close wall with some
    // texture still passes the blur threshold above.
    status = 'insufficient_evidence'
    reason = 'tooFar'
  }
  return {
    status,
    reason,
    brightness: Math.round(brightness),
    detail: Math.round(detail * 10) / 10,
  }
}

export async function assessPhotoQuality(file) {
  if (!file) return { status: 'ready', reason: null }
  try {
    const source = await loadSource(file)
    try {
      const { context, width, height } = drawToCanvas(source, SAMPLE_EDGE)
      const { data } = context.getImageData(0, 0, width, height)
      return assessPixels(data, width, height)
    } finally {
      if (typeof source.close === 'function') source.close()
    }
  } catch {
    // If quality measurement itself fails, do not block the normal API flow.
    return { status: 'unknown', reason: null }
  }
}

export async function compressImageForApi(file, maxEdge = 1024) {
  if (!file) return file
  try {
    const source = await loadSource(file)
    try {
      const sourceWidth = source.naturalWidth || source.width
      const sourceHeight = source.naturalHeight || source.height
      const { canvas } = drawToCanvas(source, maxEdge)
      const blob = await new Promise((resolve) => {
        if (canvas.toBlob) canvas.toBlob(resolve, 'image/webp', 0.82)
        else resolve(null)
      })
      if (!blob || blob.size >= file.size && Math.max(sourceWidth, sourceHeight) <= maxEdge) return file
      const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '')
      return new File([blob], `${baseName}-1024.webp`, { type: 'image/webp', lastModified: Date.now() })
    } finally {
      if (typeof source.close === 'function') source.close()
    }
  } catch {
    return file
  }
}

export async function prepareImagesForApi(files) {
  const prepared = []
  for (const file of files) prepared.push(await compressImageForApi(file))
  return prepared
}
