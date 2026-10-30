// Tuned for the 96x72 sample frame. Edge energy drops when the frame is
// blurry or filling the view with a plain area; frame-to-frame change spikes
// while the phone is moving.
export const GUIDE_THRESHOLDS = {
  darkBrightness: 55,
  brightBrightness: 215,
  blurryDetail: 1.6,
  lowDetail: 2.2,
  steadyMotion: 2.5,
  movingMotion: 7,
  closerCoverage: 0.35,
}

export function classifyGuideFrame({ brightness, detail, motion }) {
  if (brightness < GUIDE_THRESHOLDS.darkBrightness) return 'dark'
  if (brightness > GUIDE_THRESHOLDS.brightBrightness) return 'bright'
  if (motion >= GUIDE_THRESHOLDS.movingMotion || detail < GUIDE_THRESHOLDS.blurryDetail) return 'blurry'
  if (motion >= GUIDE_THRESHOLDS.steadyMotion) return 'moving'
  return 'good'
}

export function measureSubjectCoverage(data, width, height) {
  const x0 = Math.floor(width * 0.25)
  const x1 = Math.ceil(width * 0.75)
  const y0 = Math.floor(height * 0.25)
  const y1 = Math.ceil(height * 0.75)
  let sum = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue
      const i = (y * width + x) * 4
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      count += 1
    }
  }
  const borderMean = sum / Math.max(1, count)
  let subject = 0
  let total = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (Math.abs(value - borderMean) > 14) subject += 1
      total += 1
    }
  }
  return total ? Math.round((subject / total) * 100) / 100 : 0
}
