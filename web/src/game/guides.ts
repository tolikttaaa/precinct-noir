import type { TFunction } from 'i18next'

/** One walkthrough page: its text lives in the i18n catalogs under `guide.<mode>.<id>`. */
export interface GuidePageSpec {
  readonly id: string
  /**
   * A small picture of the city, one string per row: `.` a suspect, `n` one next to you, `Y` you,
   * `K` the killer, `I` the inspector, `x` a body, `c` a cleared suspect, `>` a row on the move.
   */
  readonly diagram?: readonly string[]
}

/** Each mode's "How to play" pages, in order. The server accepts up to 20 pages for the board. */
export const GUIDES: Readonly<Record<string, readonly GuidePageSpec[]>> = {
  killer_inspector: [
    { id: 'crowd', diagram: ['.....', '.K...', '.....', '...I.', '.....'] },
    { id: 'secret' },
    { id: 'first', diagram: ['.....', '.xK..', '.....', '.....', '.....'] },
    { id: 'near', diagram: ['.....', '.nnn.', '.nYn.', '.nnn.', '.....'] },
    { id: 'shift', diagram: ['.....', '.....', '>>>>>', '.....', '.....'] },
    { id: 'killer', diagram: ['.....', '.nnn.', '.nKx.', '.nnn.', '.....'] },
    { id: 'inspector', diagram: ['.....', '.nnn.', '.nIn.', '.nnn.', '....c'] },
    { id: 'collapse', diagram: ['x....', '..x..', '.x...', '....x', '...x.'] },
    { id: 'win' },
  ],
}

/** Whether a mode has a walkthrough. */
export function hasGuide(mode: string): boolean {
  return GUIDES[mode] !== undefined
}

// Page texts are looked up by mode and page id, so their keys are built at run time.
type PageKey = 'guide.killer_inspector.crowd.title'

export function guideText(t: TFunction, mode: string, id: string, part: 'title' | 'body'): string {
  return t(`guide.${mode}.${id}.${part}` as PageKey)
}
