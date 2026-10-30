import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Camera,
  Cpu,
  History,
  Images,
  Info,
  LayoutDashboard,
  Menu,
  ScanSearch,
  SearchCheck,
  Settings2,
  Trash2,
} from 'lucide-react'
import SplashScreen, { INTRO_EXIT_MS } from './components/SplashScreen.jsx'
import SideNav from './components/SideNav.jsx'
import CameraCapture from './components/CameraCapture.jsx'
import {
  analyzeLocalImage,
  compareLocalAnalyses,
  createImageDifference,
  getLocalSupport,
  LOCAL_MODEL_ID,
} from './local/localEngine.js'
import { useLanguage } from './i18n/LanguageContext.jsx'
import { caseToFile, deleteCase as deleteSavedCase, listCases, loadCase, saveCase } from './local/caseStore.js'
import { hasInsufficientEvidence } from './local/analysisState.js'
import { resolveApiBaseUrl } from './local/apiBase.js'
import { assessPhotoQuality, prepareImagesForApi } from './local/photoQuality.js'
import { shouldAskForMoreEvidence } from './local/evidenceFlow.js'
const loadReportGenerator = () => import('./local/report.js')
import './App.css'

const INTRO_SEEN_KEY = 'unseen-ai-intro-seen'

function hasSeenIntro() {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // Storage can be unavailable in strict privacy contexts; the splash still completes.
  }
}

const WallVisualization3D = lazy(() => import('./components/WallVisualization3D.jsx'))

const MODE_STORAGE_KEY = 'unseen-ai-engine-mode'

function loadStoredMode() {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === 'local' ? 'local' : 'api'
  } catch {
    return 'api'
  }
}

function storeMode(nextMode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, nextMode)
  } catch {
    // Private browsing can deny storage; the selected mode still works for the session.
  }
}

const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  typeof window !== 'undefined' ? window.location : null,
)

if (typeof window !== 'undefined') {
  console.log(`UNSEEN AI Local: http://${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:5173`)
  console.log(`UNSEEN AI Network: http://${window.location.hostname}:5173 - Open this on mobile`)
  console.log(`UNSEEN AI API: ${API_BASE_URL}`)
}
const MAX_FILE_SIZE = 8 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function isAnalysisPayload(payload) {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.is_wall_visible === 'boolean' &&
    Array.isArray(payload.observations) &&
    payload.observations.every((item) => typeof item === 'string') &&
    Array.isArray(payload.uncertainties) &&
    payload.uncertainties.every((item) => typeof item === 'string') &&
    Array.isArray(payload.possible_causes) &&
    payload.possible_causes.every(
      (item) =>
        item &&
        typeof item.cause === 'string' &&
        ['low', 'medium', 'high'].includes(item.likelihood),
    ) &&
    typeof payload.needs_more_evidence === 'boolean' &&
    (payload.followup_request === null ||
      (payload.followup_request &&
        ['question', 'photo'].includes(payload.followup_request.type) &&
        typeof payload.followup_request.text === 'string')) &&
    (payload.next_best_view === null ||
      (payload.next_best_view &&
        typeof payload.next_best_view.instruction === 'string' &&
        typeof payload.next_best_view.focus_area === 'object' &&
        typeof payload.next_best_view.reason === 'string' &&
        typeof payload.next_best_view.expected_evidence === 'string')) &&
    Array.isArray(payload.safe_next_steps) &&
    payload.safe_next_steps.every((item) => typeof item === 'string') &&
    typeof payload.confidence === 'number' &&
    Number.isFinite(payload.confidence) &&
    (payload.what_changed === undefined ||
      (payload.what_changed &&
        Array.isArray(payload.what_changed.new_observations) &&
        Array.isArray(payload.what_changed.removed_observations) &&
        typeof payload.what_changed.confidence_delta === 'number'))
  )
}

function isValidImageFile(candidate) {
  return (
    candidate &&
    SUPPORTED_IMAGE_TYPES.has(candidate.type) &&
    candidate.size <= MAX_FILE_SIZE
  )
}

async function postForm(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  })
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(
      response.ok
        ? 'The server returned an unreadable response.'
        : `The request failed (${response.status}) with an unreadable error response.`,
    )
  }
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : null
    throw new Error(detail || `The request failed (${response.status}).`)
  }
  return payload
}

async function postAnalysisForm(path, formData) {
  const payload = await postForm(path, formData)
  if (!isAnalysisPayload(payload)) {
    throw new Error('The analysis server returned data that does not match the expected analysis format.')
  }
  return payload
}

function normalizeHighlightRegions(regions) {
  if (!Array.isArray(regions)) return []
  return regions
    .map((region, index) => {
      const focus = region?.focus_area || region
      const normalized = {
        x_min: Number(focus?.x_min),
        y_min: Number(focus?.y_min),
        x_max: Number(focus?.x_max),
        y_max: Number(focus?.y_max),
      }
      if (!Object.values(normalized).every(Number.isFinite)) return null
      const xMin = Math.min(1000, Math.max(0, normalized.x_min))
      const yMin = Math.min(1000, Math.max(0, normalized.y_min))
      const xMax = Math.min(1000, Math.max(0, normalized.x_max))
      const yMax = Math.min(1000, Math.max(0, normalized.y_max))
      if (xMax <= xMin || yMax <= yMin) return null
      return {
        id: region.id || `highlight-${index + 1}`,
        label: region.label || region.type || `Region ${index + 1}`,
        focus_area: { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax },
        confidence: typeof region.confidence === 'number' ? region.confidence : null,
        source: 'Automatic Damage Highlight endpoint',
      }
    })
    .filter(Boolean)
}

async function requestHighlight(imageFile) {
  const [preparedImage] = await prepareImagesForApi([imageFile])
  const formData = new FormData()
  formData.append('image', preparedImage)
  const payload = await postForm('/highlight', formData)
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.regions)) {
    throw new Error('The highlight server returned an unexpected response.')
  }
  return {
    regions: normalizeHighlightRegions(payload.regions),
    method: typeof payload.method === 'string' ? payload.method : 'unknown',
    message: typeof payload.message === 'string'
      ? payload.message
      : 'No highlight message was returned by the backend.',
  }
}

function toRequestError(requestError) {
  if (requestError instanceof TypeError) {
    return `Could not reach the analysis server at ${API_BASE_URL}. Check that FastAPI is running and VITE_API_BASE_URL is correct.`
  }
  return requestError instanceof Error ? requestError.message : 'Analysis failed. Please try again.'
}

function EmptyList({ children }) {
  return <p className="empty-list">{children}</p>
}

function clampFocusValue(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(1000, Math.max(0, number)) : fallback
}

function getFocusAreaStyle(focusArea) {
  if (!focusArea || typeof focusArea !== 'object') return null

  const xMin = clampFocusValue(focusArea.x_min, 0)
  const yMin = clampFocusValue(focusArea.y_min, 0)
  const xMax = clampFocusValue(focusArea.x_max, 1000)
  const yMax = clampFocusValue(focusArea.y_max, 1000)

  if (xMax <= xMin || yMax <= yMin) return null

  return {
    isFullFrame: xMin === 0 && yMin === 0 && xMax === 1000 && yMax === 1000,
    style: {
      left: `${xMin / 10}%`,
      top: `${yMin / 10}%`,
      width: `${(xMax - xMin) / 10}%`,
      height: `${(yMax - yMin) / 10}%`,
    },
  }
}

function NextBestViewGuide({ nextBestView, imageUrl }) {
  const { t } = useLanguage()
  if (!nextBestView) return null

  const focus = getFocusAreaStyle(nextBestView.focus_area)
  const guideLabel =
    nextBestView.visual_guide === 'circle'
      ? t('investigation.focusCircle')
      : nextBestView.visual_guide === 'arrow'
        ? t('investigation.focusDirection')
        : t('investigation.focusArea')

  return (
    <section className="result-card next-view-card">
      <h3>{t('investigation.recommendedNext')}</h3>
      <p className="next-view-instruction">{nextBestView.instruction}</p>
      <p><strong>{t('investigation.why')}</strong> {nextBestView.reason}</p>
      <p><strong>{t('investigation.expectedEvidence')}</strong> {nextBestView.expected_evidence}</p>
      <div className="detail-tags">
        <span>{t('investigation.distance')} {nextBestView.distance}</span>
        <span>{t('investigation.angle')} {nextBestView.angle}</span>
        <span>{t('investigation.priority')} {nextBestView.priority}</span>
      </div>

      {imageUrl && focus ? (
        <figure className="focus-photo">
          <div className="focus-photo-frame">
            <img src={imageUrl} alt={t('investigation.uploadedWallAlt')} />
            <div
              className={`focus-box focus-box-${nextBestView.visual_guide}`}
              style={focus.style}
              aria-hidden="true"
            >
              <span>{focus.isFullFrame ? t('investigation.wholePhoto') : guideLabel}</span>
            </div>
          </div>
          <figcaption>
            {focus.isFullFrame ? t('investigation.fullPhotoCaption') : t('investigation.focusCaption')}
          </figcaption>
        </figure>
      ) : imageUrl ? (
        <figure className="focus-photo">
          <div className="focus-photo-frame">
            <img src={imageUrl} alt={t('investigation.uploadedAlt')} />
          </div>
          <figcaption>{t('investigation.noFocusArea')}</figcaption>
        </figure>
      ) : null}
    </section>
  )
}

function WhatChangedCard({ changes, roundNo }) {
  const { t } = useLanguage()
  if (!changes) return null
  const deltaPercent = Math.round(changes.confidence_delta * 100)
  const deltaText = `${deltaPercent >= 0 ? '+' : ''}${deltaPercent}%`
  return (
    <section className="result-card what-changed-card">
      <h3>{t('investigation.whatChanged')} — {t('investigation.round')} {roundNo}</h3>
      {changes.new_observations.length > 0 ? (
        <ul>
          {changes.new_observations.map((item, index) => (
            <li key={`new-${index}`}>{t('investigation.newPrefix')} {item}</li>
          ))}
        </ul>
      ) : (
        <p>{t('investigation.noNewObs')}</p>
      )}
      {changes.removed_observations.length > 0 ? (
        <ul>
          {changes.removed_observations.map((item, index) => (
            <li key={`removed-${index}`}>{t('investigation.removedPrefix')} {item}</li>
          ))}
        </ul>
      ) : (
        <p>{t('investigation.noRemovedObs')}</p>
      )}
      <p className="changed-confidence">{t('investigation.confidenceChange')} {deltaText}</p>
      {changes.note && <p className="changed-note">{changes.note}</p>}
    </section>
  )
}

function useVoiceInput(language, onText) {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const toggle = useCallback(() => {
    if (isListening) {
      stop()
      return
    }
    setVoiceError('')
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceError('unsupported')
      return
    }
    try {
      const recognition = new Recognition()
      recognitionRef.current = recognition
      recognition.lang = language === 'si' ? 'si-LK' : 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim()
        if (transcript) onText(transcript)
      }
      recognition.onerror = () => {
        setVoiceError('failed')
        setIsListening(false)
      }
      recognition.onend = () => setIsListening(false)
      recognition.start()
      setIsListening(true)
    } catch {
      setVoiceError('failed')
    }
  }, [isListening, language, onText, stop])

  return { isListening, voiceError, toggleVoice: toggle }
}

function ChatFollowupBubble({ analysis }) {
  const { t } = useLanguage()
  if (!shouldAskForMoreEvidence(analysis)) return null
  const modelInstruction = analysis.next_best_view?.instruction || analysis.followup_request?.text
  return (
    <div className="chat-followup-bubble" role="status">
      <span className="chat-bubble-avatar" aria-hidden="true">U</span>
      <div>
        <strong>{t('investigation.lowConfidenceTitle')}</strong>
        <p>{t('investigation.lowConfidencePrompt')}</p>
        <p>{t('investigation.lowConfidenceText')}</p>
        {modelInstruction && <p className="chat-bubble-model-note">{modelInstruction}</p>}
      </div>
    </div>
  )
}

function FollowupPanel({
  analysis,
  answer,
  onAnswerChange,
  followupFile,
  followupPreviewUrl,
  onFollowupFileChange,
  onFollowupCameraCapture,
  onSubmitFollowup,
  isLoading,
  isFollowupLoading,
}) {
  const [photoSource, setPhotoSource] = useState('gallery')
  const { t, language } = useLanguage()
  const appendVoiceText = useCallback((transcript) => {
    onAnswerChange(answer ? `${answer} ${transcript}` : transcript)
  }, [answer, onAnswerChange])
  const { isListening, voiceError, toggleVoice } = useVoiceInput(language, appendVoiceText)
  const followup = analysis.followup_request
  const nextView = analysis.next_best_view
  if (!analysis.needs_more_evidence && !followup && !nextView) return null

  return (
    <section className="followup-panel" aria-labelledby="followup-heading">
      <p className="eyebrow">{t('investigation.continueEyebrow')}</p>
      <h3 id="followup-heading">{t('investigation.continueTitle')}</h3>
      {followup && (
        <p className="followup-question">
          <strong>{followup.type === 'photo' ? t('investigation.photoRequested') : t('investigation.aiQuestion')}</strong>{' '}
          {followup.text}
        </p>
      )}
      {nextView && <p className="followup-question">{nextView.instruction}</p>}

      <label className="answer-label" htmlFor="followup-answer">
        {t('investigation.yourAnswer')}
      </label>
      <textarea
        id="followup-answer"
        className="answer-input"
        rows={3}
        maxLength={1000}
        value={answer}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder={t('investigation.answerPlaceholder')}
        disabled={isLoading || isFollowupLoading}
      />
      <div className="voice-row">
        <button type="button" className="secondary-button voice-button" onClick={toggleVoice} disabled={isLoading || isFollowupLoading}>
          {isListening ? t('voice.listening') : t('voice.speak')}
        </button>
        {voiceError && (
          <span role="alert">{voiceError === 'unsupported' ? t('voice.unsupported') : t('voice.failed')}</span>
        )}
      </div>

      <p className="answer-label">{t('investigation.photoSource')}</p>
      <div className="photo-source-toggle" role="group" aria-label={t('investigation.photoSource')}>
        <button
          type="button"
          className={photoSource === 'camera' ? 'is-active' : ''}
          onClick={() => setPhotoSource('camera')}
          disabled={isLoading || isFollowupLoading}
          aria-pressed={photoSource === 'camera'}
        >
          <Camera size={16} aria-hidden="true" /> {t('investigation.useCamera')}
        </button>
        <button
          type="button"
          className={photoSource === 'gallery' ? 'is-active' : ''}
          onClick={() => setPhotoSource('gallery')}
          disabled={isLoading || isFollowupLoading}
          aria-pressed={photoSource === 'gallery'}
        >
          <Images size={16} aria-hidden="true" /> {t('investigation.useGallery')}
        </button>
      </div>

      {photoSource === 'camera' ? (
        <div className="followup-camera-block">
          <CameraCapture
            onConfirm={(capturedFile) => {
              onFollowupCameraCapture(capturedFile)
              setPhotoSource('gallery')
            }}
            disabled={isLoading || isFollowupLoading}
          />
          {followupFile && <p className="selected-file">{followupFile.name} · {t('investigation.cameraCaptured')}</p>}
        </div>
      ) : (
        <>
          <label className="followup-dropzone" htmlFor="followup-image">
            {followupPreviewUrl ? (
              <img className="upload-preview" src={followupPreviewUrl} alt={t('investigation.addNextPhoto')} />
            ) : (
              <span className="upload-placeholder" aria-hidden="true">
                <span className="upload-icon">+</span>
                <span>{t('investigation.addNextPhoto')}</span>
              </span>
            )}
            <input
              id="followup-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFollowupFileChange}
              disabled={isLoading || isFollowupLoading}
            />
          </label>
          {followupFile && <p className="selected-file">{followupFile.name}</p>}
        </>
      )}

      <button
        className="analyze-button followup-button"
        type="button"
        onClick={onSubmitFollowup}
        disabled={isLoading || isFollowupLoading}
      >
        {isFollowupLoading ? t('investigation.sending') : t('investigation.sendAnswerPhoto')}
      </button>
      <p className="privacy-note">{t('investigation.provideEither')}</p>
    </section>
  )
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function BeforeAfterCompare({ beforeUrl, afterUrl, difference }) {
  const { t } = useLanguage()
  const [position, setPosition] = useState(50)
  const [view, setView] = useState('slider')
  if (!beforeUrl || !afterUrl) return null

  return (
    <section className="result-card compare-card">
      <div className="compare-heading">
        <div>
          <h3>{t('compare.title')}</h3>
          <p className="evidence-label">{t('compare.subtitle')}</p>
        </div>
        <div className="compare-view-tabs" role="group" aria-label={t('compare.title')}>
          <button type="button" className={view === 'slider' ? 'is-active' : ''} onClick={() => setView('slider')}>{t('compare.slider')}</button>
          <button type="button" className={view === 'heatmap' ? 'is-active' : ''} onClick={() => setView('heatmap')}>{t('compare.heatmap')}</button>
        </div>
      </div>

      {view === 'slider' ? (
        <>
          <div className="compare-frame">
            <img src={beforeUrl} alt={t('compare.previousAlt')} />
            <div className="compare-after" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
              <img src={afterUrl} alt={t('compare.currentAlt')} />
            </div>
            <span className="compare-label compare-label-before">{t('compare.before')}</span>
            <span className="compare-label compare-label-after">{t('compare.after')}</span>
            <span className="compare-divider" style={{ left: `${position}%` }} aria-hidden="true" />
          </div>
          <label className="compare-slider-label" htmlFor="before-after-slider">
            {t('compare.position')}
            <input
              id="before-after-slider"
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
          </label>
        </>
      ) : difference ? (
        <>
          <div className="compare-frame heatmap-frame">
            <img src={difference.dataUrl} alt={t('compare.heatmapAlt')} />
          </div>
          <div className="compare-metrics">
            <span>{t('compare.changedPixels')} <strong>{difference.changedPixelShare}%</strong></span>
            <span>{t('compare.meanDifference')} <strong>{difference.meanPixelDifference}</strong></span>
          </div>
          <p className="changed-note">{difference.note}</p>
        </>
      ) : (
        <p className="changed-note">{t('compare.calculating')}</p>
      )}
      <p className="changed-note">{t('compare.warning')}</p>
    </section>
  )
}

function LocalComparisonCard({ comparison, roundNo }) {
  const { t } = useLanguage()
  if (!comparison) return null
  return (
    <section className="result-card local-comparison-card">
      <h3>{t('compare.title')} — {t('investigation.round')} {roundNo}</h3>
      <div className="local-table-wrap">
        <table className="local-table">
          <thead>
            <tr><th>{t('local.measured')}</th><th>{t('compare.before')}</th><th>{t('compare.after')}</th><th>{t('compare.position')}</th></tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.previous}</td>
                <td>{row.next}</td>
                <td>{row.delta > 0 ? '+' : ''}{row.delta} {row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="changed-note">{comparison.note}</p>
    </section>
  )
}

function LocalResults({ result, imageUrl, comparison, roundNo, beforeImageUrl, difference }) {
  const { t } = useLanguage()
  if (!result) return null
  const metrics = result.metrics
  return (
    <section className="analysis-results" aria-labelledby="local-results-heading">
      <div className="results-heading">
        <div>
          <p className="eyebrow">{t('local.eyebrow')}</p>
          <h2 id="local-results-heading">{t('local.title')}</h2>
        </div>
        <div className="confidence local-round-badge">
          <span>{t('investigation.round')}</span>
          <strong>{roundNo}</strong>
        </div>
      </div>

      <div className="local-privacy-banner">
        <strong>{t('local.processed')}</strong> {t('local.notSent')}
      </div>

      <LocalComparisonCard comparison={comparison} roundNo={roundNo} />

      <BeforeAfterCompare beforeUrl={beforeImageUrl} afterUrl={imageUrl} difference={difference} />

      {imageUrl && (
        <figure className="focus-photo local-result-photo">
          <div className="focus-photo-frame">
            <img src={imageUrl} alt={t('local.localPhotoAlt')} />
          </div>
          <figcaption>
            {result.file.name} · {result.file.width} × {result.file.height} · {formatBytes(result.file.sizeBytes)}
          </figcaption>
        </figure>
      )}

      <section className="result-card">
        <h3>{t('local.measured')}</h3>
        <div className="local-metric-grid">
          <div><span>{t('local.avgBrightness')}</span><strong>{metrics.meanBrightness} / 255</strong></div>
          <div><span>{t('local.brightnessVariation')}</span><strong>{metrics.brightnessStdDev}</strong></div>
          <div><span>{t('local.darkPixels')}</span><strong>{metrics.darkPixelShare}%</strong></div>
          <div><span>{t('local.veryDarkPixels')}</span><strong>{metrics.veryDarkPixelShare}%</strong></div>
          <div><span>{t('local.brightPixels')}</span><strong>{metrics.brightPixelShare}%</strong></div>
          <div><span>{t('local.edgeDensity')}</span><strong>{metrics.edgeDensity}</strong></div>
          <div><span>{t('local.darkestRegion')}</span><strong>{metrics.maxRegionDarkShare}% {t('local.darkSuffix')}</strong></div>
          <div><span>{t('local.measuredAt')}</span><strong>{metrics.analyzedWidth} × {metrics.analyzedHeight}</strong></div>
        </div>
      </section>

      <div className="results-grid">
        <section className="result-card">
          <h3>{t('local.mayIndicate')}</h3>
          <ul>{result.interpretation.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul>
        </section>
        <section className="result-card">
          <h3>{t('local.dominantColors')}</h3>
          <ul className="local-color-list">
            {metrics.dominantColors.map((color, index) => (
              <li key={`${color.name}-${index}`}>
                <span
                  className="local-color-swatch"
                  style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                  aria-hidden="true"
                />
                <span>{color.name}</span>
                <strong>{color.share}%</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="result-card">
        <h3>{t('local.predictions')}</h3>
        <p className="local-model-note">
          {t('local.modelLabel')} {result.model.id} · {result.model.task}. {result.model.note}
        </p>
        {result.predictions.length > 0 ? (
          <ul className="local-prediction-list">
            {result.predictions.map((prediction) => (
              <li key={prediction.label}>
                <span>{prediction.label}</span>
                <strong>{Math.round(prediction.score * 100)}%</strong>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyList>{t('local.noPredictions')}</EmptyList>
        )}
        <p className="local-timing">
          {t('local.measurement')} {result.measurementMs} ms · {t('local.inference')} {result.inferenceMs} ms
        </p>
      </section>

      <section className="result-card local-limitations-card">
        <h3>{t('local.limitations')}</h3>
        <ul>{result.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      </section>
    </section>
  )
}

function LocalFollowupPanel({
  followupFile,
  followupPreviewUrl,
  onFollowupFileChange,
  onSubmitFollowup,
  isBusy,
}) {
  const { t } = useLanguage()
  return (
    <section className="followup-panel" aria-labelledby="local-followup-heading">
      <p className="eyebrow">{t('local.compareAnother')}</p>
      <h3 id="local-followup-heading">{t('local.addSecond')}</h3>
      <p className="followup-question">{t('local.addSecondText')}</p>
      <label className="followup-dropzone" htmlFor="local-followup-image">
        {followupPreviewUrl ? (
          <img className="upload-preview" src={followupPreviewUrl} alt={t('local.secondPreviewAlt')} />
        ) : (
          <span className="upload-placeholder" aria-hidden="true">
            <span className="upload-icon">+</span>
            <span>{t('local.addSecond')}</span>
          </span>
        )}
        <input
          id="local-followup-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFollowupFileChange}
          disabled={isBusy}
        />
      </label>
      {followupFile && <p className="selected-file">{followupFile.name}</p>}
      <button
        className="analyze-button followup-button"
        type="button"
        onClick={onSubmitFollowup}
        disabled={isBusy || !followupFile}
      >
        {isBusy ? t('local.analyzingCompare') : t('local.analyzeCompare')}
      </button>
      <p className="privacy-note">{t('local.secondStays')}</p>
    </section>
  )
}

function AnalysisResults({ analysis, roundNo, currentImageUrl, beforeImageUrl, difference }) {
  const { t } = useLanguage()
  return (
    <section className="analysis-results" aria-labelledby="results-heading">
      <div className="results-heading">
        <div>
          <p className="eyebrow">{t('local.eyebrow')}</p>
          <h2 id="results-heading">{t('investigation.analyzingDetails')}</h2>
        </div>
        <div className="confidence">
          <span>{t('investigation.round')} {roundNo} · {t('investigation.confidence')}</span>
          <strong>{analysis.is_wall_visible ? `${Math.round(analysis.confidence * 100)}%` : '—'}</strong>
          {!analysis.is_wall_visible && <span>{t('investigation.notApplicable')}</span>}
        </div>
      </div>

      {hasInsufficientEvidence(analysis) && (
        <div className="result-card evidence-insufficient-banner" role="status">
          <h3>{t('investigation.insufficientTitle')}</h3>
          <p>{!analysis.is_wall_visible ? t('investigation.insufficientNoWall') : t('investigation.insufficientMoreEvidence')}</p>
        </div>
      )}

      <WhatChangedCard changes={analysis.what_changed} roundNo={roundNo} />

      <BeforeAfterCompare beforeUrl={beforeImageUrl} afterUrl={currentImageUrl} difference={difference} />

      <div className="result-card visibility-card hypothesis-card">
        <div>
          <h3>{t('investigation.visibleObservations')}</h3>
          <p className="evidence-label">{t('investigation.confirmedEvidence')}</p>
        </div>
        <p>{analysis.is_wall_visible ? t('investigation.wallVisible') : t('investigation.wallNotVisible')}</p>
      </div>

      <div className="results-grid">
        <section className="result-card">
          <h3>{t('investigation.whatVisible')}</h3>
          {analysis.observations.length > 0 ? (
            <ul>{analysis.observations.map((observation, index) => <li key={`${observation}-${index}`}>{observation}</li>)}</ul>
          ) : (
            <EmptyList>{t('investigation.noObservations')}</EmptyList>
          )}
        </section>
        <section className="result-card">
          <h3>{t('investigation.uncertainties')}</h3>
          {analysis.uncertainties.length > 0 ? (
            <ul>{analysis.uncertainties.map((uncertainty, index) => <li key={`${uncertainty}-${index}`}>{uncertainty}</li>)}</ul>
          ) : (
            <EmptyList>{t('investigation.noUncertainties')}</EmptyList>
          )}
        </section>
      </div>

      <section className="result-card hypothesis-card">
        <h3>{t('investigation.possibleCauses')}</h3>
        <p className="evidence-label">{t('investigation.hypotheses')}</p>
        {!analysis.is_wall_visible ? (
          <EmptyList>{t('investigation.causesNeedWall')}</EmptyList>
        ) : analysis.possible_causes.length > 0 ? (
          <ul className="cause-list">
            {analysis.possible_causes.slice(0, 3).map(({ cause, likelihood }, index) => (
              <li key={`${cause}-${index}`}>
                <span>{cause}</span>
                <span className={`likelihood likelihood-${likelihood}`}>{likelihood} {t('investigation.likelihood')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyList>{t('investigation.noCauses')}</EmptyList>
        )}
      </section>

      <div className="result-card evidence-card">
        <h3>{t('investigation.evidenceRequired')}</h3>
        <p>{analysis.needs_more_evidence ? t('investigation.moreEvidence') : t('investigation.noMoreEvidence')}</p>
        {analysis.followup_request && (
          <p className="followup-request">
            <strong>{analysis.followup_request.type === 'photo' ? t('investigation.photoRequest') : t('investigation.followupQuestion')}</strong>{' '}
            {analysis.followup_request.text}
          </p>
        )}
      </div>

      <NextBestViewGuide nextBestView={analysis.next_best_view} imageUrl={currentImageUrl} />

      <section className="result-card">
        <h3>{t('investigation.safeNext')}</h3>
        {analysis.safe_next_steps.length > 0 ? (
          <ul>{analysis.safe_next_steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ul>
        ) : (
          <EmptyList>{t('investigation.noSafeSteps')}</EmptyList>
        )}
      </section>
      <section className="result-card final-disclaimer-card" aria-label={t('investigation.finalReportTitle')}>
        <h3>{t('investigation.finalReportTitle')}</h3>
        <p>{t('investigation.finalDisclaimerSi')}</p>
        <p>{t('investigation.finalDisclaimerEn')}</p>
        <p className="disclaimer">{t('investigation.disclaimer')}</p>
      </section>
    </section>
  )
}

function AnalyzeApp() {
  const { t, language, setLanguage } = useLanguage()
  const [mode, setMode] = useState(loadStoredMode)
  const [activeView, setActiveView] = useState('dashboard')
  const [navOpen, setNavOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState('checking')
  const [galleryItems, setGalleryItems] = useState([])
  const [highlightResult, setHighlightResult] = useState(null)
  const [highlightLoading, setHighlightLoading] = useState(false)
  const [investigationHistory, setInvestigationHistory] = useState([])
  const galleryItemsRef = useRef([])
  const [localStatus, setLocalStatus] = useState({ phase: 'idle' })
  const [localAnalysis, setLocalAnalysis] = useState(null)
  const [localHistory, setLocalHistory] = useState([])
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [photoQuality, setPhotoQuality] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFollowupLoading, setIsFollowupLoading] = useState(false)
  const [roundNo, setRoundNo] = useState(1)
  const [notes, setNotes] = useState([])
  const [answer, setAnswer] = useState('')
  const [followupFile, setFollowupFile] = useState(null)
  const [followupPreviewUrl, setFollowupPreviewUrl] = useState('')
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [roundImages, setRoundImages] = useState([])
  const [differenceResult, setDifferenceResult] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [savedCases, setSavedCases] = useState([])
  const [caseStatus, setCaseStatus] = useState('')
  const previewUrlRef = useRef(null)
  const followupPreviewUrlRef = useRef(null)

  useEffect(() => {
    galleryItemsRef.current = galleryItems
  }, [galleryItems])

  const refreshSavedCases = useCallback(async () => {
    try {
      setSavedCases(await listCases())
    } catch {
      setSavedCases([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listCases()
      .then((cases) => { if (!cancelled) setSavedCases(cases) })
      .catch(() => { if (!cancelled) setSavedCases([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`)
        if (!response.ok) throw new Error('unhealthy')
        const payload = await response.json()
        if (!cancelled) setApiStatus(payload.model_configured ? 'online' : 'unconfigured')
      } catch {
        if (!cancelled) setApiStatus('offline')
      }
    }
    checkHealth()
    const intervalId = window.setInterval(checkHealth, 30000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
    galleryItemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
  }, [])

  function resetInvestigation() {
    if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
    followupPreviewUrlRef.current = null
    setFollowupPreviewUrl('')
    setAnalysis(null)
    setLocalAnalysis(null)
    setLocalHistory([])
    setLocalStatus({ phase: 'idle' })
    setError('')
    setPhotoQuality(null)
    setRoundNo(1)
    setNotes([])
    setAnswer('')
    setFollowupFile(null)
    setResultImageUrl('')
    setRoundImages([])
    setDifferenceResult(null)
  }

  async function updateDifference(previousFile, nextFile) {
    if (!previousFile || !nextFile) {
      setDifferenceResult(null)
      return
    }
    try {
      const difference = await createImageDifference(previousFile, nextFile)
      setDifferenceResult(difference)
    } catch {
      setDifferenceResult(null)
    }
  }

  function handleModeChange(nextMode) {
    if (nextMode === mode || isBusy) return
    setMode(nextMode)
    storeMode(nextMode)
    resetResultsForMode()
  }

  function resetResultsForMode() {
    if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
    followupPreviewUrlRef.current = null
    setFollowupPreviewUrl('')
    setAnalysis(null)
    setLocalAnalysis(null)
    setLocalHistory([])
    setLocalStatus({ phase: 'idle' })
    setError('')
    setPhotoQuality(null)
    setRoundNo(1)
    setNotes([])
    setAnswer('')
    setFollowupFile(null)
    setResultImageUrl('')
    setRoundImages([])
    setDifferenceResult(null)
    setHighlightResult(null)
  }

  function selectPrimaryFile(selectedFile, navigateToInvestigation = false) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = selectedFile ? URL.createObjectURL(selectedFile) : null
    setPreviewUrl(previewUrlRef.current || '')
    setFile(selectedFile)
    setHighlightResult(null)
    resetInvestigation()
    if (navigateToInvestigation) setActiveView('investigation')
  }

  function handleFileChange(event) {
    const selectedFile = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''
    selectPrimaryFile(selectedFile)
  }

  function handleFollowupFileChange(event) {
    const selectedFile = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''
    setFollowupImageFile(selectedFile)
  }

  function setFollowupImageFile(selectedFile) {
    if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
    followupPreviewUrlRef.current = selectedFile ? URL.createObjectURL(selectedFile) : null
    setFollowupPreviewUrl(followupPreviewUrlRef.current || '')
    setFollowupFile(selectedFile)
    setError('')
  }

  function localPhaseText(status) {
    if (status.phase === 'downloading') {
      const size = status.totalMB
        ? ` (${status.loadedMB.toFixed(1)} / ${status.totalMB.toFixed(1)} MB)`
        : ''
      return `${t('local.downloading')}${status.percent ? ` — ${status.percent}%` : ''}${size}. ${t('local.firstSetup')}`
    }
    if (status.phase === 'initializing') return t('local.initializing')
    if (status.phase === 'processing') return t('local.processing')
    if (status.phase === 'inferring') return t('local.inferring')
    if (status.phase === 'ready') return t('local.modelReady')
    if (status.phase === 'error') return status.message
    return t('local.loadsOnly')
  }

  async function runLocalAnalysis(imageFile, isFollowup = false) {
    const support = getLocalSupport()
    if (!support.supported) {
      setError(support.issues.join(' '))
      return
    }

    setError('')
    if (isFollowup) setIsFollowupLoading(true)
    else setIsLoading(true)
    setLocalStatus({ phase: 'processing' })

    try {
      const result = await analyzeLocalImage(imageFile, setLocalStatus)
      if (isFollowup && localAnalysis) {
        result.comparison = compareLocalAnalyses(localAnalysis, result)
        setLocalHistory((history) => [...history, localAnalysis])
        const previousRoundFile = roundImages[roundImages.length - 1]?.file || file
        setRoundImages((current) => [...current, { file: imageFile, url: followupPreviewUrl || previewUrl }])
        await updateDifference(previousRoundFile, imageFile)
      } else {
        setRoundImages([{ file: imageFile, url: previewUrl }])
        setDifferenceResult(null)
      }
      setLocalAnalysis(result)
      setResultImageUrl(isFollowup ? followupPreviewUrl || previewUrl : previewUrl)
      if (isFollowup) {
        setRoundNo((current) => current + 1)
        if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
        followupPreviewUrlRef.current = null
        setFollowupPreviewUrl('')
        setFollowupFile(null)
      } else {
        setRoundNo(1)
        setLocalHistory([])
      }
      setLocalStatus({ phase: 'ready' })
    } catch (localError) {
      setLocalStatus({ phase: 'error', message: localError.message })
      setError(localError.message)
    } finally {
      if (isFollowup) setIsFollowupLoading(false)
      else setIsLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!file) {
      setError(t('investigation.chooseBefore'))
      return
    }
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setError(t('investigation.chooseType'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(t('investigation.tooLarge'))
      return
    }

    if (mode === 'local') {
      const submitFile = file
      const submitPreviewUrl = previewUrl
      resetInvestigation()
      setFile(submitFile)
      previewUrlRef.current = submitPreviewUrl
      setPreviewUrl(submitPreviewUrl)
      await runLocalAnalysis(submitFile)
      return
    }

    const submitFile = file
    const submitPreviewUrl = previewUrl
    const quality = await assessPhotoQuality(submitFile)
    resetInvestigation()
    setFile(submitFile)
    previewUrlRef.current = submitPreviewUrl
    setPreviewUrl(submitPreviewUrl)
    setPhotoQuality(quality)
    if (quality.status === 'insufficient_evidence') {
      return
    }
    setIsLoading(true)
    try {
      let payload
      if (galleryItems.length > 1 && galleryItems.some((item) => item.file === submitFile)) {
        payload = await investigateWithImages(
          galleryItems.map((item) => item.file),
          [],
          null,
          1,
        )
      } else {
        const [preparedImage] = await prepareImagesForApi([submitFile])
        const formData = new FormData()
        formData.append('image', preparedImage)
        payload = await postAnalysisForm('/analyze', formData)
      }
      setAnalysis(payload)
      setResultImageUrl(submitPreviewUrl)
      setRoundImages([{ file: submitFile, url: submitPreviewUrl }])
      setDifferenceResult(null)
      setRoundNo(1)
      recordInvestigation(payload, 1, submitFile.name)
    } catch (requestError) {
      setError(toRequestError(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLocalFollowupSubmit() {
    if (!localAnalysis || isBusy) return
    if (!followupFile) {
      setError(t('local.chooseSecond'))
      return
    }
    if (!isValidImageFile(followupFile)) {
      setError(t('local.chooseSecondValid'))
      return
    }
    await runLocalAnalysis(followupFile, true)
  }

  async function handleFollowupSubmit() {
    if (!analysis || isLoading || isFollowupLoading) return
    setError('')

    if (!answer.trim() && !followupFile) {
      setError(t('investigation.addAnswerOrPhoto'))
      return
    }
    if (followupFile && !isValidImageFile(followupFile)) {
      setError(t('investigation.chooseFollowupValid'))
      return
    }
    if (roundNo >= 20) {
      setError(t('investigation.roundLimit'))
      return
    }

    const trimmedAnswer = answer.trim()
    const nextNotes = trimmedAnswer ? [...notes, trimmedAnswer] : notes
    const priorFiles = roundImages.map((round) => round.file).filter(Boolean)
    const imagesToSend = followupFile
      ? [...priorFiles.slice(-2), followupFile]
      : priorFiles.length ? priorFiles.slice(-3) : file ? [file] : []
    const currentUploadFile = followupFile || imagesToSend[imagesToSend.length - 1]
    setIsFollowupLoading(true)

    try {
      const payload = await investigateWithImages(imagesToSend, nextNotes, analysis, roundNo + 1)
      setAnalysis(payload)
      const currentRoundImage = { file: currentUploadFile, url: followupPreviewUrl || previewUrl }
      setResultImageUrl(currentRoundImage.url)
      setRoundImages((current) => [...current, currentRoundImage])
      const previousRoundFile = roundImages[roundImages.length - 1]?.file || file
      await updateDifference(previousRoundFile, currentUploadFile)
      const nextRound = roundNo + 1
      setRoundNo(nextRound)
      recordInvestigation(payload, nextRound, currentUploadFile?.name || 'Follow-up image')
      setNotes(nextNotes)
      setAnswer('')
      if (followupPreviewUrlRef.current) URL.revokeObjectURL(followupPreviewUrlRef.current)
      followupPreviewUrlRef.current = null
      setFollowupPreviewUrl('')
      setFollowupFile(null)
    } catch (requestError) {
      setError(toRequestError(requestError))
    } finally {
      setIsFollowupLoading(false)
    }
  }

  async function investigateWithImages(images, notesValue, previousAnalysis, nextRound) {
    const preparedImages = await prepareImagesForApi(images.filter(Boolean))
    const formData = new FormData()
    preparedImages.forEach((image) => formData.append('images', image))
    formData.append('notes', JSON.stringify(notesValue))
    formData.append('previous', previousAnalysis ? JSON.stringify(previousAnalysis) : '')
    formData.append('round_no', String(nextRound))
    return postAnalysisForm('/investigate', formData)
  }

  function recordInvestigation(payload, round, imageName) {
    setInvestigationHistory((history) => [
      {
        id: `${Date.now()}-${round}`,
        round,
        imageName,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: payload.confidence,
        observations: payload.observations.length,
        possibleCauses: payload.possible_causes.length,
        needsMoreEvidence: payload.needs_more_evidence,
      },
      ...history,
    ].slice(0, 20))
  }

  async function handleSaveCase() {
    if (!hasActiveResult) return
    setCaseStatus(t('cases.saving'))
    try {
      await saveCase({
        title: roundImages[roundImages.length - 1]?.file?.name || file?.name || 'UNSEEN AI case',
        mode,
        roundNo,
        analysis,
        localResult: localAnalysis,
        analysisHistory: investigationHistory,
        localHistory,
        highlightResult,
        imageFile: roundImages[roundImages.length - 1]?.file || file,
      })
      await refreshSavedCases()
      setCaseStatus(t('cases.saved'))
    } catch (saveError) {
      setCaseStatus(saveError instanceof Error ? saveError.message : t('cases.empty'))
    }
  }

  async function handleOpenCase(caseId) {
    const saved = await loadCase(caseId)
    if (!saved) return
    const restoredFile = caseToFile(saved)
    resetResultsForMode()
    if (saved.mode === 'local' || saved.mode === 'api') {
      setMode(saved.mode)
      storeMode(saved.mode)
    }
    if (restoredFile) selectPrimaryFile(restoredFile, false)
    setAnalysis(saved.analysis || null)
    setLocalAnalysis(saved.localResult || null)
    setLocalHistory(saved.localHistory || [])
    setInvestigationHistory(saved.analysisHistory || [])
    setHighlightResult(saved.highlightResult || null)
    setRoundNo(saved.roundNo || 1)
    if (restoredFile) {
      const restoredUrl = URL.createObjectURL(restoredFile)
      setResultImageUrl(restoredUrl)
      setRoundImages([{ file: restoredFile, url: restoredUrl }])
    }
    setActiveView('investigation')
    setCaseStatus(t('cases.saved'))
  }

  async function handleDeleteCase(caseId) {
    await deleteSavedCase(caseId)
    await refreshSavedCases()
  }

  async function handleDownloadReport() {
    if (!hasActiveResult || reportLoading) return
    setError('')
    setReportLoading(true)
    try {
      const { generateInvestigationReport } = await loadReportGenerator()
      await generateInvestigationReport({
        language,
        mode,
        analysis,
        analysisHistory: investigationHistory,
        localResult: localAnalysis,
        localHistory,
        highlightResult,
        imageFile: roundImages[roundImages.length - 1]?.file || file,
        imageUrl: resultImageUrl,
      })
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'The PDF report could not be generated.')
    } finally {
      setReportLoading(false)
    }
  }

  async function runHighlight() {
    if (!file || highlightLoading) return
    if (!isValidImageFile(file)) {
      setError(t('highlight.chooseValid'))
      return
    }
    setError('')
    setHighlightLoading(true)
    try {
      const result = await requestHighlight(file)
      setHighlightResult(result)
    } catch (highlightError) {
      setError(toRequestError(highlightError))
    } finally {
      setHighlightLoading(false)
    }
  }

  function addGalleryFiles(fileList) {
    const incoming = [...(fileList || [])]
    if (!incoming.length) return
    const validFiles = incoming.filter(isValidImageFile)
    if (validFiles.length !== incoming.length) {
      setError(t('gallery.skipped'))
    } else {
      setError('')
    }
    setGalleryItems((current) => {
      const room = Math.max(0, 4 - current.length)
      const accepted = validFiles.slice(0, room)
      if (validFiles.length > room) {
        setError(t('gallery.limit'))
      }
      return [
        ...current,
        ...accepted.map((galleryFile) => ({
          id: `${galleryFile.name}-${galleryFile.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file: galleryFile,
          url: URL.createObjectURL(galleryFile),
        })),
      ]
    })
  }

  function removeGalleryItem(itemId) {
    setGalleryItems((current) => {
      const removed = current.find((item) => item.id === itemId)
      if (removed) URL.revokeObjectURL(removed.url)
      return current.filter((item) => item.id !== itemId)
    })
  }

  function useGalleryImages() {
    if (!galleryItems.length || isBusy) return
    selectPrimaryFile(galleryItems[0].file, true)
  }

  function handleCameraConfirm(capturedFile) {
    if (!isValidImageFile(capturedFile)) {
      setError(t('camera.saveFailed'))
      return
    }
    selectPrimaryFile(capturedFile, true)
  }

  const isBusy = isLoading || isFollowupLoading || highlightLoading || reportLoading
  const localSupport = getLocalSupport()
  const hasActiveResult = mode === 'local' ? Boolean(localAnalysis) : Boolean(analysis)
  const localComparison = localAnalysis?.comparison || null
  const previousRoundImageUrl = roundImages.length > 1 ? roundImages[roundImages.length - 2]?.url : ''
  const apiStatusText =
    apiStatus === 'online'
      ? t('common.apiOnline')
      : apiStatus === 'unconfigured'
        ? t('common.apiKeyMissing')
        : apiStatus === 'offline'
          ? t('common.apiOffline')
          : t('common.checkingApi')
  const currentModeLabel = mode === 'api' ? t('common.apiMode') : t('common.localMode')
  const mappedRegions = [
    ...(highlightResult?.regions || []),
    ...(analysis?.next_best_view ? [{
      id: 'next-best-view-region',
      label: analysis.next_best_view.instruction || 'Recommended next-photo focus',
      focus_area: analysis.next_best_view.focus_area,
      reason: analysis.next_best_view.reason,
      expected_evidence: analysis.next_best_view.expected_evidence,
      priority: analysis.next_best_view.priority,
      source: 'Meta AI recommended next view',
    }] : []),
  ]

  function handleStartNew() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl('')
    setFile(null)
    setHighlightResult(null)
    galleryItemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    setGalleryItems([])
    resetInvestigation()
  }

  const featureCards = [
    { id: 'camera', icon: Camera, eyebrow: t('features.cameraEyebrow'), title: t('features.cameraTitle'), text: t('features.cameraText'), action: t('features.cameraAction') },
    { id: 'gallery', icon: Images, eyebrow: t('features.galleryEyebrow'), title: t('features.galleryTitle'), text: t('features.galleryText'), action: t('features.galleryAction') },
    { id: 'highlight', icon: ScanSearch, eyebrow: t('features.highlightEyebrow'), title: t('features.highlightTitle'), text: t('features.highlightText'), action: t('features.highlightAction') },
    { id: 'investigation', icon: SearchCheck, eyebrow: t('features.investigationEyebrow'), title: t('features.investigationTitle'), text: t('features.investigationText'), action: t('features.investigationAction') },
    { id: 'visualization', icon: Box, eyebrow: t('features.vizEyebrow'), title: t('features.vizTitle'), text: t('features.vizText'), action: t('features.vizAction') },
    { id: 'settings', icon: Settings2, eyebrow: t('features.settingsEyebrow'), title: t('features.settingsTitle'), text: `${t('common.currentEngine')}: ${currentModeLabel}. ${t('features.settingsText')}`, action: t('features.settingsAction') },
  ]

  const renderInvestigationWorkspace = () => (
      <section className="workspace">
        <form className="upload-card" onSubmit={handleSubmit}>
          <div className="upload-heading">
            <div className="step-number">01</div>
            <div>
              <h2>{t('investigation.startPhoto')}</h2>
              <p>{t('investigation.clearPhoto')}</p>
            </div>
          </div>

          <label className="upload-dropzone" htmlFor="wall-image">
            {previewUrl ? (
              <img className="upload-preview" src={previewUrl} alt={t('investigation.uploadedAlt')} />
            ) : (
              <span className="upload-placeholder" aria-hidden="true">
                <span className="upload-icon">+</span>
                <span>{t('investigation.chooseImage')}</span>
              </span>
            )}
            <input
              id="wall-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>

          {file && <p className="selected-file">{file.name}</p>}

          <button className="analyze-button" type="submit" disabled={isBusy}>
            {isLoading
              ? mode === 'local' ? t('investigation.analyzingLocally') : t('investigation.analyzing')
              : mode === 'local' ? t('investigation.analyzeLocally') : t('investigation.analyzeWall')}
          </button>
          <p className="privacy-note">
            {mode === 'local' ? t('investigation.localPrivacy') : t('investigation.sentToServer')}
          </p>
          {mode === 'local' && (
            <div className="local-status-box" role="status">
              <strong>{localPhaseText(localStatus)}</strong>
              {localStatus.phase === 'downloading' && (
                <div className="local-progress" aria-hidden="true">
                  <span style={{ width: `${localStatus.percent || 0}%` }} />
                </div>
              )}
              <span>
                {t('local.modelLabel')} {LOCAL_MODEL_ID} · {t('local.generalNote')}
              </span>
              {!localSupport.supported && <span>{localSupport.issues.join(' ')}</span>}
              {localSupport.warnings?.length > 0 && <span>{localSupport.warnings.join(' ')}</span>}
              {localHistory.length > 0 && <span>{t('local.roundsSession')} {localHistory.length + 1}</span>}
            </div>
          )}
        </form>

        <div className="analysis-panel" aria-live="polite">
          {mode === 'api' && photoQuality?.status === 'insufficient_evidence' && !analysis ? (
            <div className="insufficient-panel" role="status">
              <p className="eyebrow">{t('investigation.insufficientStatus')}</p>
              <h2>{t('investigation.insufficientTitle')}</h2>
              <div className="chat-followup-bubble insufficient-chat-bubble">
                <span className="chat-bubble-avatar" aria-hidden="true">U</span>
                <div>
                  <strong>{t('investigation.insufficientMessage')}</strong>
                  <p>
                    {photoQuality.reason === 'dark'
                      ? t('investigation.insufficientReasonDark')
                      : photoQuality.reason === 'bright'
                        ? t('investigation.insufficientReasonBright')
                        : photoQuality.reason === 'tooFar'
                          ? t('investigation.insufficientReasonTooFar')
                          : t('investigation.insufficientReasonBlurry')}
                  </p>
                  <p className="quality-metrics">
                    {t('investigation.confidence')}: {t('investigation.notApplicable')} · {photoQuality.brightness}/255 · detail {photoQuality.detail}
                  </p>
                </div>
              </div>
              <button
                className="analyze-button retry-photo-button"
                type="button"
                onClick={() => document.getElementById('wall-image')?.click()}
              >
                {t('investigation.retryPhoto')}
              </button>
              <p className="privacy-note">{t('investigation.insufficientReasonUnknown')}</p>
            </div>
          ) : isLoading ? (
            <div className="empty-state loading-state" role="status">
              <span className="loading-indicator" aria-hidden="true" />
              <h2>{mode === 'local' ? t('investigation.analyzingOnDevice') : t('investigation.takingLook')}</h2>
              <p>{mode === 'local' ? localPhaseText(localStatus) : t('investigation.analyzingDetails')}</p>
            </div>
          ) : error && !hasActiveResult ? (
            <div className="error-state" role="alert">
              <p className="eyebrow">{mode === 'local' ? t('investigation.localUnavailable') : t('investigation.unable')}</p>
              <p>{error}</p>
              {file && (
                <button
                  className="retry-button"
                  type="button"
                  onClick={(event) => event.currentTarget.closest('.app-shell').querySelector('.upload-card')?.requestSubmit()}
                >
                  {t('common.tryAgain')}
                </button>
              )}
            </div>
          ) : mode === 'local' && localAnalysis ? (
            <>
              <LocalResults
                result={localAnalysis}
                imageUrl={resultImageUrl}
                comparison={localComparison}
                roundNo={roundNo}
                beforeImageUrl={previousRoundImageUrl}
                difference={differenceResult}
              />
              <button type="button" className="analyze-button report-button" onClick={handleDownloadReport} disabled={isBusy}>
                {reportLoading ? t('investigation.preparingPdf') : t('investigation.downloadReport')}
              </button>
              <button type="button" className="secondary-button save-case-button" onClick={handleSaveCase} disabled={isBusy}>
                {t('cases.saveCurrent')}
              </button>
              {caseStatus && <p className="case-status" role="status">{caseStatus}</p>}
              {error && (
                <div className="error-state" role="alert">
                  <p>{error}</p>
                </div>
              )}
              {isFollowupLoading ? (
                <div className="empty-state loading-state" role="status">
                  <span className="loading-indicator" aria-hidden="true" />
                  <h2>{t('investigation.comparingLocally')}</h2>
                  <p>{t('investigation.measuringSecond')}</p>
                </div>
              ) : (
                <>
                  <LocalFollowupPanel
                    followupFile={followupFile}
                    followupPreviewUrl={followupPreviewUrl}
                    onFollowupFileChange={handleFollowupFileChange}
                    onSubmitFollowup={handleLocalFollowupSubmit}
                    isBusy={isBusy}
                  />
                  <button className="start-new-button" type="button" onClick={handleStartNew}>
                    {t('common.startNew')}
                  </button>
                </>
              )}
            </>
          ) : mode === 'api' && analysis ? (
            <>
              <AnalysisResults
                analysis={analysis}
                roundNo={roundNo}
                currentImageUrl={resultImageUrl}
                beforeImageUrl={previousRoundImageUrl}
                difference={differenceResult}
              />
              <button type="button" className="analyze-button report-button" onClick={handleDownloadReport} disabled={isBusy}>
                {reportLoading ? t('investigation.preparingPdf') : t('investigation.downloadReport')}
              </button>
              <button type="button" className="secondary-button save-case-button" onClick={handleSaveCase} disabled={isBusy}>
                {t('cases.saveCurrent')}
              </button>
              {caseStatus && <p className="case-status" role="status">{caseStatus}</p>}
              {error && (
                <div className="error-state" role="alert">
                  <p>{error}</p>
                </div>
              )}
              {isFollowupLoading ? (
                <div className="empty-state loading-state" role="status">
                  <span className="loading-indicator" aria-hidden="true" />
                  <h2>{t('investigation.reviewing')}</h2>
                  <p>{t('investigation.comparingPrevious')}</p>
                </div>
              ) : (
                <>
                  <ChatFollowupBubble analysis={analysis} />
                  <FollowupPanel
                    analysis={analysis}
                    answer={answer}
                    onAnswerChange={setAnswer}
                    followupFile={followupFile}
                    followupPreviewUrl={followupPreviewUrl}
                    onFollowupFileChange={handleFollowupFileChange}
                    onFollowupCameraCapture={setFollowupImageFile}
                    onSubmitFollowup={handleFollowupSubmit}
                    isLoading={isLoading}
                    isFollowupLoading={isFollowupLoading}
                  />
                  <button className="start-new-button" type="button" onClick={handleStartNew}>
                    {t('common.startNew')}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-orbit" aria-hidden="true"><span /></span>
              <p className="eyebrow">{t('investigation.resultsHere')}</p>
              <h2>{t('investigation.ready')}</h2>
              <p>{mode === 'local' ? t('investigation.readyLocal') : t('investigation.readyApi')}</p>
            </div>
          )}
        </div>
      </section>
  )

  return (
    <main className="app-shell">
      <SideNav
        open={navOpen}
        activeView={activeView}
        mode={mode}
        onClose={() => setNavOpen(false)}
        onNavigate={setActiveView}
        onModeChange={handleModeChange}
        isBusy={isBusy}
      />

      <header className="site-header">
        <button
          type="button"
          className="icon-button menu-button"
          onClick={() => setNavOpen(true)}
          aria-label={t('common.menuOpen')}
          aria-expanded={navOpen}
        >
          <Menu size={21} />
        </button>
        <a className="brand header-brand" href="/" aria-label={t('common.homeLabel')} onClick={(event) => { event.preventDefault(); setActiveView('dashboard') }}>
          <span className="brand-mark animated-u" aria-hidden="true">U</span>
          <span>UNSEEN <span className="brand-light">AI</span></span>
        </a>
        <div className="header-actions">
          <div className="language-switch" role="group" aria-label={t('common.languageLabel')}>
            <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
            <button type="button" className={language === 'si' ? 'is-active' : ''} onClick={() => setLanguage('si')} aria-pressed={language === 'si'}>සිං</button>
          </div>
          <div className={`api-status api-status-${mode === 'local' ? 'local' : apiStatus}`} role="status">
            <span aria-hidden="true" />
            {mode === 'local' ? t('common.localActive') : apiStatusText}
          </div>
        </div>
      </header>

      {activeView === 'dashboard' && (
        <>
          <section className="hero-section dashboard-hero">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1>{t('hero.titleTop')}<br />{t('hero.titleBottom')}</h1>
            <p className="hero-copy">{t('hero.copy')}</p>
            <p className="mode-status" role="status">
              {t('common.currentEngine')}: <strong>{currentModeLabel}</strong>
              {mode === 'local' ? ` ${t('hero.localRuns')}` : ` ${t('hero.imagesSent')}`}
            </p>
          </section>

          <section className="feature-grid" aria-label="UNSEEN AI features">
            {featureCards.map(({ id, icon: Icon, eyebrow, title, text, action }) => (
              <article className="feature-card" key={id}>
                <div className="feature-icon"><Icon size={22} aria-hidden="true" /></div>
                <p className="eyebrow">{eyebrow}</p>
                <h2>{title}</h2>
                <p>{text}</p>
                <button type="button" className="feature-action" onClick={() => setActiveView(id)}>
                  {action}
                </button>
              </article>
            ))}
          </section>
        </>
      )}

      {activeView === 'camera' && (
        <section className="page-section">
          <div className="page-heading">
            <p className="eyebrow">{t('camera.eyebrow')}</p>
            <h2>{t('camera.title')}</h2>
            <p>{t('camera.copy')}</p>
          </div>
          <CameraCapture onConfirm={handleCameraConfirm} disabled={isBusy} />
        </section>
      )}

      {activeView === 'gallery' && (
        <section className="page-section">
          <div className="page-heading">
            <p className="eyebrow">{t('gallery.eyebrow')}</p>
            <h2>{t('gallery.title')}</h2>
            <p>{t('gallery.copy')}</p>
          </div>
          <label className="gallery-dropzone" htmlFor="gallery-images">
            <Images size={30} aria-hidden="true" />
            <strong>{t('gallery.choose')}</strong>
            <span>{galleryItems.length} / 4 {t('gallery.selected')}</span>
            <input
              id="gallery-images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                addGalleryFiles(event.currentTarget.files)
                event.currentTarget.value = ''
              }}
              disabled={isBusy}
            />
          </label>
          {error && activeView === 'gallery' && <div className="error-state" role="alert"><p>{error}</p></div>}
          {galleryItems.length > 0 ? (
            <>
              <div className="gallery-grid">
                {galleryItems.map((item, index) => (
                  <figure className="gallery-item" key={item.id}>
                    <img src={item.url} alt={`Gallery upload ${index + 1}: ${item.file.name}`} />
                    <figcaption>
                      <span>{item.file.name}</span>
                      <button type="button" onClick={() => removeGalleryItem(item.id)} disabled={isBusy} aria-label={`${t('gallery.remove')} ${item.file.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <button type="button" className="analyze-button gallery-use-button" onClick={useGalleryImages} disabled={isBusy}>
                {t('gallery.use')}
              </button>
              <p className="privacy-note">{t('gallery.note')}</p>
            </>
          ) : (
            <div className="empty-state compact-empty"><h2>{t('gallery.emptyTitle')}</h2><p>{t('gallery.emptyText')}</p></div>
          )}
        </section>
      )}

      {activeView === 'highlight' && (
        <section className="page-section">
          <div className="page-heading">
            <p className="eyebrow">{t('highlight.eyebrow')}</p>
            <h2>{t('highlight.title')}</h2>
            <p>{t('highlight.copy')}</p>
          </div>
          {!file ? (
            <div className="empty-state compact-empty">
              <h2>{t('highlight.selectFirstTitle')}</h2>
              <p>{t('highlight.selectFirstText')}</p>
              <button type="button" className="feature-action" onClick={() => setActiveView('gallery')}>{t('highlight.openGallery')}</button>
            </div>
          ) : (
            <div className="highlight-layout">
              <figure className="focus-photo highlight-photo">
                <div className="focus-photo-frame">
                  <img src={resultImageUrl || previewUrl} alt={t('highlight.photoAlt')} />
                  {highlightResult?.regions.map((region) => {
                    const focus = getFocusAreaStyle(region.focus_area)
                    if (!focus) return null
                    return (
                      <div key={region.id} className="highlight-box sam-focus-box" style={focus.style}>
                        <span>{t('highlight.aiFocusRegion')} · {region.label}{region.confidence !== null ? ` · ${Math.round(region.confidence * 100)}%` : ''}</span>
                      </div>
                    )
                  })}
                </div>
                <figcaption>{file.name}</figcaption>
              </figure>
              <div className="highlight-side">
                <button type="button" className="analyze-button" onClick={runHighlight} disabled={isBusy}>
                  {highlightLoading ? t('highlight.running') : t('highlight.run')}
                </button>
                {error && <div className="error-state" role="alert"><p>{error}</p></div>}
                {highlightResult ? (
                  <div className="result-card highlight-result-card">
                    <h3>{highlightResult.regions.length ? `${highlightResult.regions.length} ${t('highlight.regionsReturned')}` : t('highlight.noRegion')}</h3>
                    <p><strong>{t('highlight.method')}:</strong> {highlightResult.method}</p>
                    <p>{highlightResult.message}</p>
                    {highlightResult.regions.length > 0 ? (
                      <ul>
                        {highlightResult.regions.map((region) => (
                          <li key={region.id}>
                            {region.label}
                            {region.confidence !== null ? ` — ${Math.round(region.confidence * 100)}% ${t('highlight.visualScore')}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="changed-note">{t('highlight.noBox')}</p>
                    )}
                    <p className="changed-note">{t('highlight.scoreNote')}</p>
                    <p className="changed-note">{t('highlight.samFallback')}</p>
                  </div>
                ) : (
                  <p className="privacy-note">{t('highlight.noRequest')}</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeView === 'investigation' && renderInvestigationWorkspace()}

      {activeView === 'visualization' && (
        <section className="page-section visualization-page">
          <div className="page-heading">
            <p className="eyebrow">{t('visualization.eyebrow')}</p>
            <h2>{t('visualization.title')}</h2>
            <p>{t('visualization.copy')}</p>
          </div>
          <Suspense fallback={<div className="empty-state compact-empty"><span className="loading-indicator" aria-hidden="true" /><h2>{t('visualization.loading')}</h2></div>}>
            <WallVisualization3D imageUrl={resultImageUrl || previewUrl} regions={mappedRegions} />
          </Suspense>
        </section>
      )}

      {activeView === 'settings' && (
        <section className="page-section settings-page">
          <div className="page-heading">
            <p className="eyebrow">{t('settings.eyebrow')}</p>
            <h2>{t('settings.title')}</h2>
            <p>{t('settings.copy')}</p>
          </div>
          <div className="settings-grid">
            <button type="button" className={mode === 'api' ? 'settings-option is-active' : 'settings-option'} onClick={() => handleModeChange('api')} disabled={isBusy} aria-pressed={mode === 'api'}>
              <Cpu size={22} aria-hidden="true" />
              <strong>{t('settings.apiTitle')}</strong>
              <span>{t('settings.apiText')} {API_BASE_URL}</span>
              <small>{apiStatusText}</small>
            </button>
            <button type="button" className={mode === 'local' ? 'settings-option is-active' : 'settings-option'} onClick={() => handleModeChange('local')} disabled={isBusy} aria-pressed={mode === 'local'}>
              <Cpu size={22} aria-hidden="true" />
              <strong>{t('settings.localTitle')}</strong>
              <span>{LOCAL_MODEL_ID}. {t('settings.localText')}</span>
              <small>{localPhaseText(localStatus)}</small>
            </button>
          </div>
          <div className="result-card settings-note">
            <h3>{t('settings.currentMode')}</h3>
            <p>{currentModeLabel}</p>
            <p>{t('settings.switchingNote')}</p>
          </div>
          <div className="result-card settings-note language-settings-card">
            <h3>{t('settings.languageTitle')}</h3>
            <p>{t('settings.languageText')}</p>
            <div className="language-switch language-switch-large" role="group" aria-label={t('common.languageLabel')}>
              <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>English</button>
              <button type="button" className={language === 'si' ? 'is-active' : ''} onClick={() => setLanguage('si')} aria-pressed={language === 'si'}>සිංහල</button>
            </div>
            <p className="changed-note">{t('pwa.offlineReady')}</p>
          </div>
        </section>
      )}

      {activeView === 'history' && (
        <section className="page-section">
          <div className="page-heading">
            <p className="eyebrow">{t('history.eyebrow')}</p>
            <h2>{t('history.title')}</h2>
            <p>{t('history.copy')}</p>
          </div>
          <div className="result-card saved-cases-card">
            <h3>{t('cases.title')}</h3>
            <p>{t('cases.note')}</p>
            {caseStatus && <p className="case-status" role="status">{caseStatus}</p>}
            {savedCases.length > 0 ? (
              <div className="history-list saved-case-list">
                {savedCases.map((savedCase) => {
                  const entries = savedCase.mode === 'api' ? (savedCase.analysisHistory || []) : []
                  const maxConfidence = Math.max(1, ...entries.map((entry) => Math.round(entry.confidence * 100)), Math.round((savedCase.analysis?.confidence || 0) * 100))
                  return (
                    <article className="history-item saved-case-item" key={savedCase.id}>
                      <div>
                        <strong>{savedCase.title}</strong>
                        <span>{t('cases.savedAt')}: {new Date(savedCase.createdAt).toLocaleString()} · {t('cases.round')} {savedCase.roundNo} · {t('cases.mode')}: {savedCase.mode === 'local' ? t('common.localMode') : t('common.apiMode')}</span>
                        {entries.length > 0 && (
                          <span className="confidence-timeline" aria-label={t('cases.timeline')}>
                            {entries.slice().reverse().map((entry) => (
                              <span key={entry.id} title={`${t('cases.round')} ${entry.round}: ${Math.round(entry.confidence * 100)}%`} style={{ height: `${Math.max(12, (Math.round(entry.confidence * 100) / maxConfidence) * 100)}%` }} />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="saved-case-actions">
                        <button type="button" className="secondary-button" onClick={() => handleOpenCase(savedCase.id)} disabled={isBusy}>{t('cases.open')}</button>
                        <button type="button" className="secondary-button danger-button" onClick={() => handleDeleteCase(savedCase.id)} disabled={isBusy}>{t('cases.delete')}</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="changed-note">{t('cases.empty')}</p>
            )}
          </div>

          {investigationHistory.length > 0 ? (
            <div className="history-list">
              {investigationHistory.map((entry) => (
                <article className="history-item" key={entry.id}>
                  <div>
                    <strong>{t('history.round')} {entry.round} · {entry.imageName}</strong>
                    <span>{entry.createdAt} · {entry.observations} {t('history.observations')} · {entry.possibleCauses} {t('history.possibleCauses')}</span>
                  </div>
                  <div className="history-meta">
                    <span>{Math.round(entry.confidence * 100)}% {t('history.confidence')}</span>
                    <span>{entry.needsMoreEvidence ? t('history.moreEvidence') : t('history.noFurther')}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : localHistory.length > 0 || localAnalysis ? (
            <div className="history-list">
              <article className="history-item">
                <div>
                  <strong>{t('history.localSession')}</strong>
                  <span>{localHistory.length + (localAnalysis ? 1 : 0)} {t('history.localRounds')}</span>
                </div>
                <div className="history-meta"><span>{t('history.onDevice')}</span><span>{currentModeLabel}</span></div>
              </article>
            </div>
          ) : (
            <div className="empty-state compact-empty"><History size={30} aria-hidden="true" /><h2>{t('history.emptyTitle')}</h2><p>{t('history.emptyText')}</p></div>
          )}
        </section>
      )}

      {activeView === 'about' && (
        <section className="page-section about-page">
          <div className="page-heading">
            <p className="eyebrow">{t('about.eyebrow')}</p>
            <h2>{t('about.title')}</h2>
            <p>{t('about.copy')}</p>
          </div>
          <div className="about-grid">
            <article className="result-card"><LayoutDashboard size={21} /><h3>{t('about.doesTitle')}</h3><p>{t('about.doesText')}</p></article>
            <article className="result-card"><Info size={21} /><h3>{t('about.notTitle')}</h3><p>{t('about.notText')}</p></article>
            <article className="result-card"><Cpu size={21} /><h3>{t('about.privacyTitle')}</h3><p>{t('about.privacyText')}</p></article>
          </div>
        </section>
      )}

      <footer className="site-footer">
        <span>{t('common.footerLeft')}</span>
        <span>{t('common.footerRight')}</span>
      </footer>
    </main>
  )
}

function App() {
  const [phase, setPhase] = useState(() => (hasSeenIntro() ? 'app' : 'splash'))
  const exitTimerRef = useRef(0)

  const handleIntroDone = useCallback(() => {
    setPhase((current) => {
      if (current !== 'splash') return current
      markIntroSeen()
      exitTimerRef.current = window.setTimeout(() => setPhase('app'), INTRO_EXIT_MS)
      return 'exiting'
    })
  }, [])

  useEffect(() => () => window.clearTimeout(exitTimerRef.current), [])

  if (phase === 'app') {
    return (
      <div className="app-reveal">
        <AnalyzeApp />
      </div>
    )
  }

  return <SplashScreen onDone={handleIntroDone} exiting={phase === 'exiting'} />
}

export default App
