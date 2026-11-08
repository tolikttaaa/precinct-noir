import { expect, type Locator, type Page } from '@playwright/test'
import { allShifts, direction, type Grid, type Place, type Shift } from './grid'
import { fill, idOf, nameOf, TEXTS, type Language, type Texts } from './texts'

export type Role = 'killer' | 'inspector'
/** A phone (390×844, touch) or a laptop (1440×900, mouse): the game's two player layouts. */
export type Device = 'phone' | 'laptop'
export type Action = 'kill' | 'accuse' | 'disguise' | 'exonerate' | 'shift' | 'collapse'

/** Pause after each move, so a recording can be followed by eye. */
export const PACE = Number(process.env.E2E_PACE ?? (process.env.E2E_VIDEO ? 900 : 100))

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A player at their phone or laptop, driven the way a person would: by the buttons and cards on screen, in
 * the device's own language. It also reads the player's secrets by holding their file open, which a person
 * can do too.
 */
export class Player {
  readonly t: Texts

  constructor(
    readonly page: Page,
    readonly name: string,
    readonly language: Language,
    readonly device: Device,
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

  /** An action's tab, shown on a turn with several actions. */
  private tab(action: Action): Locator {
    return this.page.getByRole('tab', { name: this.t.duel.action[action], exact: true })
  }

  /** Switch to an action's tab, straight from whichever is open; nothing to do when there are no tabs. */
  private async choose(action: Action): Promise<void> {
    const tab = this.tab(action)
    if ((await tab.count()) === 0) return
    if ((await tab.getAttribute('aria-selected')) !== 'true') {
      await tab.click()
      await this.page.waitForTimeout(PACE / 2)
    }
  }

  /** True when the action's tab can be used now. */
  async available(action: Action): Promise<boolean> {
    const tab = this.tab(action)
    return (await tab.count()) > 0 && (await tab.getAttribute('data-off')) === null
  }

  /** What an action's tab says: what it does, or why it can't be done now. */
  async explanation(action: Action): Promise<string> {
    await this.choose(action)
    return this.page.getByRole('tabpanel').innerText()
  }

  private async litOnBoard(): Promise<number[]> {
    const names = await this.board
      .locator('button.suspect-card[data-lit]')
      .evaluateAll((cards) => cards.map((c) => (c.getAttribute('aria-label') ?? '').split(', ')[0]))
    return names.map(idOf)
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

  /**
   * Who this player is: press and hold the file, read it, let go. Held, the file covers the whole screen,
   * and the city inside it marks the player's own tile.
   */
  async identity(): Promise<number> {
    const folder = this.page.locator('.dossier__folder')
    await folder.scrollIntoViewIfNeeded()
    const box = await folder.boundingBox()
    if (!box) throw new Error(`${this.name}'s file isn't on screen`)
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.down()
    const open = this.page.locator('.dossier__open')
    expect(await open.boundingBox()).toEqual({ x: 0, y: 0, ...this.page.viewportSize() })
    const label = await open.locator('.dossier__identity .suspect-card').getAttribute('aria-label')
    if (!label) throw new Error(`${this.name} has no identity`)
    const name = label.split(', ')[0]
    const marked = await open.locator('.dossier__city [data-mine]').getAttribute('aria-label')
    expect(marked?.split(', ')[0]).toBe(name)
    // The evidence in hand is marked too, wherever it still stands in the city.
    const names = (selector: string) =>
      open
        .locator(selector)
        .evaluateAll((nodes) =>
          nodes.map((n) => (n.getAttribute('aria-label') ?? '').split(', ')[0]),
        )
    const hand = await names('.dossier__hand .suspect-card')
    const inCity = await names('.dossier__city .suspect-card')
    const evidence = await names('.dossier__city [data-evidence]')
    expect(evidence.sort()).toEqual(hand.filter((n) => inCity.includes(n)).sort())
    // On a laptop the open file is a spread: the identity on the left, the city on its right.
    if (this.device === 'laptop') {
      const you = await open.locator('.dossier__identity').boundingBox()
      const city = await open.locator('.dossier__city').boundingBox()
      expect(city && you && city.x > you.x + you.width).toBe(true)
    }
    await this.page.waitForTimeout(PACE)
    await this.page.mouse.up()
    await expect(open).toHaveCount(0)
    return idOf(name)
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
    await this.choose('shift')
    const open: Shift[] = []
    for (const shift of allShifts(grid)) {
      const arrow = this.board.getByRole('button', { name: this.arrowLabel(shift), exact: true })
      if ((await arrow.count()) > 0 && (await arrow.isEnabled())) open.push(shift)
    }
    return open
  }

  async shift(shift: Shift): Promise<void> {
    await this.choose('shift')
    const label = this.arrowLabel(shift)
    await this.board.getByRole('button', { name: label, exact: true }).click()
    await this.page.waitForTimeout(PACE)
    await this.button(label).click()
  }

  /** Suspects lit as targets on [action]'s tab, or none when the tab can't be used. */
  async targets(action: 'kill' | 'accuse'): Promise<number[]> {
    if (!(await this.available(action))) return []
    await this.choose(action)
    return this.litOnBoard()
  }

  /** Kill or accuse [id]. */
  async strike(action: 'kill' | 'accuse', id: number): Promise<void> {
    await this.choose(action)
    await this.card(this.board, id).click()
    await this.page.waitForTimeout(PACE)
    const confirm = this.t.duel.confirmTarget[action]
    await this.button(fill(confirm, { name: nameOf(id, this.language) })).click()
  }

  /** The killer's opening kill: any lit suspect. The other tabs say they have to wait. */
  async firstKill(): Promise<void> {
    for (const action of ['disguise', 'shift', 'collapse'] as const) {
      expect(await this.available(action)).toBe(false)
      expect(await this.explanation(action)).toBe(this.t.duel.unavailable.opening)
    }
    await this.choose('kill')
    await this.strike('kill', (await this.litOnBoard())[0])
  }

  /** Switch a pick between the cards and the city. */
  private async view(which: 'cards' | 'city'): Promise<void> {
    await this.page.getByRole('radio', { name: this.t.duel.pickView[which], exact: true }).check()
    await this.page.waitForTimeout(PACE / 2)
  }

  /**
   * Choose one of the cards offered face up: an identity, or the card to clear. Switched to the city, the
   * same cards are lit. The choice is made once on a card and once on the city, and each shows on the other.
   */
  async pick(kind: 'choose_identity' | 'exonerate_discard'): Promise<number> {
    const cards = this.page.locator('.pick')
    const ids = (
      await cards
        .locator('button.suspect-card')
        .evaluateAll((nodes) =>
          nodes.map((n) => (n.getAttribute('aria-label') ?? '').split(', ')[0]),
        )
    ).map(idOf)
    const first = ids[0]
    await this.card(cards, first).click()
    await this.view('city')
    const grid = await this.grid()
    const onCity = ids.filter((id) => grid.at.has(id))
    expect((await this.litOnBoard()).sort()).toEqual([...onCity].sort())
    if (grid.at.has(first))
      await expect(this.card(this.board, first)).toHaveAttribute('aria-pressed', 'true')
    const id = onCity.filter((other) => other !== first).pop() ?? first
    if (id !== first) await this.card(this.board, id).click()
    await this.view('cards')
    await expect(this.card(cards, id)).toHaveAttribute('aria-pressed', 'true')
    await this.page.waitForTimeout(PACE)
    await this.button(fill(this.t.duel.pick[kind], { name: nameOf(id, this.language) })).click()
    return id
  }

  async picking(): Promise<boolean> {
    return (await this.page.locator('.pick-view').count()) > 0
  }

  /** Clear a suspect: draw a card, then put one face up. The face-up pick follows as its own decision. */
  async clearSuspect(): Promise<void> {
    await this.choose('exonerate')
    await this.page.waitForTimeout(PACE)
    await this.button(this.t.duel.action.exonerate).click()
  }

  /** Close the city up: the first way offered, then a lit body in every line that has several. */
  async collapse(): Promise<void> {
    await this.choose('collapse')
    const ways = this.page.locator('.actions__ways button')
    if ((await ways.count()) > 0) {
      await ways.first().click()
      await this.page.waitForTimeout(PACE / 2)
    }
    // A later tap in a line replaces the earlier one, so tapping each lit body once fills every line.
    for (const id of await this.litOnBoard()) {
      await this.card(this.board, id).click()
      await this.page.waitForTimeout(PACE / 2)
    }
    await this.button(this.t.duel.action.collapse).click()
  }

  async stopCollapsing(): Promise<void> {
    await this.button(this.t.duel.action.stop_collapsing).click()
  }
}
