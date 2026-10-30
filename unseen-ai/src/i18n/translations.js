// English ships in the entry chunk as the instant fallback. Other languages
// are code-split and loaded on demand by LanguageContext.
import { en } from './en.js'

export const translations = { en }

const loaders = {
  si: () => import('./si.js').then((module) => module.si),
}

export async function loadLanguagePack(language) {
  if (translations[language]) return translations[language]
  const load = loaders[language]
  if (!load) return en
  const pack = await load()
  translations[language] = pack
  return pack
}
