import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import en from '../../web/src/i18n/en'
import ru from '../../web/src/i18n/ru'
import { RU_NAMES } from '../../web/src/i18n/suspectNames'

/**
 * The app's own texts, so the tests find buttons by what a player reads, in either language, and keep
 * working when the wording changes.
 */
export type Language = 'en' | 'ru'
export type Texts = typeof en
export const TEXTS: Record<Language, Texts> = { en, ru: ru as unknown as Texts }

/** Fills `{{name}}` placeholders, as i18next does. */
export function fill(text: string, values: Record<string, string | number> = {}): string {
  return text.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => String(values[key]))
}

interface Roster {
  suspects: { id: number; name: string }[]
}

const roster = JSON.parse(
  readFileSync(join(__dirname, '../../shared/roster.json'), 'utf8'),
) as Roster

const byName = new Map<string, number>()
for (const s of roster.suspects) {
  byName.set(s.name, s.id)
  byName.set(RU_NAMES[s.id], s.id)
}

/** A suspect's id from their name in either language. */
export function idOf(name: string): number {
  const id = byName.get(name)
  if (id === undefined) throw new Error(`No suspect is called ${name}`)
  return id
}

export function nameOf(id: number, language: Language): string {
  if (language === 'ru') return RU_NAMES[id]
  const suspect = roster.suspects.find((s) => s.id === id)
  if (!suspect) throw new Error(`No suspect has id ${id}`)
  return suspect.name
}
