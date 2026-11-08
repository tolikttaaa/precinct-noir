import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PACE, Phone } from './phone'
import { Recorder, writeTimeline } from './recorder'
import { showTaps } from './taps'
import { TEXTS, type Language } from './texts'

/** Where the recordings go: a folder of frames per screen, timeline.json, and session.mp4 from stitch.mjs. */
export const VIDEO_DIR = join(__dirname, '..', 'videos')

const TV = { width: 1920, height: 1080 }
const PHONE = { width: 390, height: 844 }
const SCREENS = ['tv', 'phone-1', 'phone-2']

/**
 * A living room: the TV and two phones, each its own browser with its own storage. All three are recorded
 * on one clock, with every tap shown.
 */
export class Session {
  readonly errors: string[] = []
  private readonly start = Date.now()

  private constructor(
    private readonly contexts: BrowserContext[],
    private readonly recorders: Recorder[],
    readonly tv: Page,
    readonly phones: Phone[],
  ) {}

  static async open(browser: Browser, players: [string, Language][]): Promise<Session> {
    rmSync(VIDEO_DIR, { recursive: true, force: true })
    mkdirSync(VIDEO_DIR, { recursive: true })
    const screens: [Language, typeof TV, number][] = [
      ['en', TV, 1],
      ...players.map(([, language]) => [language, PHONE, 2] as [Language, typeof TV, number]),
    ]
    const contexts = await Promise.all(
      screens.map(([language, viewport, scale]) =>
        browser.newContext({
          viewport,
          deviceScaleFactor: scale,
          locale: language === 'ru' ? 'ru-RU' : 'en-US',
          hasTouch: viewport === PHONE,
        }),
      ),
    )
    await Promise.all(contexts.map((c) => c.addInitScript(showTaps)))
    const pages = await Promise.all(contexts.map((c) => c.newPage()))
    const recorders = await Promise.all(
      pages.map((page, i) =>
        Recorder.start(
          page,
          join(VIDEO_DIR, SCREENS[i]),
          i === 0 ? { width: 1280, height: 720 } : PHONE,
        ),
      ),
    )
    const phones = players.map(([name, language], i) => new Phone(pages[i + 1], name, language))
    const session = new Session(contexts, recorders, pages[0], phones)
    pages.forEach((page, i) => {
      const who = i === 0 ? 'TV' : players[i - 1][0]
      page.on('pageerror', (e) => session.errors.push(`${who}: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') session.errors.push(`${who}: ${m.text()}`)
      })
    })
    return session
  }

  /** The TV opens a room; returns its code. */
  async openRoom(): Promise<string> {
    const t = TEXTS.en
    await this.tv.goto('/')
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
    move: (phone: Phone) => Promise<void>,
    after: (moves: number) => Promise<void> = async () => {},
  ): Promise<void> {
    for (let moves = 0; moves < 200; moves++) {
      const phone = await this.nextToMove()
      if (!phone) return
      await move(phone)
      await this.tv.waitForTimeout(PACE)
      await after(moves + 1)
    }
    throw new Error('The round went on for 200 moves without ending')
  }

  private async nextToMove(): Promise<Phone | undefined> {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      if (await this.outcome.isVisible()) return undefined
      for (const phone of this.phones) if (await phone.canAct()) return phone
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
