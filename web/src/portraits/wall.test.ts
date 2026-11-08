import { describe, expect, it } from 'vitest'
import { ROSTER } from './roster'
import { svgProblem } from './svgCheck'
import { evidenceWallSvg, evidenceWallUri, wallSuspects } from './wall'

describe('the evidence wall', () => {
  const twelve = wallSuspects(ROSTER)

  it('picks twelve different suspects, the same ones on every device', () => {
    expect(twelve).toHaveLength(12)
    expect(new Set(twelve.map((s) => s.id)).size).toBe(12)
    expect(wallSuspects(ROSTER)).toEqual(twelve)
    expect(wallSuspects(ROSTER, 3, 5)).toHaveLength(3)
    expect(wallSuspects(ROSTER, 12, 5)).not.toEqual(twelve)
  })

  it('is valid SVG with each suspect named on their card, and never changes for the same suspects', () => {
    const svg = evidenceWallSvg(twelve)
    expect(svgProblem(svg)).toBeNull()
    twelve.forEach((s) => expect(svg).toContain(`>${s.name.toUpperCase()}<`))
    expect(svg).toContain('CLEARED')
    expect(evidenceWallSvg(twelve)).toBe(svg)
    expect(evidenceWallSvg(twelve, 8)).not.toBe(svg)
  })

  it('copes with fewer suspects than places on the wall', () => {
    const svg = evidenceWallSvg(twelve.slice(0, 2))
    expect(svgProblem(svg)).toBeNull()
    expect(svg).not.toContain('CLEARED')
  })

  it('puts in picture portraits where there are some, and draws everyone else', () => {
    const [first, second] = twelve
    const picture = 'data:image/webp;base64,UElD'
    const svg = evidenceWallSvg(twelve, undefined, new Map([[first.id, picture]]))
    expect(svgProblem(svg)).toBeNull()
    expect(svg).toContain(`<image href="${picture}"`)
    expect(svg).not.toContain(`id="w${first.id}-`)
    expect(svg).toContain(`id="w${second.id}-`)
    expect(
      decodeURIComponent(evidenceWallUri(twelve, undefined, new Map([[first.id, picture]]))),
    ).toContain(picture)
  })

  it('comes as a data URI for <img>', () => {
    expect(evidenceWallUri(twelve).startsWith('data:image/svg+xml,')).toBe(true)
  })
})
