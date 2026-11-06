/**
 * The evidence wall behind the game: a charcoal corkboard in a dark office, lit through venetian blinds,
 * with a district map, suspect index cards (our own portraits), newspaper clippings, a fingerprint card,
 * polaroids and red string. Deterministic: the same suspects always give the same wall.
 */
import { portraitSvg, type Suspect } from './portrait.ts'

const INK = '#141414'
const CARD = '#e7e4dc'
const MAP = '#d6d2c8'
const RED = '#a8262b'
const SERIF = "Georgia, 'Times New Roman', serif"
const TYPED = "'Courier New', Courier, monospace"

const r1 = (v: number) => Math.round(v * 10) / 10

function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const at = (x: number, y: number, rot: number, inner: string) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})">${inner}</g>`
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fill}"${extra}/>`
const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
  extra = '',
) =>
  `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${width}"${extra}/>`
const text = (
  x: number,
  y: number,
  size: number,
  family: string,
  content: string,
  extra = '',
  color = INK,
) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" font-family="${family}" fill="${color}"${extra}>${content}</text>`

/** A pushpin seen from the front, with its shadow. */
function pin(x: number, y: number, color: string): string {
  return (
    `<circle cx="${r1(x + 3)}" cy="${r1(y + 4)}" r="7" fill="#000" opacity="0.35"/>` +
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="7" fill="${color}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="${r1(x - 2.2)}" cy="${r1(y - 2.4)}" r="2.2" fill="#fff" opacity="0.55"/>`
  )
}

/** A strip of clear tape. */
const tape = (x: number, y: number, rot: number, w = 54) =>
  at(x, y, rot, rect(-w / 2, -9, w, 18, '#f3f0e6', ' opacity="0.42"'))

/** Paper with a soft drop shadow. */
const sheet = (w: number, h: number, color: string) =>
  rect(6, 8, w, h, '#000', ' opacity="0.45" filter="url(#wall-soft)"') +
  rect(0, 0, w, h, color, ' filter="url(#wall-paper)"')

/** A suspect's index card: the photo, a typed name, and the file number on a manila tab. */
function suspectCard(s: Suspect, mark: 'none' | 'cleared' | 'dead'): string {
  const w = 168
  const h = 238
  const photo =
    rect(13, 13, 142, 178, '#000', ' opacity="0.25"') +
    portraitSvg(
      s,
      `w${s.id}`,
      `x="12" y="12" width="142" height="178" preserveAspectRatio="xMidYMid slice"`,
    )
  const number = String(s.id + 101).padStart(4, '0')
  let stamp = ''
  if (mark === 'cleared')
    stamp = at(
      84,
      120,
      -14,
      rect(-62, -18, 124, 36, 'none', ` stroke="#2e5e8e" stroke-width="4" opacity="0.85"`) +
        text(
          0,
          9,
          24,
          TYPED,
          'CLEARED',
          ` text-anchor="middle" font-weight="bold" opacity="0.85"`,
          '#2e5e8e',
        ),
    )
  if (mark === 'dead')
    stamp =
      line(18, 30, 150, 186, RED, 7, ' stroke-linecap="round" opacity="0.85"') +
      line(150, 30, 18, 186, RED, 7, ' stroke-linecap="round" opacity="0.85"')
  return (
    sheet(w, h, CARD) +
    photo +
    rect(12, 12, 142, 178, 'none', ` stroke="${INK}" stroke-width="1.5"`) +
    line(12, 214, 154, 214, INK, 0.8, ' opacity="0.4"') +
    text(14, 210, 19, TYPED, s.name.toUpperCase(), ' font-weight="bold" letter-spacing="1"') +
    rect(110, 218, 46, 16, '#cdb889') +
    text(133, 230, 11, TYPED, `№${number}`, ' text-anchor="middle"') +
    stamp
  )
}

/** A made-up district: streets on a slanted grid, an avenue, a river and two parks, with red marker circles. */
function districtMap(rand: () => number): string {
  const w = 760
  const h = 520
  const parts: string[] = [sheet(w, h, MAP)]
  parts.push(
    `<clipPath id="wall-map"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#wall-map)">`,
  )
  for (let i = -6; i < 30; i++)
    parts.push(line(i * 34, -40, i * 34 - 120, h + 40, '#8f8b82', i % 5 === 0 ? 4 : 1.4))
  for (let j = -2; j < 22; j++)
    parts.push(line(-40, j * 30, w + 40, j * 30 - 90, '#8f8b82', j % 6 === 0 ? 4 : 1.4))
  for (let k = 0; k < 26; k++)
    parts.push(
      rect(
        40 + rand() * (w - 120),
        30 + rand() * (h - 100),
        18 + rand() * 30,
        12 + rand() * 20,
        '#b9b5ab',
        ' opacity="0.7"',
      ),
    )
  parts.push(
    `<path d="M-20 ${r1(h * 0.62)} C${r1(w * 0.2)} ${r1(h * 0.5)}, ${r1(w * 0.35)} ${r1(h * 0.86)}, ${r1(w * 0.58)} ${r1(h * 0.72)} S${r1(w * 0.9)} ${r1(h * 0.44)}, ${w + 20} ${r1(h * 0.52)}" fill="none" stroke="#6f6c65" stroke-width="56"/>`,
    ...Array.from({ length: 14 }, (_, i) => {
      const x = 30 + i * 52
      const y = h * 0.62 + Math.sin(i * 0.9) * 26 + (i > 8 ? -40 : 0)
      return `<path d="M${r1(x)} ${r1(y)} q6 -4 12 0 q6 4 12 0" fill="none" stroke="#a9a59c" stroke-width="1.4"/>`
    }),
    rect(
      300,
      h * 0.62 - 6,
      60,
      70,
      '#cfcabf',
      ` stroke="${INK}" stroke-width="1.2" transform="rotate(-14 330 ${r1(h * 0.62 + 30)})"`,
    ),
  )
  for (const [px, py, pw, ph] of [
    [110, 70, 120, 80],
    [520, 300, 90, 110],
  ])
    parts.push(
      rect(px, py, pw, ph, '#c2bdb2'),
      `<g opacity="0.55">${Array.from({ length: 10 }, (_, i) => line(px + i * 12, py, px + i * 12 - 20, py + ph, '#7d796f', 1)).join('')}</g>`,
    )
  parts.push('</g>')
  parts.push(
    rect(0, 0, w, 34, '#cbc6ba'),
    text(16, 23, 15, TYPED, 'DISTRICT 9 · SHEET 4', ' letter-spacing="3"'),
    line(0, 34, w, 34, INK, 1, ' opacity="0.5"'),
  )
  parts.push(
    `<ellipse cx="236" cy="252" rx="42" ry="30" fill="none" stroke="${RED}" stroke-width="4" opacity="0.85" transform="rotate(-8 236 252)"/>`,
    `<ellipse cx="560" cy="160" rx="34" ry="26" fill="none" stroke="${RED}" stroke-width="4" opacity="0.85"/>`,
    line(452, 380, 480, 408, RED, 5, ' opacity="0.85"') +
      line(480, 380, 452, 408, RED, 5, ' opacity="0.85"'),
  )
  return parts.join('')
}

/** A newspaper clipping: masthead, headline and grey columns of body text. */
function clipping(headline: string[], w: number, h: number): string {
  const body: string[] = []
  const cols = 2
  const colW = (w - 36) / cols
  const top = 30 + headline.length * 30 + 12
  for (let c = 0; c < cols; c++)
    for (let y = top; y < h - 16; y += 9)
      body.push(rect(14 + c * (colW + 8), y, colW - (y % 5 === 0 ? 18 : 0), 3.4, '#8d8a83'))
  return (
    sheet(w, h, '#dedad0') +
    text(14, 22, 13, SERIF, 'THE EVENING LEDGER', ' font-style="italic" letter-spacing="1"') +
    line(14, 28, w - 14, 28, INK, 1.2) +
    headline.map((l, i) => text(14, 56 + i * 30, 26, SERIF, l, ' font-weight="bold"')).join('') +
    body.join('')
  )
}

/** A polaroid: a night street under one lamp, or a parked sedan. */
function polaroid(scene: 'lamp' | 'sedan'): string {
  const inside =
    scene === 'lamp'
      ? rect(14, 14, 152, 150, '#232323') +
        `<path d="M70 164 L90 40 L96 40 L80 164Z" fill="#3a3a3a"/>` +
        `<path d="M93 44 L40 164 L150 164Z" fill="#cfcbc1" opacity="0.35"/>` +
        `<circle cx="93" cy="44" r="7" fill="#f1eee6"/>` +
        rect(120, 104, 28, 60, '#0e0e0e') +
        `<circle cx="134" cy="98" r="9" fill="#0e0e0e"/>`
      : rect(14, 14, 152, 150, '#2b2b2b') +
        rect(14, 120, 152, 44, '#1a1a1a') +
        `<path d="M28 132 Q34 104 64 100 L118 100 Q142 104 152 132Z" fill="#0c0c0c"/>` +
        `<circle cx="52" cy="134" r="11" fill="#0c0c0c" stroke="#555" stroke-width="2"/><circle cx="130" cy="134" r="11" fill="#0c0c0c" stroke="#555" stroke-width="2"/>` +
        rect(142, 116, 10, 6, '#e8e4da')
  return sheet(180, 214, '#ece9e2') + inside
}

/** Ten-print card fragment: two whorls and typed labels. */
function fingerprints(): string {
  const whorl = (cx: number, cy: number) =>
    Array.from(
      { length: 9 },
      (_, i) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${4 + i * 3.2}" ry="${6 + i * 4}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="${9 + i} 2.5" opacity="0.8"/>`,
    ).join('')
  return (
    sheet(220, 140, '#e9e6de') +
    rect(14, 14, 86, 100, 'none', ` stroke="${INK}" stroke-width="1"`) +
    rect(120, 14, 86, 100, 'none', ` stroke="${INK}" stroke-width="1"`) +
    whorl(57, 62) +
    whorl(163, 64) +
    text(18, 130, 12, TYPED, 'R. THUMB') +
    text(124, 130, 12, TYPED, 'R. INDEX')
  )
}

export interface WallSlot {
  x: number
  y: number
  rot: number
}

/** Where the suspect cards hang: around the edges, so the middle stays calm behind the screen's content. */
const SLOTS: WallSlot[] = [
  { x: 40, y: 30, rot: -6 },
  { x: 230, y: 70, rot: 4 },
  { x: 1180, y: 26, rot: 5 },
  { x: 1385, y: 64, rot: -4 },
  { x: 24, y: 330, rot: 3 },
  { x: 1410, y: 352, rot: 6 },
  { x: 60, y: 640, rot: -3 },
  { x: 250, y: 700, rot: 7 },
  { x: 1190, y: 690, rot: -6 },
  { x: 1392, y: 650, rot: 3 },
  { x: 620, y: 760, rot: -2 },
  { x: 860, y: 744, rot: 4 },
]

/**
 * The wall as one SVG document (1600×1000, cropped to fill any screen). [suspects] are drawn in slot order;
 * pass a shuffled roster for variety, or a fixed list for a stable look.
 */
export function evidenceWallSvg(suspects: readonly Suspect[], seed = 7): string {
  const rand = seeded(seed)
  const W = 1600
  const H = 1000
  const cards = SLOTS.slice(0, suspects.length).map((slot, i) => {
    const mark = i === 3 || i === 9 ? 'dead' : i === 6 ? 'cleared' : 'none'
    const fixing =
      i % 3 === 0
        ? tape(84, 2, -8) + tape(84, 236, 6, 44)
        : pin(84, 12, i % 2 === 0 ? RED : '#b8945a')
    return { slot, svg: at(slot.x, slot.y, slot.rot, suspectCard(suspects[i], mark) + fixing) }
  })
  const centre = (i: number) => {
    const { x, y } = SLOTS[i]
    return [x + 84, y + 12]
  }
  const strings = [
    [centre(1), [602, 380]],
    [[602, 380], centre(4)],
    [[928, 300], centre(2)],
    [[928, 300], centre(5)],
    [[796, 520], centre(10)],
    [centre(7), [796, 520]],
  ]
    .map(([[x1, y1], [x2, y2]]) => line(x1, y1, x2, y2, RED, 2.6, ' opacity="0.9"'))
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>` +
    `<filter id="wall-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>` +
    `<filter id="wall-paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.62" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="speck"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="speck"/></feMerge></filter>` +
    `<filter id="wall-cork"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.15  0 0 0 0 0.14  0 0 0 -1.6 1.1"/></filter>` +
    `<radialGradient id="wall-vignette" cx="0.5" cy="0.46" r="0.72"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.88"/></radialGradient>` +
    `</defs>` +
    rect(0, 0, W, H, '#1c1d20') +
    rect(0, 0, W, H, '#000', ' filter="url(#wall-cork)" opacity="0.9"') +
    at(
      420,
      150,
      -2.5,
      districtMap(rand) + pin(380, 48, '#b8945a') + pin(16, 60, RED) + pin(740, 500, RED),
    ) +
    at(
      520,
      34,
      3,
      clipping(['WITNESS SAW', 'NOTHING, SAYS', 'NIGHT WATCHMAN'], 300, 250) + tape(150, 4, -3, 70),
    ) +
    at(
      1000,
      560,
      -5,
      clipping(['SECOND BODY', 'FOUND AT PIER 6'], 330, 200) + tape(40, 30, -40, 60),
    ) +
    at(1000, 120, 6, polaroid('lamp') + pin(90, 10, RED)) +
    at(430, 610, -7, polaroid('sedan') + tape(90, 4, 4, 60)) +
    at(1180, 430, 4, fingerprints() + tape(110, 2, -2, 64)) +
    cards.map((c) => c.svg).join('') +
    strings +
    rect(0, 0, W, H, '#07080a', ' opacity="0.3"') +
    // Light through the blinds: long diagonal bands, the room's one light source.
    `<g opacity="0.11">${Array.from({ length: 9 }, (_, i) => `<path d="M${-200 + i * 230} -40 L${120 + i * 230} -40 L${-260 + i * 230} ${H + 40} L${-580 + i * 230} ${H + 40}Z" fill="#f4f1e8"/>`).join('')}</g>` +
    rect(0, 0, W, H, 'url(#wall-vignette)') +
    `</svg>`
  )
}

/** A data URI for `<img src>`: the browser rasterises the wall once instead of laying out its parts. */
export function evidenceWallUri(suspects: readonly Suspect[], seed?: number): string {
  return `data:image/svg+xml,${encodeURIComponent(evidenceWallSvg(suspects, seed))}`
}

/** A stable pick of [count] suspects for the wall, the same on every device. */
export function wallSuspects(
  roster: readonly Suspect[],
  count = SLOTS.length,
  seed = 1949,
): Suspect[] {
  const rand = seeded(seed)
  const pool = [...roster]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
