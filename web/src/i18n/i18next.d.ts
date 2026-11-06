import 'i18next'
import type { Messages } from './en'

// Typed keys: t('lobby.start') is checked against the English texts.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Messages }
  }
}
