import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Flashlight, FlashlightOff, MoveDiagonal, RefreshCcw, Scan, TriangleAlert, Video } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { GUIDE_THRESHOLDS, classifyGuideFrame, measureSubjectCoverage } from './cameraGuide.js'

function cameraErrorMessage(error, t) {
  if (!window.isSecureContext) return t('camera.secure')
  if (!navigator.mediaDevices?.getUserMedia) return t('camera.unsupported')
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') return t('camera.denied')
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return t('camera.notFound')
  if (error?.name === 'NotReadableError') return t('camera.busy')
  return t('camera.failed')
}

export default function CameraCapture({ onConfirm, disabled }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const sampleCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const captureUrlRef = useRef('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [captureUrl, setCaptureUrl] = useState('')
  const [guide, setGuide] = useState({
    status: 'idle', brightness: null, detail: null, motion: null, sharpness: null, ready: false,
  })
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const pendingStatusRef = useRef({ status: null, count: 0 })
  const holdTimerRef = useRef(null)
  const wasReadyRef = useRef(false)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setTorchOn(false)
    setTorchSupported(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track?.applyConstraints) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn(!torchOn)
    } catch {
      setTorchSupported(false)
    }
  }

  useEffect(() => () => {
    stopStream()
    if (captureUrlRef.current) URL.revokeObjectURL(captureUrlRef.current)
  }, [])

  useEffect(() => {
    pendingStatusRef.current = { status: null, count: 0 }
    wasReadyRef.current = false
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
  }, [phase])

  useEffect(() => {
    if (phase !== 'live') return undefined
    let previousLuminance = null
    const intervalId = window.setInterval(() => {
      const video = videoRef.current
      const canvas = sampleCanvasRef.current
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return
      canvas.width = 96
      canvas.height = 72
      const width = canvas.width
      const height = canvas.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(video, 0, 0, width, height)
      const { data } = context.getImageData(0, 0, width, height)
      const luminance = new Float32Array(width * height)
      let sum = 0
      let edgeSum = 0
      let count = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const p = y * width + x
          const i = p * 4
          const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          luminance[p] = value
          sum += value
          if (x > 0) edgeSum += Math.abs(value - luminance[p - 1])
          if (y > 0) edgeSum += Math.abs(value - luminance[p - width])
          count += 1
        }
      }
      let motion = 0
      if (previousLuminance && previousLuminance.length === luminance.length) {
        let diff = 0
        for (let p = 0; p < luminance.length; p += 1) diff += Math.abs(luminance[p] - previousLuminance[p])
        motion = Math.round((diff / luminance.length) * 10) / 10
      }
      previousLuminance = luminance
      const brightness = Math.round(sum / Math.max(1, count))
      const detail = Math.round((edgeSum / Math.max(1, count)) * 10) / 10
      const lightingStatus = brightness < GUIDE_THRESHOLDS.darkBrightness
        ? 'dark'
        : brightness > GUIDE_THRESHOLDS.brightBrightness ? 'bright' : null
      const frameStatus = classifyGuideFrame({ brightness, detail, motion })
      const coverage = measureSubjectCoverage(data, width, height)
      const needsCloser = !lightingStatus && frameStatus === 'good'
        && detail < GUIDE_THRESHOLDS.lowDetail + 1.2 && coverage < GUIDE_THRESHOLDS.closerCoverage
      const rawStatus = needsCloser ? 'closer' : frameStatus

      // Only commit a status after two consistent samples so hints don't flicker.
      const pending = pendingStatusRef.current
      if (pending.status === rawStatus) pending.count += 1
      else pendingStatusRef.current = { status: rawStatus, count: 1 }
      const stableFrames = pendingStatusRef.current.count
      const sharpness = Math.max(0, Math.min(100,
        Math.round((detail / GUIDE_THRESHOLDS.lowDetail) * 70 + (motion < 2.5 ? 30 : motion < 7 ? 14 : 0))))

      setGuide((current) => {
        if (stableFrames < 2 && current.status !== 'idle') return current
        const sharpStable = Math.abs((current.sharpness ?? sharpness) - sharpness) >= 4
        const nextReady = current.ready
        if (current.status === rawStatus && current.brightness === brightness
          && current.detail === detail && !sharpStable && current.ready === nextReady) {
          return current
        }
        return {
          status: rawStatus, brightness, detail, motion, sharpness, ready: current.ready,
        }
      })
    }, 350)
    return () => window.clearInterval(intervalId)
  }, [phase])

  useEffect(() => {
    if (phase !== 'live' || guide.status !== 'good') {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      if (wasReadyRef.current) {
        wasReadyRef.current = false
        setGuide((current) => (current.ready ? { ...current, ready: false } : current))
      }
      return undefined
    }
    if (wasReadyRef.current) return undefined
    holdTimerRef.current = window.setTimeout(() => {
      wasReadyRef.current = true
      setGuide((current) => (current.status === 'good' ? { ...current, ready: true } : current))
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(35) } catch { /* vibration is a progressive enhancement */ }
      }
    }, 900)
    return () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    }
  }, [guide.status, phase])

  const startCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(cameraErrorMessage(null, t))
      setPhase('error')
      return
    }
    try {
      stopStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      const track = stream.getVideoTracks?.()[0]
      try {
        const capabilities = track?.getCapabilities?.()
        setTorchSupported(Boolean(capabilities && 'torch' in capabilities))
      } catch {
        setTorchSupported(false)
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('live')
    } catch (cameraError) {
      setError(cameraErrorMessage(cameraError, t))
      setPhase('error')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setError(t('camera.saveFailed'))
        setPhase('error')
        return
      }
      if (captureUrlRef.current) URL.revokeObjectURL(captureUrlRef.current)
      captureUrlRef.current = URL.createObjectURL(blob)
      setCaptureUrl(captureUrlRef.current)
      stopStream()
      setPhase('captured')
    }, 'image/jpeg', 0.92)
  }

  const retake = () => {
    if (captureUrlRef.current) URL.revokeObjectURL(captureUrlRef.current)
    captureUrlRef.current = ''
    setCaptureUrl('')
    startCamera()
  }

  const confirm = async () => {
    if (!captureUrl) return
    const response = await fetch(captureUrl)
    const blob = await response.blob()
    const capturedFile = new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {
      type: 'image/jpeg',
    })
    onConfirm(capturedFile)
  }

  return (
    <section className="camera-panel">
      <div className="camera-frame">
        {phase === 'captured' && captureUrl ? (
          <img src={captureUrl} alt={t('camera.capturedAlt')} />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline aria-label={t('camera.liveLabel')} />
        )}
        {phase === 'idle' && (
          <div className="camera-idle">
            <Camera size={34} aria-hidden="true" />
            <p>{t('camera.idle')}</p>
          </div>
        )}
        {phase === 'error' && (
          <div className="camera-idle camera-error" role="alert">
            <TriangleAlert size={30} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
        {phase === 'live' && (
          <>
            <div className={`camera-guide-frame guide-frame-${guide.status}${guide.ready ? ' is-ready' : ''}`} aria-hidden="true"><span /></div>
            <div className="camera-live-top" aria-hidden="true">
              <span className="camera-live-pill"><span className="camera-live-dot" /> LIVE</span>
              {guide.brightness !== null && (
                <span className="camera-live-pill">{guide.brightness}/255</span>
              )}
            </div>
            {torchSupported && (
              <button
                type="button"
                className={`camera-torch-button${torchOn ? ' is-on' : ''}`}
                onClick={toggleTorch}
                disabled={disabled}
                aria-pressed={torchOn}
                aria-label={t('cameraGuide.torch')}
              >
                {torchOn ? <Flashlight size={19} aria-hidden="true" /> : <FlashlightOff size={19} aria-hidden="true" />}
              </button>
            )}
            <div className="camera-guide-card" role="status" aria-live="polite">
              <strong><Scan size={14} aria-hidden="true" /> {t('cameraGuide.title')}</strong>
              <span key={guide.status} className={`camera-guide-status guide-${guide.status}`}>
                {guide.status === 'dark' ? t('cameraGuide.dark')
                  : guide.status === 'bright' ? t('cameraGuide.bright')
                    : guide.status === 'blurry' ? t('cameraGuide.blurry')
                      : guide.status === 'moving' ? t('cameraGuide.moving')
                        : guide.status === 'closer' ? t('cameraGuide.closer')
                          : t('cameraGuide.good')}
              </span>
              {guide.sharpness !== null && (
                <span className="camera-meter">
                  <span
                    className={`camera-meter-fill guide-meter-${guide.status}`}
                    style={{ width: `${guide.sharpness}%` }}
                  />
                </span>
              )}
              <span className="camera-guide-instruction">
                {guide.status === 'closer'
                  ? <><MoveDiagonal size={13} aria-hidden="true" /> {t('cameraGuide.closerHint')}</>
                  : t('cameraGuide.instruction')}
              </span>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} hidden />
      <canvas ref={sampleCanvasRef} hidden />

      <div className="camera-actions">
        {phase !== 'live' && phase !== 'captured' && (
          <button type="button" className="analyze-button camera-button" onClick={startCamera} disabled={disabled}>
            <Video size={17} aria-hidden="true" /> {t('camera.start')}
          </button>
        )}
        {phase === 'live' && (
          <button
            type="button"
            className={`analyze-button camera-button camera-shutter${guide.ready ? ' is-ready' : ''}`}
            onClick={capturePhoto}
            disabled={disabled}
          >
            <Camera size={17} aria-hidden="true" /> {guide.ready ? t('cameraGuide.captureReady') : t('camera.capture')}
          </button>
        )}
        {phase === 'captured' && (
          <>
            <button type="button" className="secondary-button" onClick={retake} disabled={disabled}>
              <RefreshCcw size={16} aria-hidden="true" /> {t('camera.retake')}
            </button>
            <button type="button" className="analyze-button camera-button" onClick={confirm} disabled={disabled}>
              <Check size={17} aria-hidden="true" /> {t('camera.confirm')}
            </button>
          </>
        )}
      </div>
      <p className="privacy-note">{t('camera.stays')}</p>
    </section>
  )
}
