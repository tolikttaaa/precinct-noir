import { useTranslation } from 'react-i18next'
import { Masthead } from '../components/Chrome'
import { Link } from '../components/Link'

export function Missing() {
  const { t } = useTranslation()
  return (
    <div className="screen screen--plain">
      <Masthead />
      <main className="plain">
        <h1 className="plain__title">{t('missing.title')}</h1>
        <p>{t('missing.body')}</p>
        <Link to="/" className="button">
          {t('endings.home')}
        </Link>
      </main>
    </div>
  )
}
