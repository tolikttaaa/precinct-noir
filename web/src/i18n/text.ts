import type { TFunction } from 'i18next'
import { ApiError } from '../net/api'
import { TurnstileError } from '../net/turnstile'

// Mode texts are looked up by the server's mode id, so their keys are built at run time.
type ModeKey = 'modes.killer_inspector.name'

export function modeName(t: TFunction, mode: string): string {
  return t(`modes.${mode}.name` as ModeKey, { defaultValue: mode })
}

export function modeSummary(t: TFunction, mode: string): string {
  return t(`modes.${mode}.summary` as ModeKey, { defaultValue: '' })
}

export function optionText(
  t: TFunction,
  mode: string,
  key: string,
  part: 'label' | 'hint',
): string {
  return t(`modes.${mode}.config.${key}.${part}` as ModeKey, {
    defaultValue: part === 'label' ? key : '',
  })
}

const KNOWN_ERRORS = new Set([
  'network',
  'captcha_failed',
  'captcha_unavailable',
  'capacity',
  'unavailable',
  'rate_limited',
  'room_not_found',
  'room_locked',
  'room_full',
  'name_taken',
  'invalid_name',
])

/** What to tell a person about a failed request. */
export function errorText(t: TFunction, error: unknown, code?: string): string {
  if (error instanceof TurnstileError) return t('errors.turnstile')
  if (!(error instanceof ApiError) || !KNOWN_ERRORS.has(error.code)) return t('errors.unexpected')
  const minutes = Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60))
  return t(`errors.${error.code}` as 'errors.network', { minutes, code })
}
