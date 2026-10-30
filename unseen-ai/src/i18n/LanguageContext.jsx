import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { translations } from './translations.js'

export const LANGUAGE_STORAGE_KEY = 'unseen-ai-language'

const LanguageContext = createContext(null)

function loadLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'si' ? 'si' : 'en'
  } catch {
    return 'en'
  }
}

function storeLanguage(language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage may be unavailable in strict privacy contexts.
  }
}

function lookup(language, key) {
  const parts = key.split('.')
  let value = translations[language]
  for (const part of parts) value = value?.[part]
  if (typeof value === 'string') return value
  let fallback = translations.en
  for (const part of parts) fallback = fallback?.[part]
  return typeof fallback === 'string' ? fallback : key
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const initial = loadLanguage()
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initial === 'si' ? 'si' : 'en'
    }
    return initial
  })

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = nextLanguage === 'si' ? 'si' : 'en'
    setLanguageState(normalized)
    storeLanguage(normalized)
    document.documentElement.lang = normalized === 'si' ? 'si' : 'en'
  }, [])

  const value = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'si' ? 'en' : 'si'),
    t: (key) => lookup(language, key),
    isSinhala: language === 'si',
  }), [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
