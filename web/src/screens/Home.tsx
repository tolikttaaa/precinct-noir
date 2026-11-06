import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Masthead } from '../components/Chrome'
import { errorText } from '../i18n/text'
import { api, ApiError } from '../net/api'
import { saveCredentials } from '../net/credentials'
import { humanToken } from '../net/turnstile'
import { navigate, normalizeCode } from '../routing'

export function Home() {
  const { t } = useTranslation()
  const widget = useRef<HTMLDivElement>(null)
  const codeId = useId()
  const [opening, setOpening] = useState(false)
  const [hostError, setHostError] = useState<string>()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)

  async function openRoom() {
    setOpening(true)
    setHostError(undefined)
    try {
      const { turnstileSiteKey } = await api.config()
      if (!turnstileSiteKey) throw new ApiError(503, 'captcha_unavailable')
      const room = await api.createRoom(await humanToken(turnstileSiteKey, widget.current!))
      saveCredentials(room.code, 'host', { token: room.hostToken, clientSeq: 0 })
      navigate(`/tv/${room.code}`)
    } catch (error) {
      setHostError(errorText(t, error))
      setOpening(false)
    }
  }

  function join(event: FormEvent) {
    event.preventDefault()
    const room = normalizeCode(code)
    if (room) navigate(`/${room}`)
    else setCodeError(true)
  }

  return (
    <div className="screen screen--home">
      <Masthead named={false} />
      <main className="home">
        <h1 className="home__title">{t('appName')}</h1>
        <p className="home__tagline">{t('home.tagline')}</p>
        <div className="home__choices">
          <section className="file" aria-labelledby="host-title">
            <h2 id="host-title" className="file__tab">
              {t('home.host.title')}
            </h2>
            <p>{t('home.host.body')}</p>
            <button
              type="button"
              className="button"
              disabled={opening}
              onClick={() => void openRoom()}
            >
              {opening ? t('home.host.working') : t('home.host.action')}
            </button>
            {hostError && (
              <p className="message message--error" role="alert">
                {hostError}
              </p>
            )}
            <div ref={widget} className="turnstile" />
          </section>
          <form className="file" aria-labelledby="join-title" onSubmit={join} noValidate>
            <h2 id="join-title" className="file__tab">
              {t('home.join.title')}
            </h2>
            <div className="field">
              <label className="field__label" htmlFor={codeId}>
                {t('home.join.code')}
              </label>
              <input
                id={codeId}
                className="typed typed--code"
                value={code}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`${codeId}-hint`}
                aria-invalid={codeError || undefined}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setCodeError(false)
                }}
              />
              <span id={`${codeId}-hint`} className="hint">
                {codeError ? t('home.join.invalid') : t('home.join.codeHint')}
              </span>
            </div>
            <button type="submit" className="button">
              {t('home.join.action')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
