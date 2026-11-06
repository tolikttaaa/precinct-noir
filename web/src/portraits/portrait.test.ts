import { describe, expect, it } from 'vitest'
import { svgProblem } from './svgCheck'
import {
  ARCHETYPES,
  BROWS,
  BUILDS,
  EXTRAS,
  FACIALS,
  HAIRS,
  HATS,
  kitFor,
  MOUTHS,
  OUTFITS,
  portraitSvg,
  portraitUri,
  renderPortrait,
  TONES,
  type Kit,
  type Suspect,
} from './portrait'
import { ROSTER } from './roster'

const ann: Suspect = {
  id: 3,
  name: 'Ann',
  gender: 'f',
  age: 'adult',
  archetype: 'nobody_in_particular',
}
const bob: Suspect = {
  id: 8,
  name: 'Bob',
  gender: 'm',
  age: 'older',
  archetype: 'nobody_in_particular',
}

describe('the parser check', () => {
  it('catches markup a browser would refuse to draw', () => {
    expect(
      svgProblem('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" d="M1 1"/></svg>'),
    ).not.toBeNull()
    expect(svgProblem('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')).toBeNull()
  })
})

describe('portraits', () => {
  it('give every suspect on the roster their own look', () => {
    for (const s of ROSTER) expect(ARCHETYPES, s.archetype).toContain(s.archetype)
    expect(new Set(ROSTER.map((s) => s.id)).size).toBe(60)
  })

  it('draw every roster suspect as valid SVG, the same way every time', () => {
    const drawn = ROSTER.map((s) => portraitSvg(s))
    drawn.forEach((svg, i) => expect(svgProblem(svg), ROSTER[i].name).toBeNull())
    expect(ROSTER.map((s) => portraitSvg(s))).toEqual(drawn)
    expect(new Set(drawn).size).toBe(ROSTER.length)
  })

  it('keep their ids under the given prefix, so several can share one page', () => {
    const svg = portraitSvg(ROSTER[0], 'card7')
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(0)
    ids.forEach((id) => expect(id.startsWith('card7-')).toBe(true))
    expect(portraitSvg(ROSTER[0], 'x', 'x="4" y="4" width="20" height="25"')).toMatch(
      /^<svg x="4" y="4" width="20" height="25" viewBox/,
    )
  })

  it('fall back to plain clothes for a job without a look of its own', () => {
    expect(kitFor(ann)).toEqual({ hair: 'bob', outfit: 'blouse' })
    expect(kitFor(bob)).toEqual({ hair: 'side_part', outfit: 'suit' })
    expect(svgProblem(portraitSvg(ann))).toBeNull()
  })

  it('come as a data URI for <img>', () => {
    const uri = portraitUri(ROSTER[5])
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))).toBe(portraitSvg(ROSTER[5]))
  })

  // Every part, on both sides of the light (odd and even ids flip it), in every hair tone.
  const sides = [ann, { ...ann, id: 4 }, bob, { ...bob, id: 9, age: 'young' as const }]
  const check = (kit: Kit, label: string) =>
    sides.forEach((s) =>
      expect(svgProblem(renderPortrait(s, kit)), `${label} on ${s.name} #${s.id}`).toBeNull(),
    )

  it('draw every hat, with and without hair under it', () => {
    for (const hat of HATS)
      for (const hair of ['crop', 'balding', 'bob'] as const)
        check({ hat, hair, outfit: 'suit' }, hat)
  })

  it('draw every hairstyle in every tone', () => {
    for (const hair of HAIRS)
      for (const tone of TONES) check({ hair, tone, outfit: 'suit' }, `${hair}/${tone}`)
  })

  it('draw every outfit, build and expression', () => {
    for (const outfit of OUTFITS) check({ hair: 'crop', outfit }, outfit)
    for (const build of BUILDS)
      for (const brow of BROWS)
        for (const mouth of MOUTHS)
          check({ hair: 'crop', outfit: 'suit', build, brow, mouth }, `${build}/${brow}/${mouth}`)
  })

  it('draw every kind of facial hair in every tone', () => {
    for (const facial of FACIALS)
      for (const tone of TONES)
        check({ hair: 'crop', tone, outfit: 'suit', facial }, `${facial}/${tone}`)
  })

  it('draw every prop', () => {
    for (const extra of EXTRAS) check({ hair: 'crop', outfit: 'suit', extras: [extra] }, extra)
  })
})
