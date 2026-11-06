import data from '../../../shared/roster.json'
import type { Suspect } from './portrait.ts'

/** The suspects, from the shared roster (the engine uses the same ids). */
export const ROSTER: readonly Suspect[] = data.suspects as Suspect[]
