// Local, browser-based experimental analysis.
// Runs entirely on-device: a small quantized image classifier plus measured
// canvas image statistics. No network requests are made for analysis; the
// model files are downloaded once (first use) and then cached by the browser.
// This is NOT trained wall-stain/moisture detection.

export const LOCAL_MODEL_ID = 'Xenova/mobilevit-small'

const MAX_ANALYSIS_EDGE = 512
const COLOR_BUCKET = 32

let classifierPromise = null
let transformersModulePromise = null

function loadTransformers() {
  if (!transformersModulePromise) {
    transformersModulePromise = import('@huggingface/transformers')
  }
  return transformersModulePromise
}

export function getLocalSupport() {
  const issues = []
  const warnings = []
  if (typeof document === 'undefined' || !document.createElement('canvas').getContext) {
    issues.push('Canvas image processing is not supported in this browser.')
  }
  if (typeof WebAssembly === 'undefined') {
    issues.push('WebAssembly is not available, so the local model cannot run.')
  }
  if (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 2) {
    warnings.push('This device reports limited memory; large photos may be slow or fail locally.')
  }
  if (typeof Worker === 'undefined') {
    warnings.push('Web Workers are unavailable; the model may briefly pause the page while it runs.')
  }
  return { supported: issues.length === 0, issues, warnings }
}

export async function ensureLocalModel(onProgress) {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      try {
        const { pipeline, env } = await loadTransformers()
        env.allowLocalModels = false
        const classifier = await pipeline('image-classification', LOCAL_MODEL_ID, {
          dtype: 'q8',
          progress_callback: (event) => {
            if (!onProgress) return
            if (event.status === 'progress' && event.total) {
              onProgress({
                phase: 'downloading',
                file: event.file || 'model files',
                percent: Math.round((event.loaded / event.total) * 100),
                loadedMB: event.loaded / 1048576,
                totalMB: event.total / 1048576,
              })
            } else if (event.status === 'ready' || event.status === 'done') {
              onProgress({ phase: 'ready' })
            } else {
              onProgress({ phase: 'initializing' })
            }
          },
        })
        return classifier
      } catch (error) {
        classifierPromise = null
        throw error
      }
    })()
  }
  return classifierPromise
}

export async function resetLocalModel() {
  if (classifierPromise) {
    try {
      const classifier = await classifierPromise
      if (classifier && typeof classifier.dispose === 'function') {
        await classifier.dispose()
      }
    } catch {
      // Model never finished loading; nothing to dispose.
    }
  }
  classifierPromise = null
}

function imageDimensions(image) {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  }
}

function canvasForImage(image, maxEdge) {
  const source = imageDimensions(image)
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, width, height)
  return { canvas, context, width, height }
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Some browsers cannot decode every uploaded format through createImageBitmap.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image could not be read in the browser. Try a JPEG, PNG, or WebP image.'))
    }
    image.src = url
  })
}

function releaseImage(image) {
  if (image && typeof image.close === 'function') image.close()
}

function bucketKey(r, g, b) {
  return `${Math.floor(r / COLOR_BUCKET)},${Math.floor(g / COLOR_BUCKET)},${Math.floor(b / COLOR_BUCKET)}`
}

function colorName(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max - min < 18) {
    if (lightness < 45) return 'very dark gray / near-black'
    if (lightness < 95) return 'dark gray'
    if (lightness < 170) return 'gray'
    if (lightness < 225) return 'light gray'
    return 'near-white'
  }
  let hue = 0
  if (max === r) hue = ((g - b) / (max - min)) * 60
  else if (max === g) hue = 120 + ((b - r) / (max - min)) * 60
  else hue = 240 + ((r - g) / (max - min)) * 60
  if (hue < 0) hue += 360
  if (hue < 15 || hue >= 345) return 'reddish tone'
  if (hue < 45) return 'orange / brown tone'
  if (hue < 70) return 'yellowish tone'
  if (hue < 160) return 'greenish tone'
  if (hue < 200) return 'cyan / teal tone'
  if (hue < 255) return ' bluish tone'.trim()
  if (hue < 290) return 'violet tone'
  return 'pink / magenta tone'
}

function measureImage(image) {
  const source = imageDimensions(image)
  const { context, width, height } = canvasForImage(image, MAX_ANALYSIS_EDGE)
  const { data } = context.getImageData(0, 0, width, height)
  const pixelCount = width * height

  let sum = 0
  let darkCount = 0
  let veryDarkCount = 0
  let brightCount = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0
  const buckets = new Map()
  const luminance = new Float32Array(pixelCount)

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const value = 0.299 * r + 0.587 * g + 0.114 * b
    luminance[p] = value
    sum += value
    if (value < 85) darkCount += 1
    if (value < 45) veryDarkCount += 1
    if (value > 205) brightCount += 1
    redSum += r
    greenSum += g
    blueSum += b
    const key = bucketKey(r, g, b)
    const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 }
    entry.count += 1
    entry.r += r
    entry.g += g
    entry.b += b
    buckets.set(key, entry)
  }

  const mean = sum / pixelCount
  let variance = 0
  for (let p = 0; p < pixelCount; p += 1) {
    const diff = luminance[p] - mean
    variance += diff * diff
  }
  const stdDev = Math.sqrt(variance / pixelCount)

  let edgeSum = 0
  let maxRegionDarkShare = 0
  const regionSize = 3
  const cellW = Math.floor(width / regionSize)
  const cellH = Math.floor(height / regionSize)
  for (let gy = 0; gy < regionSize; gy += 1) {
    for (let gx = 0; gx < regionSize; gx += 1) {
      let regionTotal = 0
      let regionDark = 0
      for (let y = gy * cellH; y < (gy + 1) * cellH; y += 1) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x += 1) {
          const value = luminance[y * width + x]
          regionTotal += 1
          if (value < 85) regionDark += 1
          if (x + 1 < width) edgeSum += Math.abs(value - luminance[y * width + x + 1])
          if (y + 1 < height) edgeSum += Math.abs(value - luminance[(y + 1) * width + x])
        }
      }
      if (regionTotal > 0) {
        maxRegionDarkShare = Math.max(maxRegionDarkShare, regionDark / regionTotal)
      }
    }
  }
  const edgePairs = pixelCount * 2
  const edgeDensity = edgePairs > 0 ? edgeSum / edgePairs / 255 : 0

  const sortedBuckets = [...buckets.values()].sort((a, b) => b.count - a.count)
  const dominantColors = sortedBuckets.slice(0, 4).map((entry) => ({
    r: Math.round(entry.r / entry.count),
    g: Math.round(entry.g / entry.count),
    b: Math.round(entry.b / entry.count),
    share: Math.round((entry.count / pixelCount) * 100),
    name: colorName(
      Math.round(entry.r / entry.count),
      Math.round(entry.g / entry.count),
      Math.round(entry.b / entry.count),
    ),
  }))

  return {
    width: source.width,
    height: source.height,
    analyzedWidth: width,
    analyzedHeight: height,
    meanBrightness: Math.round(mean),
    brightnessStdDev: Math.round(stdDev),
    darkPixelShare: Math.round((darkCount / pixelCount) * 100),
    veryDarkPixelShare: Math.round((veryDarkCount / pixelCount) * 100),
    brightPixelShare: Math.round((brightCount / pixelCount) * 100),
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    maxRegionDarkShare: Math.round(maxRegionDarkShare * 100),
    dominantColors,
  }
}

function describeMetrics(metrics) {
  const notes = []
  if (metrics.meanBrightness < 70) notes.push('Overall the photo is quite dark; details may be hidden by low light.')
  else if (metrics.meanBrightness > 195) notes.push('Overall the photo is very bright; faint marks can be washed out.')
  else notes.push('Overall brightness is in a moderate range for visual inspection.')

  if (metrics.darkPixelShare >= 30) notes.push(`${metrics.darkPixelShare}% of pixels are dark. Large dark areas can be shadow, dark paint, or surface discoloration — measurement alone cannot distinguish these.`)
  else if (metrics.darkPixelShare >= 8) notes.push(`${metrics.darkPixelShare}% of pixels are dark, spread across the frame or concentrated in patches.`)
  else notes.push(`Only ${metrics.darkPixelShare}% of pixels are dark; no large dark region dominates the frame.`)

  if (metrics.maxRegionDarkShare >= 55 && metrics.darkPixelShare >= 8) {
    notes.push(`Dark pixels are concentrated: one region of the frame is ${metrics.maxRegionDarkShare}% dark, which suggests a localized patch rather than overall darkness.`)
  }

  if (metrics.brightnessStdDev >= 62) notes.push('Brightness varies a lot across the frame (high contrast), which can come from uneven lighting as well as surface variation.')
  else if (metrics.brightnessStdDev <= 22) notes.push('Brightness is very uniform, typical of a plain, evenly lit surface.')

  if (metrics.edgeDensity >= 0.08) notes.push('There is a lot of fine detail/edges (texture, pattern, or clutter), so small marks may be hard to isolate.')
  else if (metrics.edgeDensity <= 0.02) notes.push('The surface looks smooth with few edges or strong texture changes.')

  return notes
}

async function classifyImage(classifier, file) {
  const url = URL.createObjectURL(file)
  try {
    const output = await classifier(url, { topk: 5 })
    const list = Array.isArray(output) ? output : [output]
    return list
      .filter((item) => item && typeof item.label === 'string')
      .map((item) => ({ label: item.label, score: Math.round(item.score * 1000) / 1000 }))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function localErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || '')
  if (/could not be decoded|invalid image|unreadable|not.*image/i.test(raw)) {
    return 'This file could not be decoded as an image in the browser. Choose a valid JPEG, PNG, or WebP photo.'
  }
  if (/fetch|network|failed to load|load.*model|404|not found/i.test(raw)) {
    return 'The local model could not be downloaded or loaded. First-time setup needs an internet connection to download about 6 MB of model files; after a successful load, the browser may reuse its cache for later local analysis. Check your connection and try again.'
  }
  if (/memory|allocation|out of memory|wasm/i.test(raw)) {
    return 'The browser could not allocate enough memory for the local model. Close heavy tabs, use a smaller image, or try a recent desktop browser.'
  }
  return raw || 'Local analysis failed unexpectedly. Try another image or use API AI mode.'
}

export async function analyzeLocalImage(file, onProgress) {
  const support = getLocalSupport()
  if (!support.supported) {
    throw new Error(`Local AI is not supported here: ${support.issues.join(' ')}`)
  }

  let image
  try {
    const startedAt = performance.now()
    onProgress?.({ phase: 'processing' })
    image = await loadImage(file)
    const metrics = measureImage(image)
    const measurementMs = Math.round(performance.now() - startedAt)

    onProgress?.({ phase: 'initializing' })
    const classifier = await ensureLocalModel(onProgress)
    onProgress?.({ phase: 'inferring' })
    const inferenceStartedAt = performance.now()
    const predictions = await classifyImage(classifier, file)
    const inferenceMs = Math.round(performance.now() - inferenceStartedAt)

    return {
      engine: 'local-experimental',
      model: {
        id: LOCAL_MODEL_ID,
        task: 'General image classification (ImageNet-1k labels)',
        note: 'General-purpose model. It was not trained to detect wall stains, moisture, or mold.',
      },
      file: {
        name: file.name,
        sizeBytes: file.size,
        type: file.type || 'image',
        width: metrics.width,
        height: metrics.height,
      },
      metrics,
      interpretation: describeMetrics(metrics),
      predictions,
      inferenceMs,
      measurementMs,
      limitations: [
        'This local mode does not diagnose moisture, mold, leaks, or their causes.',
        'Dark-region measurements describe pixels only; they cannot tell damp from shadow, dirt, or dark paint.',
        'Classifier labels are general ImageNet categories and may be irrelevant to walls.',
        'Use API AI mode (Meta AI via your FastAPI backend) for visual investigation guidance.',
      ],
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    throw new Error(localErrorMessage(error))
  } finally {
    releaseImage(image)
  }
}

function percentPointDelta(next, previous) {
  return Math.round((next - previous) * 10) / 10
}

async function imageDataForFile(file, width = 320, height = 320) {
  const image = await loadImage(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0, width, height)
    return context.getImageData(0, 0, width, height)
  } finally {
    releaseImage(image)
  }
}

function heatColor(value) {
  const t = Math.min(1, Math.max(0, value))
  if (t < 0.33) return [34, 211, 238]
  if (t < 0.66) return [250, 204, 21]
  return [248, 113, 113]
}

export async function createImageDifference(previousFile, nextFile) {
  if (!previousFile || !nextFile) return null
  const width = 320
  const height = 320
  const [previous, next] = await Promise.all([
    imageDataForFile(previousFile, width, height),
    imageDataForFile(nextFile, width, height),
  ])

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputContext = outputCanvas.getContext('2d')
  const output = outputContext.createImageData(width, height)

  let changedPixels = 0
  let totalDifference = 0
  const threshold = 28
  for (let i = 0; i < previous.data.length; i += 4) {
    const difference = (
      Math.abs(previous.data[i] - next.data[i]) +
      Math.abs(previous.data[i + 1] - next.data[i + 1]) +
      Math.abs(previous.data[i + 2] - next.data[i + 2])
    ) / 3
    totalDifference += difference
    const normalized = Math.min(1, difference / 160)
    const [r, g, b] = heatColor(normalized)
    const base = 28 + normalized * 42
    output.data[i] = Math.min(255, base + r * normalized)
    output.data[i + 1] = Math.min(255, base + g * normalized)
    output.data[i + 2] = Math.min(255, base + b * normalized)
    output.data[i + 3] = 255
    if (difference >= threshold) changedPixels += 1
  }

  outputContext.putImageData(output, 0, 0)
  const pixelCount = width * height
  return {
    dataUrl: outputCanvas.toDataURL('image/png'),
    width,
    height,
    changedPixelShare: Math.round((changedPixels / pixelCount) * 1000) / 10,
    meanPixelDifference: Math.round((totalDifference / pixelCount) * 10) / 10,
    note: 'Heatmap is a resized pixel-difference visualization. Camera position, lighting, exposure, and compression can create differences without any physical change to the wall.',
  }
}

export function compareLocalAnalyses(previous, next) {
  if (!previous?.metrics || !next?.metrics) return null
  const a = previous.metrics
  const b = next.metrics
  const rows = [
    {
      label: 'Average brightness',
      previous: `${a.meanBrightness} / 255`,
      next: `${b.meanBrightness} / 255`,
      delta: percentPointDelta(b.meanBrightness, a.meanBrightness),
      unit: 'points',
    },
    {
      label: 'Brightness variation (contrast)',
      previous: `${a.brightnessStdDev}`,
      next: `${b.brightnessStdDev}`,
      delta: percentPointDelta(b.brightnessStdDev, a.brightnessStdDev),
      unit: 'points',
    },
    {
      label: 'Dark pixel share',
      previous: `${a.darkPixelShare}%`,
      next: `${b.darkPixelShare}%`,
      delta: percentPointDelta(b.darkPixelShare, a.darkPixelShare),
      unit: 'percentage points',
    },
    {
      label: 'Very dark pixel share',
      previous: `${a.veryDarkPixelShare}%`,
      next: `${b.veryDarkPixelShare}%`,
      delta: percentPointDelta(b.veryDarkPixelShare, a.veryDarkPixelShare),
      unit: 'percentage points',
    },
    {
      label: 'Bright pixel share',
      previous: `${a.brightPixelShare}%`,
      next: `${b.brightPixelShare}%`,
      delta: percentPointDelta(b.brightPixelShare, a.brightPixelShare),
      unit: 'percentage points',
    },
    {
      label: 'Edge / texture density',
      previous: `${a.edgeDensity}`,
      next: `${b.edgeDensity}`,
      delta: Math.round((b.edgeDensity - a.edgeDensity) * 1000) / 1000,
      unit: 'index points',
    },
  ]
  return {
    rows,
    note: 'These are pixel measurements between two photos. Lighting, distance, and angle changes can create large differences without any physical change to the wall. They do not prove stain growth or a cause.',
  }
}
