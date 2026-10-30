import { useCallback, useEffect, useRef, useState } from 'react'
import AnimatedULogo from './AnimatedULogo.jsx'
import IntroProgressRing from './IntroProgressRing.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import './SplashScreen.css'

export const INTRO_DURATION_MS = 4200
export const INTRO_HOLD_MS = 700
export const INTRO_EXIT_MS = 800
export const TEXT_REVEAL_MS = 1500
const STATUS_SWITCH_MS = 2600

const REDUCED_FADE_MS = 650
const REDUCED_HOLD_MS = 450

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function SplashScreen({ onDone, exiting }) {
  const { t } = useLanguage()
  const reduced = prefersReducedMotion()
  const countDuration = reduced ? REDUCED_FADE_MS + REDUCED_HOLD_MS : INTRO_DURATION_MS
  const totalDuration = countDuration + (reduced ? 0 : INTRO_HOLD_MS)
  const [elapsed, setElapsed] = useState(0)
  const doneRef = useRef(false)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  useEffect(() => {
    const startedAt = Date.now()
    const intervalId = window.setInterval(() => {
      const value = Math.min(Date.now() - startedAt, totalDuration)
      setElapsed(value)
      if (value >= totalDuration) {
        window.clearInterval(intervalId)
        finish()
      }
    }, 33)
    return () => window.clearInterval(intervalId)
  }, [totalDuration, finish])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const isComplete = !reduced && elapsed >= INTRO_DURATION_MS
  const progress = reduced ? 1 : Math.min(1, elapsed / INTRO_DURATION_MS)
  const showText = reduced || elapsed >= TEXT_REVEAL_MS
  const status = isComplete
    ? t('splash.ready')
    : elapsed >= STATUS_SWITCH_MS
      ? t('splash.preparing')
      : t('splash.initializing')

  return (
    <div
      className={`splash${reduced ? ' splash-reduced' : ''}${exiting ? ' splash-exiting' : ''}`}
      role="presentation"
    >
      <div className="splash-bg" aria-hidden="true">
        <span className="splash-ambient splash-ambient-cyan" />
        <span className="splash-ambient splash-ambient-violet" />
        <span className="splash-scanlines" />
        <span className="splash-particles" />
        <span className="splash-beam" />
      </div>

      <div className="splash-stage">
        <div className="splash-ring-wrap">
          {!reduced && <IntroProgressRing progress={progress} label={t('splash.loading')} />}
          <div className="splash-logo-ring">
            <AnimatedULogo />
            <span className="u-reflection" aria-hidden="true" />
          </div>
        </div>

        <div className={`splash-title-block${showText ? ' is-visible' : ''}`}>
          <h1 className="splash-title">
            UNSEEN <span className="splash-title-ai">AI</span>
          </h1>
          <p className="splash-subtitle">{t('splash.subtitle')}</p>
          <p className="splash-tagline">{t('splash.tagline')}</p>
        </div>

        {!reduced && (
          <p
            key={status}
            className={`splash-status${isComplete ? ' splash-status-ready' : ''}`}
            aria-live="polite"
          >
            {status}
          </p>
        )}
      </div>

      <button type="button" className="splash-skip" onClick={finish}>
        {t('splash.skip')}
      </button>
      <span className="sr-only" role="status">
        {t('splash.loading')}
      </span>
    </div>
  )
}
