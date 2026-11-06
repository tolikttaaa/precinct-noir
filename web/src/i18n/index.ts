import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import ru from './ru'

export const LANGUAGES = ['en', 'ru'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'precinctnoir.language'

/** The saved choice, else the browser's preference, else English. */
export function preferredLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ru') return saved
  } catch {
    // No storage: fall through to the browser's languages.
  }
  return navigator.languages.some((tag) => tag.toLowerCase().startsWith('ru')) ? 'ru' : 'en'
}

export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language)
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // The choice lasts for this page only.
  }
}

export function initI18n(language: Language = preferredLanguage()): typeof i18next {
  void i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, ru: { translation: ru } },
    lng: language,
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false }, // React escapes
  })
  document.documentElement.lang = language
  return i18next
}
