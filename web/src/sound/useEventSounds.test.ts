import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventView } from '../protocol/generated'
import { play } from './sound'
import { useEventSounds, type Cues } from './useEventSounds'

vi.mock('./sound', () => ({ play: vi.fn() }))

const ev = (seq: number, event: string): EventView => ({ seq, event })
const cues: Cues = (event) =>
  event === 'shot'
    ? [['shot', 0]]
    : event === 'win'
      ? [
          ['stamp', 0],
          ['caseClosed', 0.25],
        ]
      : []

interface Props {
  events: EventView[]
  replayedTo: number
  cues?: Cues
  enabled: boolean
}

function setup(props: Props) {
  return renderHook((p: Props) => useEventSounds(p.events, p.replayedTo, p.cues, p.enabled), {
    initialProps: props,
  })
}

afterEach(() => {
  vi.mocked(play).mockClear()
})

describe('useEventSounds', () => {
  it('plays new events in turn, but not what was there when the screen opened', () => {
    const before = [ev(1, 'shot')]
    const { rerender } = setup({ events: before, replayedTo: 0, cues, enabled: true })
    expect(play).not.toHaveBeenCalled()
    rerender({
      events: [...before, ev(2, 'shot'), ev(3, 'quiet'), ev(4, 'win')],
      replayedTo: 0,
      cues,
      enabled: true,
    })
    expect(vi.mocked(play).mock.calls).toEqual([
      ['shot', 0],
      ['stamp', 0.4], // after the shot and a pause; the quiet event takes no time
      ['caseClosed', 0.65],
    ])
  })

  it('stays silent for events caught up on when reconnecting', () => {
    const { rerender } = setup({ events: [], replayedTo: 0, cues, enabled: true })
    rerender({ events: [ev(1, 'shot'), ev(2, 'shot')], replayedTo: 2, cues, enabled: true })
    expect(play).not.toHaveBeenCalled()
    rerender({
      events: [ev(1, 'shot'), ev(2, 'shot'), ev(3, 'shot')],
      replayedTo: 2,
      cues,
      enabled: true,
    })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('stays silent when switched off or without sounds for the game, and doesn’t catch up later', () => {
    const { rerender } = setup({ events: [], replayedTo: 0, cues, enabled: false })
    rerender({ events: [ev(1, 'shot')], replayedTo: 0, cues, enabled: false })
    rerender({ events: [ev(1, 'shot'), ev(2, 'shot')], replayedTo: 0, enabled: true })
    rerender({ events: [ev(1, 'shot'), ev(2, 'shot')], replayedTo: 0, cues, enabled: true })
    expect(play).not.toHaveBeenCalled()
  })
})
