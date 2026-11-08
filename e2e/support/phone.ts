import { expect, type Locator, type Page } from '@playwright/test'
import { allShifts, direction, type Grid, type Place, type Shift } from './grid'
import { fill, idOf, nameOf, TEXTS, type Language, type Texts } from './texts'

export type Role = 'killer' | 'inspector'

/** Pause after each move, so a recording can be followed by eye. */
export const PACE = Number(process.env.E2E_PACE ?? (process.env.E2E_VIDEO ? 900 : 100))

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A player's phone, driven the way a person would: by the buttons and cards on screen, in the phone's own
 * language. It also reads the player's secrets by holding their file open, which a person can do too.
 */
export class Phone {
  readonly t: Texts

  constructor(
    readonly page: Page,
    readonly name: string,
    readonly language: Language,
  ) {
    this.t = TEXTS[language]
  }

  private get controls(): Locator {
    return this.page.locator('.duel-controls')
  }

  private get board(): Locator {
    return this.page.locator('.board')
  }

  /** A button in the action bar, by its exact text. */
  private button(text: string): Locator {
    return this.controls.getByRole('button', { name: text, exact: true })
  }

  private card(scope: Locator, id: number): Locator {
    const name = nameOf(id, this.language)
    return scope.getByRole('button', { name: new RegExp(`^${escape(name)}(,|$)`) })
  }

  async join(code: string): Promise<void> {
    await this.page.goto(`/${code}`)
    await this.page.getByLabel(this.t.join.name).fill(this.name)
    await this.page.waitForTimeout(PACE)
    await this.page.getByRole('button', { name: this.t.join.action }).click()
    await expect(this.page.getByText(this.name, { exact: true }).first()).toBeVisible()
    await this.page.waitForTimeout(PACE)
  }

  async role(): Promise<Role> {
    const text = await this.page.locator('.dossier__role').innerText()
    return text === this.t.duel.youAre.killer ? 'killer' : 'inspector'
  }

  /** True on this player's own decision, before they've sent it. */
  async canAct(): Promise<boolean> {
    if ((await this.controls.count()) === 0) return false
    return (await this.controls.getByRole('status').count()) === 0
  }

  async prompt(): Promise<string> {
    return this.page.locator('.duel-phone__prompt').innerText()
  }

  /** Who this player is: press and hold the file, read it, let go. */
  async identity(): Promise<number> {
    const folder = this.page.locator('.dossier__folder')
    await folder.scrollIntoViewIfNeeded()
    const box = await folder.boundingBox()
    if (!box) throw new Error(`${this.name}'s file isn't on screen`)
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.down()
    const label = await this.page
      .locator('.dossier__identity .suspect-card')
      .getAttribute('aria-label')
    await this.page.waitForTimeout(PACE)
    await this.page.mouse.up()
    if (!label) throw new Error(`${this.name} has no identity`)
    return idOf(label.split(', ')[0])
  }

  /** The city as this phone shows it. */
  async grid(): Promise<Grid> {
    const cells = await this.board.locator('.board__cell').evaluateAll((nodes) =>
      nodes.map((node) => {
        const cell = node as HTMLElement
        const card = cell.querySelector('.suspect-card')
        return {
          row: parseInt(cell.style.gridRow, 10),
          col: parseInt(cell.style.gridColumn, 10),
          name: (card?.getAttribute('aria-label') ?? '').split(', ')[0],
          alive: !card?.hasAttribute('data-dead'),
        }
      }),
    )
    const top = Math.min(...cells.map((c) => c.row))
    const left = Math.min(...cells.map((c) => c.col))
    const at = new Map<number, Place>()
    for (const cell of cells)
      at.set(idOf(cell.name), { r: cell.row - top, c: cell.col - left, alive: cell.alive })
    return {
      rows: Math.max(...cells.map((c) => c.row)) - top + 1,
      cols: Math.max(...cells.map((c) => c.col)) - left + 1,
      at,
    }
  }

  private arrowLabel(shift: Shift): string {
    return fill(this.t.duel.shiftLine[shift.axis], {
      n: shift.index + 1,
      dir: this.t.duel.dir[direction(shift)],
    })
  }

  /** The shifts the board offers right now: an undo of the last one is greyed out. */
  async shifts(grid: Grid): Promise<Shift[]> {
    const open: Shift[] = []
    for (const shift of allShifts(grid)) {
      const arrow = this.board.getByRole('button', { name: this.arrowLabel(shift), exact: true })
      if ((await arrow.count()) > 0 && (await arrow.isEnabled())) open.push(shift)
    }
    return open
  }

  async shift(shift: Shift): Promise<void> {
    const label = this.arrowLabel(shift)
    await this.board.getByRole('button', { name: label, exact: true }).click()
    await this.page.waitForTimeout(PACE)
    await this.button(label).click()
  }

  /** Suspects lit as targets once [action] is chosen, then the choice is cancelled. */
  async targets(action: 'kill' | 'accuse'): Promise<number[]> {
    const start = this.button(this.t.duel.action[action])
    if ((await start.count()) === 0) return []
    await start.click()
    const lit = await this.board
      .locator('button.suspect-card[data-lit]')
      .evaluateAll((cards) => cards.map((c) => (c.getAttribute('aria-label') ?? '').split(', ')[0]))
    await this.button(this.t.duel.cancel).click()
    return lit.map(idOf)
  }

  /** Kill or accuse [id]. The killer's first move starts with the targets already lit. */
  async strike(action: 'kill' | 'accuse', id: number): Promise<void> {
    const start = this.button(this.t.duel.action[action])
    if ((await start.count()) > 0) await start.click()
    await this.card(this.board, id).click()
    await this.page.waitForTimeout(PACE)
    const confirm = this.t.duel.confirmTarget[action]
    await this.button(fill(confirm, { name: nameOf(id, this.language) })).click()
  }

  /** The killer's opening kill: any lit suspect. */
  async firstKill(): Promise<void> {
    const label = await this.board
      .locator('button.suspect-card[data-lit]')
      .first()
      .getAttribute('aria-label')
    await this.strike('kill', idOf((label ?? '').split(', ')[0]))
  }

  /** Choose one of the cards offered face up: an identity, or the card to clear. */
  async pick(kind: 'choose_identity' | 'exonerate_discard'): Promise<number> {
    const card = this.page.locator('.pick button.suspect-card:not([data-dead])').first()
    const id = idOf(((await card.getAttribute('aria-label')) ?? '').split(', ')[0])
    await card.click()
    await this.page.waitForTimeout(PACE)
    await this.button(fill(this.t.duel.pick[kind], { name: nameOf(id, this.language) })).click()
    return id
  }

  async picking(): Promise<boolean> {
    return (await this.page.locator('.pick').count()) > 0
  }

  /** Clear a suspect: draw a card, then put one face up. The face-up pick follows as its own decision. */
  async clearSuspect(): Promise<void> {
    await this.button(this.t.duel.action.exonerate).click()
    await this.page.waitForTimeout(PACE)
    await this.button(this.t.duel.action.exonerate).click()
  }
}
