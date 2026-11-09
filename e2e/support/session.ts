import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PACE, Player, type Device } from './player'
import { Recorder, writeTimeline } from './recorder'
import { showTaps } from './taps'
import { TEXTS, type Language } from './texts'

/** Where the recordings go: a folder of frames per screen, timeline.json, and session.mp4 from stitch.mjs. */
export const VIDEO_DIR = join(__dirname, '..', 'videos')

const TV = { width: 1920, height: 1080 }
const SCREENS = ['tv', 'player-1', 'player-2']

/** How each kind of screen is set up: its size, pixel density and whether it has touch. */
const DEVICES = {
  tv: { viewport: TV, scale: 1, touch: false },
  phone: { viewport: { width: 390, height: 844 }, scale: 2, touch: true },
  laptop: { viewport: { width: 1440, height: 900 }, scale: 1, touch: false },
} as const

/**
 * A living room: the TV and two players, each on a phone or a laptop, each its own browser with its own
 * storage. All three are recorded on one clock, with every tap and click shown.
 */
export class Session {
  readonly errors: string[] = []
  private readonly start = Date.now()

  private constructor(
    private readonly contexts: BrowserContext[],
    private readonly recorders: Recorder[],
    readonly tv: Page,
    readonly players: Player[],
  ) {}

  static async open(browser: Browser, players: [string, Language, Device][]): Promise<Session> {
    rmSync(VIDEO_DIR, { recursive: true, force: true })
    mkdirSync(VIDEO_DIR, { recursive: true })
    const screens = [
      { language: 'en', ...DEVICES.tv },
      ...players.map(([, language, device]) => ({ language, ...DEVICES[device] })),
    ]
    const contexts = await Promise.all(
      screens.map(({ language, viewport, scale, touch }) =>
        browser.newContext({
          viewport,
          deviceScaleFactor: scale,
          locale: language === 'ru' ? 'ru-RU' : 'en-US',
          hasTouch: touch,
        }),
      ),
    )
    await Promise.all(contexts.map((c) => c.addInitScript(showTaps)))
    const pages = await Promise.all(contexts.map((c) => c.newPage()))
    // Until a screen opens the game, it shows the app's dark, not a white blank page.
    await Promise.all(
      pages.map((p) => p.setContent('<body style="margin:0;background:#0b0f15"></body>')),
    )
    const recorders = await Promise.all(
      pages.map((page, i) =>
        Recorder.start(
          page,
          join(VIDEO_DIR, SCREENS[i]),
          i === 0 ? { width: 1600, height: 900 } : screens[i].viewport,
        ),
      ),
    )
    const seated = players.map(
      ([name, language, device], i) => new Player(pages[i + 1], name, language, device),
    )
    const session = new Session(contexts, recorders, pages[0], seated)
    pages.forEach((page, i) => {
      const who = i === 0 ? 'TV' : players[i - 1][0]
      page.on('pageerror', (e) => session.errors.push(`${who}: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') session.errors.push(`${who}: ${m.text()}`)
      })
    })
    return session
  }

  /**
   * The TV looks through the secret page of games, sees the others stamped "Coming later", keeps Shadow
   * Duel and opens a room; returns its code.
   */
  async openRoom(): Promise<string> {
    const t = TEXTS.en
    const duel = t.modes.killer_inspector.name
    await this.tv.goto('/')
    const game = this.tv.getByRole('button', { name: `${t.home.host.game} ${duel}` })
    await expect(game).toBeEnabled()
    await game.click()
    const secret = this.tv.getByRole('dialog', { name: t.home.cases.title })
    await expect(secret).toBeVisible()
    const spies = secret.getByRole('listitem').filter({ hasText: t.modes.spy_games.name })
    await expect(spies.getByText(t.home.host.later)).toBeVisible()
    await expect(spies.getByRole('button')).toHaveCount(0)
    await expect(
      secret.getByRole('listitem').filter({ hasText: duel }).getByText(t.home.cases.chosen),
    ).toBeVisible()
    await this.tv.waitForTimeout(PACE * 2)
    await secret.getByRole('button', { name: t.home.cases.close }).first().click()
    await expect(secret).toBeHidden()
    await expect(game).toBeFocused()
    await this.tv.waitForTimeout(PACE)
    await this.tv.getByRole('button', { name: t.home.host.action }).click()
    await this.tv.waitForURL(/\/tv\/[A-Z]{4}$/)
    await this.tv.waitForTimeout(PACE * 2)
    return this.tv.url().split('/').pop() as string
  }

  /** The TV's verdict once a round ends. */
  get outcome() {
    return this.tv.locator('.outcome')
  }

  /**
   * Plays until the TV shows a verdict. Whoever has a decision moves, through [move]; [after] runs after
   * every move, with the number of moves so far.
   */
  async playRound(
    move: (player: Player) => Promise<void>,
    after: (moves: number) => Promise<void> = async () => {},
  ): Promise<void> {
    for (let moves = 0; moves < 200; moves++) {
      const player = await this.nextToMove()
      if (!player) return
      if (player.device === 'laptop') await player.expectOneScreen()
      await move(player)
      await this.tv.waitForTimeout(PACE)
      await after(moves + 1)
    }
    throw new Error('The round went on for 200 moves without ending')
  }

  private async nextToMove(): Promise<Player | undefined> {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      if (await this.outcome.isVisible()) return undefined
      for (const player of this.players) if (await player.canAct()) return player
      await this.tv.waitForTimeout(100)
    }
    throw new Error('No one had a move to make for 20 seconds')
  }

  async expectNoErrors(): Promise<void> {
    expect(this.errors, 'errors in the browser consoles').toEqual([])
  }

  /** Stops the recordings, writes their timeline and closes the browsers. */
  async close(): Promise<void> {
    // Let the last screen stay up for a moment in the recording.
    await this.tv.waitForTimeout(PACE * 3)
    const end = Date.now()
    const frames = await Promise.all(this.recorders.map((r) => r.stop()))
    writeTimeline(
      VIDEO_DIR,
      this.start,
      end,
      this.recorders.map((r, i) => ({ name: SCREENS[i], size: r.size, frames: frames[i] })),
    )
    await Promise.all(this.contexts.map((c) => c.close()))
  }
}
