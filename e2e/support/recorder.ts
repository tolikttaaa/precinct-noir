import type { CDPSession, Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** One picture of a screen and the moment it was painted, in milliseconds since the epoch. */
export interface Frame {
  readonly file: string
  readonly at: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/**
 * Records a page through Chrome's screencast: a picture whenever the screen changes, each stamped with the
 * time it arrived. Video files from Playwright drop the still stretches at their start and end, so they
 * can't be lined up; these frames sit on one clock shared by every screen, and stitch.mjs places them on
 * a common timeline. The screencast survives reloads, so a reloading phone stays in step.
 */
export class Recorder {
  private readonly frames: Frame[] = []

  private constructor(
    private readonly cdp: CDPSession,
    readonly dir: string,
    readonly size: Size,
  ) {}

  static async start(page: Page, dir: string, size: Size): Promise<Recorder> {
    mkdirSync(dir, { recursive: true })
    const cdp = await page.context().newCDPSession(page)
    const recorder = new Recorder(cdp, dir, size)
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      const file = join(dir, `${String(recorder.frames.length).padStart(5, '0')}.jpg`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      recorder.frames.push({ file, at: Date.now() })
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 80,
      maxWidth: size.width,
      maxHeight: size.height,
    })
    return recorder
  }

  async stop(): Promise<readonly Frame[]> {
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    return this.frames
  }
}

/** Everything stitch.mjs needs: the shared start and end, and each screen's frames. */
export function writeTimeline(
  dir: string,
  start: number,
  end: number,
  screens: { name: string; size: Size; frames: readonly Frame[] }[],
): void {
  writeFileSync(join(dir, 'timeline.json'), JSON.stringify({ start, end, screens }, null, 1))
}
