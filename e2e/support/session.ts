import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PACE, Phone } from './phone'
import { TEXTS, type Language } from './texts'

/** Where the recordings go: tv.webm, phone-1.webm, phone-2.webm (and session.mp4 from stitch.mjs). */
export const VIDEO_DIR = join(__dirname, '..', 'videos')

const TV = { width: 1920, height: 1080 }
const PHONE = { width: 390, height: 844 }

/**
 * A living room: the TV and two phones, each its own browser with its own storage, all recorded from the
 * start so the three videos line up.
 */
export class Session {
  readonly errors: string[] = []

  private constructor(
    private readonly contexts: BrowserContext[],
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
          recordVideo: {
            dir: VIDEO_DIR,
            size: viewport === TV ? { width: 1280, height: 720 } : viewport,
          },
        }),
      ),
    )
    const pages = await Promise.all(contexts.map((c) => c.newPage()))
    const phones = players.map(([name, language], i) => new Phone(pages[i + 1], name, language))
    const session = new Session(contexts, pages[0], phones)
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

  /** Closes the browsers and keeps the recordings, named by screen. */
  async close(): Promise<void> {
    const pages = [this.tv, ...this.phones.map((p) => p.page)]
    // Let the last screen stay up for a moment in the recording.
    await this.tv.waitForTimeout(PACE * 3)
    await Promise.all(this.contexts.map((c) => c.close()))
    const names = ['tv', 'phone-1', 'phone-2']
    await Promise.all(
      pages.map(async (page, i) => {
        const video = page.video()
        if (!video) return
        await video.saveAs(join(VIDEO_DIR, `${names[i]}.webm`))
        await video.delete()
      }),
    )
  }
}
