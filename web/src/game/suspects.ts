import { RU_NAMES } from '../i18n/suspectNames'
import { PHOTOS } from '../portraits/photos'
import { portraitUri } from '../portraits/portrait'
import { ROSTER } from '../portraits/roster'

const byId = new Map(ROSTER.map((s) => [s.id, s]))
const portraits = new Map<number, string>()

/** A suspect's portrait as an image source: their picture if there is one, else drawn once and reused. */
export function portraitOf(id: number): string | undefined {
  const s = byId.get(id)
  if (!s) return undefined
  const photo = PHOTOS.get(id)
  if (photo !== undefined) return photo
  let uri = portraits.get(id)
  if (uri === undefined) {
    uri = portraitUri(s)
    portraits.set(id, uri)
  }
  return uri
}

/** A suspect's name in the current language; unknown ids show their number. */
export function suspectName(id: number, language: string): string {
  const s = byId.get(id)
  if (!s) return `#${id}`
  return language.startsWith('ru') ? RU_NAMES[id] : s.name
}

/** The i18n context for words that agree with a suspect's gender (Russian needs it). */
export function genderOf(id: number): 'f' | 'm' {
  return byId.get(id)?.gender === 'f' ? 'f' : 'm'
}

/** The case-file number printed on a suspect's card. */
export function fileNumber(id: number): string {
  return String(id + 101).padStart(4, '0')
}
