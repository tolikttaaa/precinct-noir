import { useTranslation } from 'react-i18next'
import { useConfig } from '../hooks/useConfig'

/**
 * Which build is running: "Version 0.1.0 · 1e96502" for a release, "Development build" otherwise. Quiet, for
 * whoever needs to check what's deployed. Nothing shows until the server has said.
 */
export function Version() {
  const { t } = useTranslation()
  const config = useConfig()
  if (config === undefined) return null
  const build =
    config.version === undefined
      ? t('version.dev')
      : t('version.release', { version: config.version })
  const commit = config.commit?.slice(0, 7)
  return <p className="version">{commit ? `${build} · ${commit}` : build}</p>
}
