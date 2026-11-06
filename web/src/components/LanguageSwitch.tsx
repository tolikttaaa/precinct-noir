import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '../i18n'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <div className="language" role="group" aria-label={t('language')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-label={t(`languages.${language}`)}
          aria-pressed={i18n.language === language}
          onClick={() => setLanguage(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
