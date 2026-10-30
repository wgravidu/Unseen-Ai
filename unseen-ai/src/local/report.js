function safeText(value, fallback = 'Not provided') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function listOrFallback(items, fallback) {
  return Array.isArray(items) && items.length ? items : [fallback]
}

async function fileToDataUrl(file) {
  if (!file) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The report image could not be read.'))
    reader.readAsDataURL(file)
  })
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text), maxWidth)
  lines.forEach((line) => {
    if (y > 282) {
      doc.addPage()
      y = 16
    }
    doc.text(line, x, y)
    y += lineHeight
  })
  return y
}

function addSection(doc, title, items, y) {
  if (y > 260) {
    doc.addPage()
    y = 16
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(8, 145, 178)
  doc.text(title, 14, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  items.forEach((item) => {
    y = addWrappedText(doc, `- ${item}`, 16, y, 178, 5)
    y += 1
  })
  return y + 3
}

const REPORT_TEXT = {
  en: {
    title: 'AI-Powered Visual Wall Investigation Report',
    generated: 'Generated',
    engine: 'Engine',
    localEngine: 'Local AI - on-device experimental',
    apiEngine: 'API AI - Meta AI Backend',
    important: 'Important: This report summarizes photographic visual guidance. It is not a professional inspection, confirmed diagnosis, or proof of moisture, mold, leakage, or structural damage.',
    currentPhoto: 'Current photo',
    embeddedFail: 'Current photo was available in the browser session but could not be embedded.',
    observations: 'Visible Observations (from AI response)',
    wallVisible: 'A wall is visible in the current photo.',
    wallNotVisible: 'A wall is not clearly visible in the current photo.',
    noObservations: 'No observations were returned.',
    uncertainties: 'Uncertainties',
    noUncertainties: 'No uncertainties were returned.',
    causes: 'Possible Causes (AI-generated hypotheses, not confirmed findings)',
    noCauses: 'No possible causes were returned.',
    likelihood: 'likelihood',
    evidence: 'Evidence Required',
    nextPhoto: 'Next photo',
    reason: 'Reason',
    expected: 'Expected evidence',
    evidenceMore: 'More evidence was requested, but no specific request was returned.',
    evidenceNone: 'No additional evidence was requested.',
    safeNext: 'Recommended Safe Next Steps',
    noSafe: 'No safe next steps were returned.',
    confidence: 'Model confidence shown in app',
    confidenceNote: 'model self-report, not measured accuracy',
    roundSummary: 'Investigation Round Summary',
    round: 'Round',
    observationsCount: 'observations',
    causesCount: 'possible causes',
    confidenceWord: 'confidence',
    localMeasured: 'Local Measured Image Characteristics',
    avgBrightness: 'Average brightness',
    brightnessVariation: 'Brightness variation',
    darkPixels: 'Dark pixels',
    veryDarkPixels: 'Very dark pixels',
    brightPixels: 'Bright pixels',
    edgeDensity: 'Edge/texture density',
    darkestRegion: 'Darkest measured region',
    dark: 'dark',
    model: 'Model',
    inference: 'Model inference',
    measurement: 'Pixel measurement',
    interpretation: 'Measurement Interpretation',
    predictions: 'General Model Predictions',
    noPredictions: 'No readable predictions were returned.',
    limitations: 'Local Limitations and Uncertainty',
    localSession: 'Local Session Note',
    localSessionText: 'local round(s) were measured in this browser session. Earlier local photos are not embedded in this report.',
    highlight: 'Automatic Damage Highlight',
    method: 'Method',
    noHighlight: 'No highlight regions were returned.',
    accuracyTitle: 'Method and Accuracy Note',
    accuracy: 'UNSEEN AI does not claim a measured 90% accuracy. Model confidence is not accuracy. Real accuracy requires a labeled test set of wall photographs with human-verified regions and measured precision, recall, and bounding-box IoU. Highlight boxes mark visible appearance only and must be checked against the photo.',
    footer: 'UNSEEN AI - See Beyond the Surface. Visual guidance only; consult a qualified professional for diagnosis or repair decisions.',
  },
  si: {
    title: 'AI-Powered Visual Wall Investigation Report',
    generated: 'Generated',
    engine: 'Engine',
    localEngine: 'Local AI - on-device experimental',
    apiEngine: 'API AI - Meta AI Backend',
    important: 'Important: This report summarizes photographic visual guidance. It is not a professional inspection, confirmed diagnosis, or proof of moisture, mold, leakage, or structural damage. Note: jsPDF standard fonts do not fully support Sinhala script, so this PDF keeps headings in English while the app UI can be switched to Sinhala.',
    currentPhoto: 'Current photo',
    embeddedFail: 'Current photo was available in the browser session but could not be embedded.',
    observations: 'Visible Observations (from AI response)',
    wallVisible: 'A wall is visible in the current photo.',
    wallNotVisible: 'A wall is not clearly visible in the current photo.',
    noObservations: 'No observations were returned.',
    uncertainties: 'Uncertainties',
    noUncertainties: 'No uncertainties were returned.',
    causes: 'Possible Causes (AI-generated hypotheses, not confirmed findings)',
    noCauses: 'No possible causes were returned.',
    likelihood: 'likelihood',
    evidence: 'Evidence Required',
    nextPhoto: 'Next photo',
    reason: 'Reason',
    expected: 'Expected evidence',
    evidenceMore: 'More evidence was requested, but no specific request was returned.',
    evidenceNone: 'No additional evidence was requested.',
    safeNext: 'Recommended Safe Next Steps',
    noSafe: 'No safe next steps were returned.',
    confidence: 'Model confidence shown in app',
    confidenceNote: 'model self-report, not measured accuracy',
    roundSummary: 'Investigation Round Summary',
    round: 'Round',
    observationsCount: 'observations',
    causesCount: 'possible causes',
    confidenceWord: 'confidence',
    localMeasured: 'Local Measured Image Characteristics',
    avgBrightness: 'Average brightness',
    brightnessVariation: 'Brightness variation',
    darkPixels: 'Dark pixels',
    veryDarkPixels: 'Very dark pixels',
    brightPixels: 'Bright pixels',
    edgeDensity: 'Edge/texture density',
    darkestRegion: 'Darkest measured region',
    dark: 'dark',
    model: 'Model',
    inference: 'Model inference',
    measurement: 'Pixel measurement',
    interpretation: 'Measurement Interpretation',
    predictions: 'General Model Predictions',
    noPredictions: 'No readable predictions were returned.',
    limitations: 'Local Limitations and Uncertainty',
    localSession: 'Local Session Note',
    localSessionText: 'local round(s) were measured in this browser session. Earlier local photos are not embedded in this report.',
    highlight: 'Automatic Damage Highlight',
    method: 'Method',
    noHighlight: 'No highlight regions were returned.',
    accuracyTitle: 'Method and Accuracy Note',
    accuracy: 'UNSEEN AI does not claim a measured 90% accuracy. Model confidence is not accuracy. Real accuracy requires a labeled test set of wall photographs with human-verified regions and measured precision, recall, and bounding-box IoU. Highlight boxes mark visible appearance only and must be checked against the photo.',
    footer: 'UNSEEN AI - See Beyond the Surface. Visual guidance only; consult a qualified professional for diagnosis or repair decisions.',
  },
}

export async function generateInvestigationReport({
  language = 'en',
  mode,
  analysis,
  analysisHistory,
  localResult,
  localHistory,
  highlightResult,
  imageFile,
  imageUrl,
}) {
  const text = REPORT_TEXT[language] || REPORT_TEXT.en
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const generatedAt = new Date().toLocaleString()

  doc.setFillColor(2, 8, 23)
  doc.rect(0, 0, 210, 34, 'F')
  doc.setTextColor(165, 243, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text('UNSEEN AI', 14, 14)
  doc.setFontSize(11)
  doc.setTextColor(226, 246, 255)
  doc.text(text.title, 14, 21)
  doc.setFontSize(8.5)
  doc.setTextColor(148, 196, 220)
  doc.text(`${text.generated}: ${generatedAt} | ${text.engine}: ${mode === 'local' ? text.localEngine : text.apiEngine}`, 14, 28)

  let y = 42
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y = addWrappedText(doc, text.important, 14, y, 182, 5)

  const reportImage = imageFile ? await fileToDataUrl(imageFile).catch(() => null) : null
  if (reportImage) {
    try {
      doc.addImage(reportImage, imageFile.type === 'image/png' ? 'PNG' : 'JPEG', 14, y + 2, 84, 62, undefined, 'FAST')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(`${text.currentPhoto}: ${safeText(imageFile.name, 'Uploaded photo')}`, 14, y + 68)
      y += 76
    } catch {
      y += 3
    }
  } else if (imageUrl) {
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(text.embeddedFail, 14, y)
    y += 8
  }

  if (mode === 'api' && analysis) {
    y = addSection(doc, text.observations, [
      analysis.is_wall_visible ? text.wallVisible : text.wallNotVisible,
      ...listOrFallback(analysis.observations, text.noObservations),
    ], y)
    y = addSection(doc, text.uncertainties, listOrFallback(analysis.uncertainties, text.noUncertainties), y)
    y = addSection(
      doc,
      text.causes,
      analysis.possible_causes.length
        ? analysis.possible_causes.map((cause) => `${cause.cause} - ${cause.likelihood} ${text.likelihood}`)
        : [text.noCauses],
      y,
    )
    const evidence = []
    if (analysis.followup_request) evidence.push(`${analysis.followup_request.type}: ${analysis.followup_request.text}`)
    if (analysis.next_best_view) {
      evidence.push(`${text.nextPhoto}: ${analysis.next_best_view.instruction}`)
      evidence.push(`${text.reason}: ${analysis.next_best_view.reason}`)
      evidence.push(`${text.expected}: ${analysis.next_best_view.expected_evidence}`)
    }
    if (!evidence.length) evidence.push(analysis.needs_more_evidence ? text.evidenceMore : text.evidenceNone)
    y = addSection(doc, text.evidence, evidence, y)
    y = addSection(doc, text.safeNext, listOrFallback(analysis.safe_next_steps, text.noSafe), y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(8, 145, 178)
    if (y > 270) { doc.addPage(); y = 16 }
    doc.text(`${text.confidence}: ${Math.round(analysis.confidence * 100)}% (${text.confidenceNote})`, 14, y)
    y += 8

    if (Array.isArray(analysisHistory) && analysisHistory.length) {
      y = addSection(doc, text.roundSummary, analysisHistory.slice().reverse().map((entry) =>
        `${text.round} ${entry.round} - ${entry.imageName} - ${entry.observations} ${text.observationsCount}, ${entry.possibleCauses} ${text.causesCount}, ${text.confidenceWord} ${Math.round(entry.confidence * 100)}%`,
      ), y)
    }
  }

  if (mode === 'local' && localResult) {
    const metrics = localResult.metrics
    y = addSection(doc, text.localMeasured, [
      `${text.avgBrightness}: ${metrics.meanBrightness} / 255`,
      `${text.brightnessVariation}: ${metrics.brightnessStdDev}`,
      `${text.darkPixels}: ${metrics.darkPixelShare}% | ${text.veryDarkPixels}: ${metrics.veryDarkPixelShare}% | ${text.brightPixels}: ${metrics.brightPixelShare}%`,
      `${text.edgeDensity}: ${metrics.edgeDensity}`,
      `${text.darkestRegion}: ${metrics.maxRegionDarkShare}% ${text.dark}`,
      `${text.model}: ${localResult.model.id} - ${localResult.model.task}`,
      `${text.inference}: ${localResult.inferenceMs} ms | ${text.measurement}: ${localResult.measurementMs} ms`,
    ], y)
    y = addSection(doc, text.interpretation, localResult.interpretation, y)
    y = addSection(doc, text.predictions, localResult.predictions.length
      ? localResult.predictions.map((item) => `${item.label} - ${Math.round(item.score * 100)}% model score`)
      : [text.noPredictions], y)
    y = addSection(doc, text.limitations, localResult.limitations, y)
    if (Array.isArray(localHistory) && localHistory.length) {
      y = addSection(doc, text.localSession, [`${localHistory.length + 1} ${text.localSessionText}`], y)
    }
  }

  if (highlightResult) {
    y = addSection(doc, text.highlight, [
      `${text.method}: ${highlightResult.method}`,
      highlightResult.message,
      ...(highlightResult.regions.length
        ? highlightResult.regions.map((region) => `${region.label}: x ${region.focus_area.x_min}-${region.focus_area.x_max}, y ${region.focus_area.y_min}-${region.focus_area.y_max} / 1000`)
        : [text.noHighlight]),
    ], y)
  }

  if (y > 260) {
    doc.addPage()
    y = 16
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(8, 145, 178)
  doc.text(text.accuracyTitle, 14, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 41, 59)
  y = addWrappedText(doc, text.accuracy, 14, y, 182, 5)

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(text.footer, 14, 292)

  doc.save(`unseen-ai-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
