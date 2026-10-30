import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Box,
  Camera,
  Cpu,
  History,
  Images,
  Info,
  LayoutDashboard,
  ScanSearch,
  SearchCheck,
  Settings2,
  X,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const NAV_ITEMS = [
  { id: 'dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'camera', key: 'nav.camera', icon: Camera },
  { id: 'gallery', key: 'nav.gallery', icon: Images },
  { id: 'highlight', key: 'nav.highlight', icon: ScanSearch },
  { id: 'investigation', key: 'nav.investigation', icon: SearchCheck },
  { id: 'visualization', key: 'nav.visualization', icon: Box },
  { id: 'settings', key: 'nav.settings', icon: Settings2 },
  { id: 'history', key: 'nav.history', icon: History },
  { id: 'about', key: 'nav.about', icon: Info },
]

export default function SideNav({
  open,
  activeView,
  mode,
  onClose,
  onNavigate,
  onModeChange,
  isBusy,
}) {
  const { t } = useLanguage()
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const pick = (view) => {
    onNavigate(view)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="nav-backdrop"
            aria-label={t('common.menuClose')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="side-nav"
            role="dialog"
            aria-modal="true"
            aria-label="UNSEEN AI navigation"
            initial={{ x: '-104%' }}
            animate={{ x: 0 }}
            exit={{ x: '-104%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
          >
            <div className="side-nav-head">
              <div className="side-nav-brand">
                <span className="brand-mark" aria-hidden="true">U</span>
                <div>
                  <strong>UNSEEN <span className="brand-light">AI</span></strong>
                  <span>{t('common.tagline')}</span>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="icon-button"
                onClick={onClose}
                aria-label={t('common.menuClose')}
              >
                <X size={19} />
              </button>
            </div>

            <nav className="side-nav-list" aria-label="Primary">
              {NAV_ITEMS.map(({ id, key, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={activeView === id ? 'nav-item is-active' : 'nav-item'}
                  onClick={() => pick(id)}
                  aria-current={activeView === id ? 'page' : undefined}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{t(key)}</span>
                </button>
              ))}
            </nav>

            <section className="nav-engine-card" aria-labelledby="nav-engine-heading">
              <p id="nav-engine-heading">
                <Cpu size={15} aria-hidden="true" /> {t('nav.engineSettings')}
              </p>
              <div className="nav-mode-options">
                <button
                  type="button"
                  className={mode === 'api' ? 'nav-mode-option is-active' : 'nav-mode-option'}
                  onClick={() => onModeChange('api')}
                  disabled={isBusy}
                  aria-pressed={mode === 'api'}
                >
                  <span>{t('nav.apiAi')}</span>
                  <small>{t('nav.apiAiSub')}</small>
                </button>
                <button
                  type="button"
                  className={mode === 'local' ? 'nav-mode-option is-active' : 'nav-mode-option'}
                  onClick={() => onModeChange('local')}
                  disabled={isBusy}
                  aria-pressed={mode === 'local'}
                >
                  <span>{t('nav.localAi')}</span>
                  <small>{t('nav.localAiSub')}</small>
                </button>
              </div>
              <span className="nav-current-mode">
                {t('nav.currentEngine')}: {mode === 'api' ? `${t('nav.apiAi')} — ${t('nav.apiAiSub')}` : `${t('nav.localAi')} — ${t('nav.localAiSub')}`}
              </span>
              <button type="button" className="nav-settings-link" onClick={() => pick('settings')}>
                {t('nav.openSettings')}
              </button>
            </section>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
