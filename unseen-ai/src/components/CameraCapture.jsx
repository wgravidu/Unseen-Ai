import { useEffect, useRef, useState } from 'react'
import { Camera, Check, RefreshCcw, TriangleAlert, Video } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

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
  const [guide, setGuide] = useState({ status: 'idle', brightness: null, detail: null })

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => () => {
    stopStream()
    if (captureUrlRef.current) URL.revokeObjectURL(captureUrlRef.current)
  }, [])

  useEffect(() => {
    if (phase !== 'live') return undefined
    const intervalId = window.setInterval(() => {
      const video = videoRef.current
      const canvas = sampleCanvasRef.current
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return
      canvas.width = 96
      canvas.height = 72
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let sum = 0
      let previous = null
      let edgeSum = 0
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        sum += value
        if (previous !== null) edgeSum += Math.abs(value - previous)
        previous = value
        count += 1
      }
      const brightness = Math.round(sum / Math.max(1, count))
      const detail = Math.round((edgeSum / Math.max(1, count)) * 10) / 10
      const status = brightness < 55 ? 'dark' : brightness > 215 ? 'bright' : detail < 2.2 ? 'lowDetail' : 'good'
      setGuide((current) => (
        current.status === status && current.brightness === brightness && current.detail === detail
          ? current
          : { status, brightness, detail }
      ))
    }, 450)
    return () => window.clearInterval(intervalId)
  }, [phase])

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
            <div className="camera-guide-frame" aria-hidden="true"><span /></div>
            <div className="camera-guide-card" role="status">
              <strong>{t('cameraGuide.title')} · {t('cameraGuide.ready')}</strong>
              <span>{t('cameraGuide.instruction')}</span>
              <span className={`camera-guide-status guide-${guide.status}`}>
                {guide.status === 'dark' ? t('cameraGuide.dark') : guide.status === 'bright' ? t('cameraGuide.bright') : guide.status === 'lowDetail' ? t('cameraGuide.lowDetail') : t('cameraGuide.good')}
                {guide.brightness !== null ? ` (${guide.brightness}/255)` : ''}
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
          <button type="button" className="analyze-button camera-button" onClick={capturePhoto} disabled={disabled}>
            <Camera size={17} aria-hidden="true" /> {t('camera.capture')}
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
