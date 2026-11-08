/**
 * Suspect portraits: original black-and-white "bold ink" busts, drawn as SVG from the roster.
 *
 * Deterministic: the same suspect always gets the same picture (board cards, the evidence wall, reviews).
 * Each portrait is lit hard from one side, so half the face falls into solid ink; the job (archetype) picks
 * the hat, hair, clothes and props, and the id varies the face. No randomness outside the seeded generator.
 */

export type Gender = 'f' | 'm'
export type Age = 'young' | 'adult' | 'older'

export interface Suspect {
  id: number
  name: string
  gender: Gender
  age: Age
  archetype: string
}

// Ink line and grey wash on cream paper, like a graphic novel's pencil-and-ink studies.
const INK = '#1b1815'
const PAPER = '#f7f2e6'
const GREY = '#b9b2a6'
/** What big dark shapes (hair, hats, coats) become inside their ink edge. */
const WASH = '#5d564e'
/** Soft shading on skin and light cloth. */
const SHADE = '#6d655b'

export const TONES = ['dark', 'light', 'grey'] as const
export type Tone = (typeof TONES)[number]
export const BROWS = ['stern', 'raised', 'level'] as const
export type Brow = (typeof BROWS)[number]
export const MOUTHS = ['flat', 'smirk', 'smile', 'frown'] as const
export type Mouth = (typeof MOUTHS)[number]
export const BUILDS = ['slim', 'broad'] as const
export type Build = (typeof BUILDS)[number]

export const HATS = [
  'fedora',
  'fedora_low',
  'fedora_band',
  'fedora_tilt',
  'flat_cap',
  'newsboy',
  'peaked',
  'peaked_badge',
  'peaked_braid',
  'peaked_white',
  'pillbox',
  'pillbox_strap',
  'toque',
  'nurse_cap',
  'beret',
  'top_hat',
  'bowler',
  'homburg',
  'boater',
  'aviator',
  'preacher',
  'wide_feather',
  'veil',
  'headscarf',
  'turban',
  'knit_cap',
  'paper_cap',
  'eyeshade',
  'surgical_cap',
  'headset',
  'feather_band',
] as const
export type Hat = (typeof HATS)[number]

export const HAIRS = [
  'none',
  'slick',
  'side_part',
  'pompadour',
  'crop',
  'messy',
  'balding',
  'wild',
  'bob',
  'waves',
  'long',
  'peekaboo',
  'bun',
  'chignon',
  'rolls',
  'curls',
  'ponytail',
] as const
export type Hair = (typeof HAIRS)[number]

export const OUTFITS = [
  'suit',
  'suit_dark',
  'suit_bow',
  'tailcoat',
  'uniform',
  'epaulettes',
  'turtleneck',
  'peacoat',
  'vest',
  'gown',
  'dress',
  'blouse',
  'blouse_bow',
  'cardigan',
  'white_jacket',
  'coveralls',
  'chef',
  'clerical',
  'fur',
  'towel',
  'shawl',
  'leather',
  'apron',
] as const
export type Outfit = (typeof OUTFITS)[number]

export const FACIALS = [
  'pencil',
  'handlebar',
  'walrus',
  'goatee',
  'beard',
  'stubble',
  'chops',
] as const
export type Facial = (typeof FACIALS)[number]

export const EXTRAS = [
  'glasses_round',
  'glasses_horn',
  'glasses_half',
  'glasses_cat',
  'monocle',
  'loupe',
  'cigarette',
  'cigar',
  'pipe',
  'toothpick',
  'holder',
  'earrings_drop',
  'earrings_hoop',
  'pearls',
  'long_pearls',
  'beads',
  'scar',
  'beauty_mark',
  'pencil_ear',
  'flower_hair',
  'flower_lapel',
  'tape_measure',
  'strap_pair',
  'mask_down',
  'goggles',
  'scarf',
  'press_card',
  'keys',
  'bandage_nose',
  'freckles',
  'stethoscope',
  'bow_hair',
  'satchel',
  'camera',
  'comb',
  'name_tag',
  'cloth_shoulder',
  'rosette',
  'watch_chain',
  'smudge',
  'bow_tie',
  'neckerchief',
] as const
export type Extra = (typeof EXTRAS)[number]

/** Everything that makes one suspect look like themselves, apart from the face's proportions. */
export interface Kit {
  hat?: Hat
  hair: Hair
  tone?: Tone
  outfit: Outfit
  facial?: Facial
  extras?: Extra[]
  brow?: Brow
  mouth?: Mouth
  build?: Build
}

/** One look per job. Every roster archetype has an entry; unknown ones fall back to a plain suit or blouse. */
const KITS: Record<string, Kit> = {
  switchboard_operator: {
    hat: 'headset',
    hair: 'waves',
    outfit: 'blouse',
    extras: ['earrings_drop'],
    mouth: 'smile',
  },
  bookie: {
    hat: 'fedora',
    hair: 'balding',
    tone: 'grey',
    outfit: 'suit',
    facial: 'walrus',
    extras: ['cigar'],
    build: 'broad',
  },
  heiress: {
    hair: 'bob',
    tone: 'light',
    outfit: 'fur',
    extras: ['pearls', 'earrings_drop'],
    brow: 'raised',
    mouth: 'smirk',
  },
  enforcer: {
    hat: 'fedora_low',
    hair: 'crop',
    outfit: 'suit_dark',
    extras: ['scar'],
    brow: 'stern',
    mouth: 'frown',
    build: 'broad',
  },
  nightclub_singer: {
    hair: 'long',
    outfit: 'gown',
    extras: ['flower_hair', 'earrings_drop'],
    mouth: 'smirk',
  },
  bellhop: {
    hat: 'pillbox_strap',
    hair: 'crop',
    outfit: 'uniform',
    extras: ['freckles'],
    mouth: 'smile',
    build: 'slim',
  },
  typist: { hair: 'bun', outfit: 'blouse_bow', extras: ['glasses_cat', 'pencil_ear'] },
  boxer: {
    hair: 'crop',
    outfit: 'towel',
    extras: ['bandage_nose'],
    brow: 'stern',
    mouth: 'flat',
    build: 'broad',
  },
  landlady: {
    hat: 'headscarf',
    hair: 'curls',
    tone: 'grey',
    outfit: 'cardigan',
    extras: ['glasses_half'],
    mouth: 'frown',
  },
  mailman: {
    hat: 'peaked',
    hair: 'side_part',
    tone: 'grey',
    outfit: 'uniform',
    facial: 'walrus',
    extras: ['satchel'],
  },
  reporter: {
    hat: 'fedora_tilt',
    hair: 'waves',
    outfit: 'suit',
    extras: ['press_card', 'pencil_ear'],
    mouth: 'smirk',
  },
  bootlegger: {
    hat: 'flat_cap',
    hair: 'crop',
    outfit: 'vest',
    facial: 'stubble',
    extras: ['toothpick'],
    mouth: 'smirk',
  },
  film_starlet: {
    hair: 'long',
    tone: 'light',
    outfit: 'fur',
    extras: ['beauty_mark', 'earrings_drop'],
    brow: 'raised',
  },
  dockworker: {
    hat: 'knit_cap',
    hair: 'crop',
    outfit: 'peacoat',
    facial: 'beard',
    brow: 'stern',
    build: 'broad',
  },
  nurse: {
    hat: 'nurse_cap',
    hair: 'rolls',
    outfit: 'white_jacket',
    extras: ['stethoscope'],
    mouth: 'smile',
  },
  night_watchman: {
    hat: 'peaked_badge',
    hair: 'crop',
    tone: 'grey',
    outfit: 'peacoat',
    facial: 'walrus',
    brow: 'stern',
  },
  fortune_teller: {
    hat: 'turban',
    hair: 'curls',
    tone: 'grey',
    outfit: 'shawl',
    extras: ['earrings_hoop', 'beads'],
    brow: 'raised',
    mouth: 'smirk',
  },
  shoeshine: {
    hat: 'newsboy',
    hair: 'crop',
    outfit: 'vest',
    extras: ['cloth_shoulder', 'freckles'],
    mouth: 'smile',
    build: 'slim',
  },
  jazz_pianist: {
    hair: 'curls',
    outfit: 'dress',
    extras: ['long_pearls', 'holder'],
    mouth: 'smirk',
  },
  butler: {
    hair: 'balding',
    tone: 'grey',
    outfit: 'tailcoat',
    facial: 'chops',
    brow: 'raised',
    mouth: 'flat',
  },
  cigarette_girl: {
    hat: 'pillbox',
    hair: 'curls',
    outfit: 'dress',
    extras: ['strap_pair', 'beauty_mark'],
    mouth: 'smile',
  },
  trumpet_player: { hair: 'pompadour', outfit: 'suit_bow', facial: 'pencil', mouth: 'smirk' },
  diner_waitress: {
    hat: 'paper_cap',
    hair: 'ponytail',
    outfit: 'blouse',
    extras: ['name_tag', 'pencil_ear'],
    mouth: 'smile',
  },
  newsboy: {
    hat: 'newsboy',
    hair: 'messy',
    outfit: 'vest',
    extras: ['satchel', 'freckles'],
    mouth: 'smile',
    build: 'slim',
  },
  private_secretary: {
    hair: 'rolls',
    outfit: 'suit',
    extras: ['glasses_horn', 'earrings_drop'],
    brow: 'level',
  },
  chef: {
    hat: 'toque',
    hair: 'crop',
    outfit: 'chef',
    facial: 'handlebar',
    extras: ['neckerchief'],
    mouth: 'smile',
    build: 'broad',
  },
  pawnbroker: {
    hair: 'bun',
    tone: 'grey',
    outfit: 'shawl',
    extras: ['loupe', 'earrings_hoop'],
    brow: 'raised',
  },
  locksmith: {
    hat: 'flat_cap',
    hair: 'crop',
    tone: 'grey',
    outfit: 'apron',
    facial: 'beard',
    extras: ['glasses_round', 'keys'],
  },
  socialite: {
    hat: 'wide_feather',
    hair: 'waves',
    outfit: 'fur',
    extras: ['holder', 'pearls'],
    brow: 'raised',
    mouth: 'smirk',
  },
  accountant: {
    hat: 'eyeshade',
    hair: 'side_part',
    outfit: 'vest',
    extras: ['glasses_round'],
    brow: 'raised',
    build: 'slim',
  },
  lawyer: {
    hair: 'chignon',
    outfit: 'suit',
    extras: ['glasses_horn'],
    brow: 'stern',
    mouth: 'flat',
  },
  banker: {
    hat: 'homburg',
    hair: 'balding',
    tone: 'grey',
    outfit: 'suit',
    facial: 'chops',
    extras: ['monocle', 'watch_chain'],
    build: 'broad',
  },
  photographer: {
    hat: 'beret',
    hair: 'bob',
    outfit: 'turtleneck',
    extras: ['camera'],
    mouth: 'smirk',
  },
  gangster: {
    hat: 'fedora_band',
    hair: 'slick',
    outfit: 'suit_dark',
    extras: ['flower_lapel', 'cigarette'],
    brow: 'stern',
    mouth: 'smirk',
  },
  widow: {
    hat: 'veil',
    hair: 'chignon',
    tone: 'grey',
    outfit: 'dress',
    extras: ['pearls'],
    mouth: 'frown',
  },
  barber: {
    hair: 'slick',
    tone: 'grey',
    outfit: 'white_jacket',
    facial: 'handlebar',
    extras: ['comb', 'bow_tie'],
    mouth: 'smile',
  },
  librarian: {
    hair: 'bun',
    outfit: 'cardigan',
    extras: ['glasses_cat', 'pencil_ear'],
    brow: 'raised',
    mouth: 'flat',
  },
  professor: {
    hair: 'wild',
    tone: 'grey',
    outfit: 'suit_bow',
    facial: 'goatee',
    extras: ['glasses_round', 'pipe'],
    brow: 'raised',
  },
  femme_fatale: {
    hair: 'peekaboo',
    outfit: 'gown',
    extras: ['earrings_drop', 'cigarette'],
    brow: 'raised',
    mouth: 'smirk',
  },
  loan_shark: {
    hat: 'fedora',
    hair: 'slick',
    outfit: 'suit',
    facial: 'pencil',
    extras: ['toothpick'],
    brow: 'stern',
    mouth: 'smirk',
  },
  schoolteacher: {
    hair: 'bun',
    tone: 'grey',
    outfit: 'blouse_bow',
    extras: ['glasses_half'],
    brow: 'stern',
    mouth: 'flat',
  },
  doorman: {
    hat: 'peaked_braid',
    hair: 'crop',
    tone: 'grey',
    outfit: 'epaulettes',
    facial: 'chops',
    build: 'broad',
  },
  florist: {
    hat: 'headscarf',
    hair: 'curls',
    tone: 'grey',
    outfit: 'apron',
    extras: ['flower_hair'],
    mouth: 'smile',
  },
  mechanic: {
    hair: 'messy',
    outfit: 'coveralls',
    extras: ['smudge', 'cloth_shoulder'],
    mouth: 'smirk',
    build: 'slim',
  },
  seamstress: { hair: 'bun', outfit: 'blouse', extras: ['tape_measure'], mouth: 'flat' },
  milkman: {
    hat: 'peaked_white',
    hair: 'side_part',
    outfit: 'white_jacket',
    extras: ['bow_tie'],
    mouth: 'smile',
  },
  telegraph_clerk: {
    hat: 'eyeshade',
    hair: 'bob',
    outfit: 'vest',
    extras: ['pencil_ear'],
    brow: 'level',
  },
  stage_magician: {
    hat: 'top_hat',
    hair: 'slick',
    outfit: 'suit_bow',
    facial: 'goatee',
    extras: ['scarf'],
    brow: 'raised',
    mouth: 'smirk',
  },
  dancer: {
    hat: 'feather_band',
    hair: 'bob',
    outfit: 'dress',
    extras: ['long_pearls'],
    mouth: 'smile',
  },
  con_artist: {
    hat: 'boater',
    hair: 'slick',
    outfit: 'suit_bow',
    facial: 'pencil',
    mouth: 'smile',
  },
  bookkeeper: {
    hair: 'bun',
    tone: 'grey',
    outfit: 'cardigan',
    extras: ['glasses_half', 'pearls'],
    brow: 'level',
  },
  preacher: {
    hat: 'preacher',
    hair: 'crop',
    tone: 'grey',
    outfit: 'clerical',
    facial: 'beard',
    brow: 'stern',
  },
  bartender: {
    hair: 'ponytail',
    outfit: 'vest',
    extras: ['bow_tie', 'cloth_shoulder'],
    mouth: 'smirk',
  },
  alderman: {
    hat: 'bowler',
    hair: 'balding',
    tone: 'grey',
    outfit: 'suit',
    facial: 'walrus',
    extras: ['rosette', 'cigar'],
    build: 'broad',
  },
  aviator: {
    hat: 'aviator',
    hair: 'none',
    outfit: 'leather',
    extras: ['goggles', 'scarf'],
    mouth: 'smirk',
  },
  surgeon: {
    hat: 'surgical_cap',
    hair: 'none',
    outfit: 'white_jacket',
    extras: ['mask_down', 'glasses_round'],
    brow: 'stern',
    mouth: 'flat',
  },
  hat_check_girl: {
    hair: 'curls',
    tone: 'light',
    outfit: 'uniform',
    extras: ['bow_hair', 'name_tag'],
    mouth: 'smile',
  },
  chauffeur: { hat: 'peaked', hair: 'crop', outfit: 'epaulettes', facial: 'pencil', mouth: 'flat' },
  cab_driver: {
    hat: 'newsboy',
    hair: 'bob',
    outfit: 'leather',
    extras: ['name_tag'],
    mouth: 'smirk',
  },
  mortician: {
    hair: 'slick',
    tone: 'grey',
    outfit: 'suit_dark',
    brow: 'raised',
    mouth: 'flat',
    build: 'slim',
  },
}

const FALLBACK: Record<Gender, Kit> = {
  f: { hair: 'bob', outfit: 'blouse' },
  m: { hair: 'side_part', outfit: 'suit' },
}

/** The look for a suspect: their job's kit, with sensible defaults. */
export function kitFor(s: Suspect): Kit {
  return KITS[s.archetype] ?? FALLBACK[s.gender]
}

/** Archetypes the generator has a dedicated look for. */
export const ARCHETYPES: readonly string[] = Object.keys(KITS)

/** Mulberry32: a small seeded generator, so faces vary per suspect but never between renders. */
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

const r1 = (v: number) => Math.round(v * 10) / 10

/** Path template: rounds every number to one decimal, keeping the markup short. */
function d(strings: TemplateStringsArray, ...values: number[]): string {
  return strings.reduce(
    (out, s, i) => out + s + (i < values.length ? String(r1(values[i])) : ''),
    '',
  )
}

interface Geo {
  /** +1: the shadow falls on the right half; -1: on the left. */
  s: 1 | -1
  seed: number
  w: number
  h: number
  jw: number
  cw: number
  cy: number
  top: number
  chinY: number
  jawY: number
  eyeY: number
  ex: number
  noseY: number
  mouthY: number
  nw: number
  sw: number
  shoulderY: number
  f: boolean
  old: boolean
  young: boolean
  tone: Tone
  /** x toward the lit side / toward the shadow side, from the centre line. */
  L: (dx: number) => number
  S: (dx: number) => number
}

function geometry(s: Suspect, kit: Kit, rand: () => number): Geo {
  const f = s.gender === 'f'
  const old = s.age === 'older'
  const young = s.age === 'young'
  const broad = kit.build === 'broad' ? 1 : 0
  const slim = kit.build === 'slim' ? 1 : 0
  const side: 1 | -1 = rand() < 0.5 ? 1 : -1
  const w = (f ? 36 : 39.5) + rand() * 3 + broad * 2 - slim * 1.5
  const h = (f ? 51 : 54) + rand() * 3 + (old ? 1 : 0) - (young ? 1 : 0)
  const jw = w * (f ? 0.6 : 0.78) + (old ? 3 : 0) + broad * 4 + rand() * 2
  const cw = f ? 4 + rand() * 2 : 8 + rand() * 4 + broad * 3
  const cy = 98
  const eyeY = cy - h * 0.02
  const chinY = cy + h
  return {
    s: side,
    seed: s.id % 97,
    w,
    h,
    jw,
    cw,
    cy,
    top: cy - h,
    chinY,
    jawY: cy + h * 0.6,
    eyeY,
    ex: w * 0.42,
    noseY: eyeY + h * 0.42,
    mouthY: eyeY + h * 0.66,
    nw: f ? 14 : 18 + broad * 4 - slim,
    sw: f ? 80 : 90 + broad * 8 - slim * 6,
    shoulderY: chinY + 15,
    f,
    old,
    young,
    tone: kit.tone ?? (old ? 'grey' : 'dark'),
    L: (dx) => 100 - side * dx,
    S: (dx) => 100 + side * dx,
  }
}

const fill = (path: string, color: string, extra = '') =>
  `<path d="${path}" fill="${color}"${extra}/>`
const ink = (path: string, width: number, color = INK, extra = '') =>
  `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
const shape = (path: string, color: string, width = 2.2) =>
  `<path d="${path}" fill="${color}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`
const dot = (x: number, y: number, r: number, color: string, extra = '') =>
  `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${color}"${extra}/>`

function headPath(g: Geo): string {
  const { w, jw, cw, top, cy, h, jawY, chinY } = g
  const half = (k: number) => ({
    c1: [100 + k * w * 0.62, top],
    c2: [100 + k * w, cy - h * 0.6],
    p1: [100 + k * w, cy + 2],
    c3: [100 + k * w, cy + (jawY - cy) * 0.55],
    c4: [100 + k * jw, jawY - 6],
    p2: [100 + k * jw, jawY],
    c5: [100 + k * jw * 0.8, jawY + (chinY - jawY) * 0.55],
    c6: [100 + k * cw, chinY],
  })
  const R = half(1)
  const Lh = half(-1)
  const pt = (p: number[]) => `${r1(p[0])} ${r1(p[1])}`
  return (
    `M100 ${r1(top)} C${pt(R.c1)} ${pt(R.c2)} ${pt(R.p1)} C${pt(R.c3)} ${pt(R.c4)} ${pt(R.p2)} ` +
    `C${pt(R.c5)} ${pt(R.c6)} 100 ${r1(chinY)} ` +
    `C${pt(Lh.c6)} ${pt(Lh.c5)} ${pt(Lh.p2)} C${pt(Lh.c4)} ${pt(Lh.c3)} ${pt(Lh.p1)} C${pt(Lh.c2)} ${pt(Lh.c1)} 100 ${r1(top)}Z`
  )
}

/** Soft grey shading that gathers toward the far cheek and jaw, under the chin, beside the nose and in the far eye socket. */
function washShadow(g: Geo, id: string): string {
  const { S, w, h, cy, ex, eyeY, noseY, chinY } = g
  const soft = (shape: string, opacity: number) =>
    `<g filter="url(#${id}-soft)" opacity="${opacity}" fill="${SHADE}">${shape}</g>`
  return (
    soft(
      `<ellipse cx="${r1(S(w * 1.02))}" cy="${r1(cy + h * 0.12)}" rx="${r1(w * 0.55)}" ry="${r1(h * 1.05)}"/>`,
      0.4,
    ) +
    soft(`<ellipse cx="100" cy="${r1(chinY + 4)}" rx="${r1(w * 0.8)}" ry="9"/>`, 0.35) +
    soft(`<ellipse cx="${r1(S(4))}" cy="${r1(noseY + 1)}" rx="4" ry="6"/>`, 0.45) +
    soft(`<ellipse cx="${r1(S(ex))}" cy="${r1(eyeY - 2)}" rx="9" ry="5"/>`, 0.3)
  )
}

function backdrop(g: Geo, id: string): string {
  const lightX = g.L(30)
  return (
    `<defs><radialGradient id="${id}-light" cx="${r1(lightX / 200)}" cy="0.35" r="0.8">` +
    `<stop offset="0" stop-color="${PAPER}"/><stop offset="0.65" stop-color="#efe7d6"/><stop offset="1" stop-color="#ddd1b8"/></radialGradient>` +
    `<clipPath id="${id}-head"><path d="${headPath(g)}"/></clipPath>` +
    `<filter id="${id}-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${g.seed}"/><feDisplacementMap in="SourceGraphic" scale="1.2"/></filter>` +
    // Line and wash: every dark shape keeps a thin ink edge, and its inside turns into a grey wash.
    `<filter id="${id}-wash" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.34 -0.33 -0.33 0 1"/>` +
    `<feComposite in2="SourceAlpha" operator="in" result="dark"/>` +
    `<feMorphology in="dark" operator="erode" radius="1.3" result="core"/>` +
    `<feFlood flood-color="${WASH}"/><feComposite in2="core" operator="in"/>` +
    `<feComposite in2="SourceGraphic" operator="over"/></filter>` +
    `<filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="${id}-grain"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${g.seed + 1}"/><feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 -1.4 0.95"/></filter></defs>` +
    `<rect width="200" height="250" fill="url(#${id}-light)"/>`
  )
}

function hairColor(g: Geo): string {
  return g.tone === 'dark' ? INK : g.tone === 'grey' ? GREY : PAPER
}

/** Strands drawn over a hair shape: white on dark hair, ink on light or grey hair. */
function strands(g: Geo, paths: string[], width = 1.3): string {
  const color = g.tone === 'dark' ? PAPER : INK
  const opacity = g.tone === 'dark' ? 0.85 : 0.75
  return paths.map((p) => ink(p, width, color, ` opacity="${opacity}"`)).join('')
}

function hairBack(g: Geo, hair: Hair): string {
  const { w, top, cy, jawY, S } = g
  const c = hairColor(g)
  switch (hair) {
    case 'bob':
    case 'waves':
      return shape(
        d`M${100 - w - 9} ${jawY + 6} C${100 - w - 14} ${cy - 30}, ${100 - w + 2} ${top - 10}, 100 ${top - 9} C${100 + w - 2} ${top - 10}, ${100 + w + 14} ${cy - 30}, ${100 + w + 9} ${jawY + 6} Q100 ${jawY + 14} ${100 - w - 9} ${jawY + 6}Z`,
        c,
      )
    case 'long':
    case 'peekaboo':
      return shape(
        d`M${100 - w - 6} ${g.shoulderY + 34} C${100 - w - 22} ${g.shoulderY}, ${100 - w - 16} ${top - 4}, 100 ${top - 8} C${100 + w + 16} ${top - 4}, ${100 + w + 22} ${g.shoulderY}, ${100 + w + 6} ${g.shoulderY + 34} Q${100 + w - 6} ${g.shoulderY + 20} ${100 + w - 10} ${g.shoulderY - 6} L${100 - w + 10} ${g.shoulderY - 6} Q${100 - w + 6} ${g.shoulderY + 20} ${100 - w - 6} ${g.shoulderY + 34}Z`,
        c,
      )
    case 'curls':
      return [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map((i) => {
          const a = Math.PI * (0.95 + (i / 8) * 1.1)
          return dot(
            100 + Math.cos(a) * (w + 4),
            cy - 6 + Math.sin(a) * (g.h * 0.9),
            11,
            c,
            ` stroke="${INK}" stroke-width="2"`,
          )
        })
        .join('')
    case 'bun':
      return dot(S(w * 0.35), top - 6, 13, c, ` stroke="${INK}" stroke-width="2.2"`)
    case 'chignon':
      return dot(S(w + 6), jawY - 4, 12, c, ` stroke="${INK}" stroke-width="2.2"`)
    case 'ponytail':
      return shape(
        d`M${S(w - 6)} ${top + 14} C${S(w + 26)} ${top + 10}, ${S(w + 22)} ${cy + 40}, ${S(w + 8)} ${jawY + 30} C${S(w + 10)} ${cy + 20}, ${S(w + 6)} ${top + 30}, ${S(w - 6)} ${top + 24}Z`,
        c,
      )
    case 'rolls':
      return shape(
        d`M${100 - w - 8} ${jawY + 10} C${100 - w - 12} ${cy}, ${100 - w} ${top}, 100 ${top - 4} C${100 + w} ${top}, ${100 + w + 12} ${cy}, ${100 + w + 8} ${jawY + 10} Q100 ${jawY + 18} ${100 - w - 8} ${jawY + 10}Z`,
        c,
      )
    default:
      return ''
  }
}

function sweep(g: Geo, c: string, depth: number): string {
  // A side part on the lit side; the hair sweeps across the forehead and falls past the far temple.
  const { w, top, cy, h, L, S, s } = g
  const line = cy - h * 0.5
  return (
    shape(
      d`M${L(w + 3)} ${cy + depth} C${L(w + 6)} ${top - 4}, ${L(w * 0.3)} ${top - 10}, ${S(w * 0.2)} ${top - 9} C${S(w + 8)} ${top - 6}, ${S(w + 8)} ${cy}, ${S(w + 3)} ${cy + depth + 6} L${S(w - 2)} ${cy + depth} C${S(w - 4)} ${line + 10}, ${S(w * 0.5)} ${line + 2}, ${S(4)} ${line - 2} C${L(4)} ${line - 5}, ${L(w * 0.42)} ${line - 9}, ${L(w * 0.55)} ${line - 11} C${L(w * 0.75)} ${line - 2}, ${L(w - 1)} ${line + 6}, ${L(w - 1)} ${cy + depth - 2}Z`,
      c,
    ) +
    strands(
      g,
      [
        d`M${L(w * 0.55)} ${line - 11} C${L(w * 0.2)} ${top - 2}, ${S(w * 0.5)} ${top}, ${S(w - 2)} ${line + 4}`,
        d`M${L(w * 0.45)} ${line - 6} C${L(w * 0.1)} ${top + 6}, ${S(w * 0.5)} ${top + 8}, ${S(w - 6)} ${line + 12}`,
        d`M${L(w * 0.62)} ${line - 9} q${-s * 6} 2 ${-s * 9} 12`,
      ],
      1.4,
    )
  )
}

function hairFront(g: Geo, hair: Hair, hatted: boolean): string {
  const { w, h, top, cy, L, S } = g
  const c = hairColor(g)
  const line = cy - h * 0.55
  switch (hair) {
    case 'slick':
      return (
        shape(
          d`M${100 - w - 1.5} ${cy - 4} C${100 - w - 4} ${top - 8}, ${100 + w + 4} ${top - 8}, ${100 + w + 1.5} ${cy - 4} L${100 + w - 2} ${cy - 6} C${100 + w - 5} ${line}, ${S(8)} ${line - 6}, 100 ${line - 3} C${L(12)} ${line - 6}, ${100 - w + 5} ${line}, ${100 - w + 2} ${cy - 6}Z`,
          c,
        ) +
        strands(g, [
          d`M${L(w - 6)} ${line - 2} C${L(w - 10)} ${top + 2}, ${L(6)} ${top - 2}, ${S(12)} ${top + 2}`,
          d`M${L(w - 12)} ${line + 2} C${L(w - 14)} ${top + 10}, ${L(2)} ${top + 6}, ${S(6)} ${top + 9}`,
        ])
      )
    case 'side_part':
      return (
        shape(
          d`M${100 - w - 1.5} ${cy - 2} C${100 - w - 4} ${top - 8}, ${100 + w + 4} ${top - 8}, ${100 + w + 1.5} ${cy - 2} L${100 + w - 2} ${cy - 6} C${100 + w - 6} ${line + 2}, ${S(4)} ${line - 2}, ${L(8)} ${line - 8} Q${L(w - 6)} ${line - 2} ${100 - w + 2} ${cy - 4}Z`,
          c,
        ) +
        ink(
          d`M${L(10)} ${line - 9} Q${L(12)} ${top + 4} ${L(16)} ${top - 2}`,
          1.6,
          g.tone === 'dark' ? PAPER : INK,
        )
      )
    case 'pompadour':
      return (
        shape(
          d`M${100 - w - 1.5} ${cy - 4} C${100 - w - 4} ${top - 10}, ${L(10)} ${top - 22}, ${S(6)} ${top - 18} C${S(w)} ${top - 14}, ${100 + w + 4} ${top}, ${100 + w + 1.5} ${cy - 4} L${100 + w - 2} ${cy - 6} C${100 + w - 6} ${line}, ${S(6)} ${line - 4}, 100 ${line - 2} C${L(12)} ${line - 4}, ${100 - w + 5} ${line}, ${100 - w + 2} ${cy - 6}Z`,
          c,
        ) +
        strands(g, [
          d`M${L(w - 8)} ${line - 4} C${L(w - 12)} ${top - 10}, ${L(4)} ${top - 18}, ${S(8)} ${top - 14}`,
          d`M${L(w - 16)} ${line} C${L(w - 16)} ${top - 4}, ${L(2)} ${top - 10}, ${S(12)} ${top - 6}`,
        ])
      )
    case 'crop':
      if (hatted)
        return (
          shape(
            d`M${100 - w - 1} ${cy - 2} L${100 - w} ${cy - 16} L${100 - w + 4} ${cy - 14} L${100 - w + 3} ${cy - 1}Z`,
            c,
            1.6,
          ) +
          shape(
            d`M${100 + w + 1} ${cy - 2} L${100 + w} ${cy - 16} L${100 + w - 4} ${cy - 14} L${100 + w - 3} ${cy - 1}Z`,
            c,
            1.6,
          )
        )
      return (
        shape(
          d`M${100 - w - 1} ${cy - 2} C${100 - w - 3} ${top - 5}, ${100 + w + 3} ${top - 5}, ${100 + w + 1} ${cy - 2} L${100 + w - 3} ${cy - 4} C${100 + w - 6} ${line + 4}, ${S(10)} ${line}, 100 ${line + 1} C${L(10)} ${line}, ${100 - w + 6} ${line + 4}, ${100 - w + 3} ${cy - 4}Z`,
          c,
        ) +
        strands(
          g,
          [0, 1, 2, 3, 4].map((i) => d`M${L(w - 8 - i * 8)} ${line - 1} l${-g.s * 1.5} -4`),
          1.1,
        )
      )
    case 'messy': {
      const spikes = [0, 1, 2, 3, 4, 5, 6]
        .map((i) => {
          const x = 100 - w - 2 + (i * (2 * w + 4)) / 6
          const tip = top - 6 - (i % 2 === 0 ? 6 : 1)
          return `L${r1(x)} ${r1(tip)} L${r1(x + (w + 2) / 6)} ${r1(top + 2)}`
        })
        .join(' ')
      return shape(
        `M${r1(100 - w - 1)} ${r1(cy - 4)} ${spikes} L${r1(100 + w + 1)} ${r1(cy - 4)} L${r1(100 + w - 3)} ${r1(cy - 6)} ` +
          d`C${100 + w - 6} ${line + 4}, ${S(4)} ${line + 6}, ${L(4)} ${line + 2} L${L(10)} ${line + 8} L${L(14)} ${line + 1} C${100 - w + 6} ${line + 4}, ${100 - w + 4} ${cy - 10}, ${100 - w + 3} ${cy - 6}Z`,
        c,
      )
    }
    case 'balding':
      return (
        shape(
          d`M${100 - w - 1.5} ${cy + 4} C${100 - w - 3} ${cy - 18}, ${100 - w + 2} ${cy - 28}, ${100 - w + 8} ${cy - 30} L${100 - w + 6} ${cy - 10} L${100 - w + 3} ${cy + 2}Z`,
          c,
        ) +
        shape(
          d`M${100 + w + 1.5} ${cy + 4} C${100 + w + 3} ${cy - 18}, ${100 + w - 2} ${cy - 28}, ${100 + w - 8} ${cy - 30} L${100 + w - 6} ${cy - 10} L${100 + w - 3} ${cy + 2}Z`,
          c,
        ) +
        (hatted
          ? ''
          : ink(d`M${L(w - 8)} ${top + 12} Q100 ${top + 2} ${S(w - 10)} ${top + 10}`, 1.2) +
            ink(d`M${L(w - 12)} ${top + 17} Q100 ${top + 8} ${S(w - 14)} ${top + 15}`, 1.2))
      )
    case 'wild': {
      const puffs = [0, 1, 2, 3, 4, 5, 6, 7]
        .map((i) => {
          const a = Math.PI * (1.0 + (i / 7) * 1.0)
          return dot(
            100 + Math.cos(a) * (w + 4),
            cy - 10 + Math.sin(a) * (h * 0.85),
            10 + (i % 3) * 2,
            c,
            ` stroke="${INK}" stroke-width="2"`,
          )
        })
        .join('')
      return (
        puffs +
        shape(
          d`M${100 - w} ${cy - 8} C${100 - w} ${top + 6}, ${100 + w} ${top + 6}, ${100 + w} ${cy - 8} L${100 + w - 4} ${cy - 12} C${S(w * 0.5)} ${line + 6}, ${L(w * 0.5)} ${line + 6}, ${100 - w + 4} ${cy - 12}Z`,
          c,
        )
      )
    }
    case 'bob':
      return sweep(g, c, 6)
    case 'waves':
      return (
        sweep(g, c, 4) +
        strands(
          g,
          [
            d`M${S(w - 4)} ${line + 8} q${g.s * 5} 5 0 10 q${-g.s * 5} 5 0 10`,
            d`M${L(w - 3)} ${line + 6} q${-g.s * 4} 5 0 10`,
          ],
          1.6,
        )
      )
    case 'long':
      return sweep(g, c, 10)
    case 'peekaboo':
      // The long sweep falls over the shadow-side eye.
      return shape(
        d`M${L(w + 4)} ${cy + 6} C${L(w + 6)} ${top - 8}, ${S(w + 6)} ${top - 8}, ${S(w + 6)} ${cy + 24} C${S(w + 2)} ${cy + 40}, ${S(4)} ${cy + 14}, ${S(2)} ${line + 8} C${L(w * 0.4)} ${line + 2}, ${L(w - 1)} ${line + 10}, ${L(w)} ${cy + 2}Z`,
        c,
      )
    case 'bun':
    case 'chignon':
    case 'ponytail':
      return (
        shape(
          d`M${100 - w - 2} ${cy - 2} C${100 - w - 4} ${top - 6}, ${100 + w + 4} ${top - 6}, ${100 + w + 2} ${cy - 2} L${100 + w - 2} ${cy - 6} C${100 + w - 6} ${line + 2}, ${S(8)} ${line - 2}, 100 ${line} C${L(8)} ${line - 2}, ${100 - w + 6} ${line + 2}, ${100 - w + 2} ${cy - 6}Z`,
          c,
        ) +
        strands(g, [
          d`M${L(w - 6)} ${line} Q${L(w * 0.5)} ${top + 2} ${S(w * 0.35)} ${top - 2}`,
          d`M${L(6)} ${line - 1} Q${S(4)} ${top + 4} ${S(w * 0.4)} ${top + 1}`,
        ])
      )
    case 'rolls':
      return (
        dot(L(w * 0.5), top + 4, 12, c, ` stroke="${INK}" stroke-width="2.2"`) +
        dot(S(w * 0.5), top + 4, 12, c, ` stroke="${INK}" stroke-width="2.2"`) +
        shape(
          d`M${100 - w - 2} ${cy} C${100 - w - 3} ${line}, ${100 - w + 6} ${line - 6}, 100 ${line - 2} C${100 + w - 6} ${line - 6}, ${100 + w + 3} ${line}, ${100 + w + 2} ${cy}Z`,
          c,
          1.8,
        )
      )
    case 'curls':
      return [0, 1, 2, 3, 4, 5]
        .map((i) =>
          dot(
            100 - w * 0.75 + (i * w * 1.5) / 5,
            top + 5 + (i % 2) * 4,
            9.5,
            c,
            ` stroke="${INK}" stroke-width="2"`,
          ),
        )
        .join('')
    default:
      return ''
  }
}

function features(g: Geo, kit: Kit): string {
  const { L, S, ex, eyeY, noseY, mouthY, f, old, s } = g
  const out: string[] = []
  // Lit eye: whites, iris, a lid line that is heavier on women.
  const lx = L(ex)
  out.push(
    shape(
      d`M${lx - 9} ${eyeY} Q${lx} ${eyeY - 7} ${lx + 9} ${eyeY} Q${lx} ${eyeY + 5.5} ${lx - 9} ${eyeY}Z`,
      PAPER,
      1.8,
    ),
  )
  out.push(dot(lx - s * 0.6, eyeY - 0.3, 3.9, INK))
  out.push(dot(lx - s * 1.8, eyeY - 1.6, 1.1, PAPER))
  out.push(
    ink(d`M${lx - 10} ${eyeY - 0.5} Q${lx} ${eyeY - 8.5} ${lx + 10} ${eyeY - 0.5}`, f ? 3 : 2.3),
  )
  out.push(
    ink(
      d`M${L(g.w - 9)} ${noseY - 9} Q${L(g.w - 5)} ${noseY - 2} ${L(g.w - 6)} ${noseY + 5}`,
      1.2,
      INK,
      ' opacity="0.7"',
    ),
  )
  if (f) out.push(ink(d`M${L(ex + 8)} ${eyeY - 1} l${s * 3} -3`, 1.8))
  // The far eye: a slightly smaller twin, softened by the wash rather than lost in it.
  const sx = S(ex - 1)
  out.push(
    shape(
      d`M${sx - 8} ${eyeY} Q${sx} ${eyeY - 6.5} ${sx + 8} ${eyeY} Q${sx} ${eyeY + 5} ${sx - 8} ${eyeY}Z`,
      PAPER,
      1.7,
    ),
  )
  out.push(dot(sx - s * 0.6, eyeY - 0.3, 3.6, INK))
  out.push(dot(sx - s * 1.6, eyeY - 1.5, 1, PAPER))
  out.push(
    ink(d`M${sx - 9} ${eyeY - 0.5} Q${sx} ${eyeY - 8} ${sx + 9} ${eyeY - 0.5}`, f ? 2.8 : 2.1),
  )
  // Brows.
  const brow = kit.brow ?? 'level'
  const inner = brow === 'stern' ? eyeY - 8 : brow === 'raised' ? eyeY - 14 : eyeY - 11
  const outer = brow === 'stern' ? eyeY - 13 : brow === 'raised' ? eyeY - 13 : eyeY - 11
  out.push(
    fill(
      d`M${L(3)} ${inner} Q${L(ex)} ${Math.min(inner, outer) - 4} ${L(ex + 10)} ${outer} L${L(ex + 9)} ${outer + (f ? 1.6 : 3)} Q${L(ex)} ${Math.min(inner, outer) + (f ? -1.6 : 0)} ${L(3)} ${inner + (f ? 1.8 : 3)}Z`,
      g.tone === 'grey' && !f ? '#555' : INK,
    ),
  )
  out.push(
    fill(
      d`M${S(3)} ${inner} Q${S(ex)} ${Math.min(inner, outer) - 4} ${S(ex + 10)} ${outer} L${S(ex + 9)} ${outer + (f ? 1.6 : 3)} Q${S(ex)} ${Math.min(inner, outer) + (f ? -1.6 : 0)} ${S(3)} ${inner + (f ? 1.8 : 3)}Z`,
      g.tone === 'grey' && !f ? '#555' : INK,
    ),
  )
  out.push(ink(d`M${S(4)} ${noseY - 1} q${s * 2.5} -1 ${s * 3} 1.5`, 1.3))
  // Nose: one lit edge and the nostril.
  out.push(
    ink(
      d`M${L(1.5)} ${eyeY + 3} Q${L(5.5)} ${noseY - 6} ${L(4.5)} ${noseY} Q${L(1)} ${noseY + 3} ${S(1.5)} ${noseY + 1}`,
      2,
    ),
  )
  out.push(ink(d`M${L(4)} ${noseY - 1} q${-s * -2.5} -1 ${-s * -3} 1.5`, 1.4))
  // Mouth.
  const mouth = kit.mouth ?? 'flat'
  if (f) {
    const up = mouth === 'smile' ? -2 : mouth === 'frown' ? 2 : 0
    const smirk = mouth === 'smirk' ? -2.5 : 0
    out.push(
      fill(
        d`M${L(10)} ${mouthY + up + smirk} Q${L(5)} ${mouthY - 4} ${L(1)} ${mouthY - 2.6} Q100 ${mouthY - 1.6} ${S(1)} ${mouthY - 2.6} Q${S(5)} ${mouthY - 4} ${S(10)} ${mouthY + up} Q${S(4)} ${mouthY + 6} 100 ${mouthY + 5.5} Q${L(5)} ${mouthY + 6} ${L(10)} ${mouthY + up + smirk}Z`,
        INK,
      ),
    )
    out.push(
      fill(
        d`M${L(6)} ${mouthY + 2} Q${L(3)} ${mouthY + 1} ${L(1)} ${mouthY + 2.6} Q${L(3)} ${mouthY + 3.6} ${L(6)} ${mouthY + 2}Z`,
        PAPER,
        ' opacity="0.8"',
      ),
    )
  } else {
    const ends = mouth === 'smile' ? -3 : mouth === 'frown' ? 3 : 0
    const lit = mouth === 'smirk' ? -3.5 : ends
    out.push(
      ink(
        d`M${L(10)} ${mouthY + lit} Q100 ${mouthY + (mouth === 'smile' ? 3 : 0)} ${S(10)} ${mouthY + ends}`,
        2.4,
      ),
    )
    out.push(ink(d`M${L(4)} ${mouthY + 5.5} Q100 ${mouthY + 7} ${S(3)} ${mouthY + 5.5}`, 1.5))
  }
  if (old) {
    out.push(
      ink(d`M${L(ex - 6)} ${eyeY + 6} Q${L(ex)} ${eyeY + 8.5} ${L(ex + 6)} ${eyeY + 5.5}`, 1.1),
    )
    out.push(
      ink(
        d`M${L(ex + 9)} ${eyeY + 1} l${-s * 3.5} 1.5 M${L(ex + 9)} ${eyeY + 3.5} l${-s * 3} 2.5`,
        1,
      ),
    )
    out.push(ink(d`M${L(7)} ${noseY + 2} Q${L(12)} ${mouthY - 2} ${L(12)} ${mouthY + 5}`, 1.3))
  }
  return out.join('')
}

function facialHair(g: Geo, facial: Facial | undefined, rand: () => number): string {
  if (!facial) return ''
  const { L, S, mouthY, chinY, jawY, w, jw, cy, s } = g
  const c = g.tone === 'dark' ? INK : g.tone === 'grey' ? GREY : PAPER
  switch (facial) {
    case 'pencil':
      return ink(d`M${L(10)} ${mouthY - 4.5} Q100 ${mouthY - 7} ${S(10)} ${mouthY - 4.5}`, 1.6)
    case 'handlebar':
      return shape(
        d`M100 ${mouthY - 7} Q${L(10)} ${mouthY - 9} ${L(14)} ${mouthY - 4} Q${L(19)} ${mouthY - 2} ${L(20)} ${mouthY - 9} Q${L(22)} ${mouthY + 2} ${L(12)} ${mouthY - 1} Q${L(6)} ${mouthY - 3} 100 ${mouthY - 3} Q${S(6)} ${mouthY - 3} ${S(12)} ${mouthY - 1} Q${S(22)} ${mouthY + 2} ${S(20)} ${mouthY - 9} Q${S(19)} ${mouthY - 2} ${S(14)} ${mouthY - 4} Q${S(10)} ${mouthY - 9} 100 ${mouthY - 7}Z`,
        c,
        1.6,
      )
    case 'walrus':
      return (
        shape(
          d`M100 ${mouthY - 9} Q${L(12)} ${mouthY - 11} ${L(15)} ${mouthY + 4} Q${L(8)} ${mouthY + 1} 100 ${mouthY + 2} Q${S(8)} ${mouthY + 1} ${S(15)} ${mouthY + 4} Q${S(12)} ${mouthY - 11} 100 ${mouthY - 9}Z`,
          c,
          1.8,
        ) +
        (c === INK
          ? ''
          : [3, 7, 11].map((x) => ink(d`M${L(x)} ${mouthY - 6} l${-s * 1} 7`, 0.9)).join(''))
      )
    case 'goatee':
      return (
        shape(
          d`M${L(7)} ${chinY - 13} Q100 ${chinY - 16} ${S(7)} ${chinY - 13} L${S(4)} ${chinY + 6} Q100 ${chinY + 12} ${L(4)} ${chinY + 6}Z`,
          c,
          1.8,
        ) +
        shape(
          d`M${L(9)} ${mouthY - 4} Q100 ${mouthY - 8} ${S(9)} ${mouthY - 4} L${S(9)} ${mouthY - 2} Q100 ${mouthY - 5} ${L(9)} ${mouthY - 2}Z`,
          c,
          1.4,
        )
      )
    case 'beard':
      return (
        shape(
          d`M${100 - w + 1} ${cy + 8} C${100 - jw} ${jawY + 4}, ${100 - 16} ${chinY + 12}, 100 ${chinY + 12} C${100 + 16} ${chinY + 12}, ${100 + jw} ${jawY + 4}, ${100 + w - 1} ${cy + 8} L${100 + w - 5} ${cy + 10} C${100 + jw - 6} ${jawY - 4}, ${S(8)} ${mouthY + 2}, 100 ${mouthY + 6} C${L(8)} ${mouthY + 2}, ${100 - jw + 6} ${jawY - 4}, ${100 - w + 5} ${cy + 10}Z`,
          c,
          2,
        ) +
        shape(
          d`M${L(11)} ${mouthY - 2} Q100 ${mouthY - 9} ${S(11)} ${mouthY - 2} Q100 ${mouthY - 4} ${L(11)} ${mouthY - 2}Z`,
          c,
          1.4,
        ) +
        (c === INK
          ? strands(g, [
              d`M${L(w - 6)} ${jawY - 2} l${s * 2} 6`,
              d`M${L(w - 12)} ${jawY + 4} l${s * 2} 6`,
              d`M${L(10)} ${chinY + 2} l${s * 1} 6`,
            ])
          : '')
      )
    case 'stubble': {
      const dots: string[] = []
      for (let i = 0; i < 46; i++) {
        const x = L(4 + rand() * (jw - 4))
        const y = mouthY - 6 + rand() * (g.chinY - mouthY + 4)
        dots.push(dot(x, y, 0.55, INK, ' opacity="0.7"'))
      }
      return dots.join('')
    }
    case 'chops':
      return (
        shape(
          d`M${100 - w - 1} ${cy - 6} L${100 - w + 1} ${jawY + 2} Q${100 - jw + 4} ${jawY + 8} ${100 - jw + 10} ${jawY + 2} L${100 - w + 5} ${cy - 6}Z`,
          c,
          1.8,
        ) +
        shape(
          d`M${100 + w + 1} ${cy - 6} L${100 + w - 1} ${jawY + 2} Q${100 + jw - 4} ${jawY + 8} ${100 + jw - 10} ${jawY + 2} L${100 + w - 5} ${cy - 6}Z`,
          c,
          1.8,
        )
      )
  }
}

function body(g: Geo): string {
  const { nw, sw, shoulderY: y } = g
  // Neck base, the slope of the trapezius, the round of the shoulder, then straight down out of frame.
  return d`M${100 - nw - 6} ${y - 3} C${100 - nw - 26} ${y + 1}, ${100 - sw + 16} ${y + 6}, ${100 - sw + 2} ${y + 22} Q${100 - sw - 6} ${y + 34} ${100 - sw - 8} 252 L${100 + sw + 8} 252 Q${100 + sw + 6} ${y + 34} ${100 + sw - 2} ${y + 22} C${100 + sw - 16} ${y + 6}, ${100 + nw + 26} ${y + 1}, ${100 + nw + 6} ${y - 3}Z`
}

function outfit(g: Geo, o: Outfit, id: string): string {
  const { L, S, nw, sw, shoulderY: y, chinY, s } = g
  const out: string[] = []
  const bodyPath = body(g)
  const rim = ink(
    d`M${L(nw + 12)} ${y - 0.5} C${L(nw + 30)} ${y + 2}, ${L(sw - 16)} ${y + 6}, ${L(sw - 3)} ${y + 21}`,
    2.4,
    PAPER,
    ' opacity="0.85"',
  )
  const shadowSide = `<g clip-path="url(#${id}-body)">${fill(d`M${S(nw - 2)} ${y - 10} Q${S(nw + 14)} ${y + 34} ${S(sw * 0.55)} 260 L${S(140)} 260 L${S(140)} ${y - 10}Z`, SHADE, ' opacity="0.35"')}</g>`
  const light = (color: string) =>
    fill(bodyPath, color, ` stroke="${INK}" stroke-width="2.6"`) + shadowSide
  const shirtV = (bottom: number, color = PAPER) =>
    fill(d`M${L(nw + 1)} ${y - 4} L100 ${y + bottom} L${S(nw + 1)} ${y - 4}Z`, color)
  const collar = (color = PAPER) =>
    shape(d`M${L(nw + 1)} ${y - 9} L${L(3)} ${y + 10} L${L(nw + 7)} ${y + 8}Z`, color, 1.6) +
    shape(d`M${S(nw + 1)} ${y - 9} L${S(3)} ${y + 10} L${S(nw + 7)} ${y + 8}Z`, color, 1.6)
  const tie = (color: string, edge: string) =>
    fill(
      d`M${L(4)} ${y + 7} L${S(4)} ${y + 7} L${S(3)} ${y + 14} L${L(3)} ${y + 14}Z M${L(3)} ${y + 14} L${L(7)} ${y + 48} L100 ${y + 57} L${S(7)} ${y + 48} L${S(3)} ${y + 14}Z`,
      color,
      ` stroke="${edge}" stroke-width="1.3"`,
    )
  const bow = (color: string) =>
    fill(
      d`M100 ${y + 9} L${L(10)} ${y + 3} L${L(10)} ${y + 15}Z M100 ${y + 9} L${S(10)} ${y + 3} L${S(10)} ${y + 15}Z`,
      color,
      ` stroke="${color === INK ? PAPER : INK}" stroke-width="1"`,
    ) + dot(100, y + 9, 2.6, color)
  const lapels = (bottom: number) =>
    ink(d`M${L(nw + 12)} ${y + 2} L${L(nw + 2)} ${y + 22} L${L(9)} ${y + bottom}`, 1.6, PAPER) +
    ink(
      d`M${S(nw + 12)} ${y + 2} L${S(nw + 2)} ${y + 22} L${S(9)} ${y + bottom}`,
      1.2,
      PAPER,
      ' opacity="0.45"',
    )
  const buttons = (xs: number[], ys: number[], color: string) =>
    xs.flatMap((x) => ys.map((yy) => dot(x, y + yy, 2.3, color))).join('')
  out.push(`<defs><clipPath id="${id}-body"><path d="${bodyPath}"/></clipPath></defs>`)
  switch (o) {
    case 'suit':
    case 'suit_dark':
      out.push(
        fill(bodyPath, INK),
        shirtV(46, o === 'suit_dark' ? '#3b3b3b' : PAPER),
        collar(o === 'suit_dark' ? '#3b3b3b' : PAPER),
        tie(o === 'suit_dark' ? PAPER : INK, o === 'suit_dark' ? INK : PAPER),
        lapels(52),
        rim,
      )
      break
    case 'suit_bow':
      out.push(
        fill(bodyPath, INK),
        shirtV(46),
        collar(),
        bow(INK),
        lapels(52),
        buttons([100], [24, 36], INK),
        rim,
      )
      break
    case 'tailcoat':
      out.push(
        fill(bodyPath, INK),
        shirtV(50),
        fill(
          d`M${L(nw + 5)} ${y + 8} L100 ${y + 54} L${S(nw + 5)} ${y + 8} L${S(9)} ${y + 60} L${L(9)} ${y + 60}Z`,
          PAPER,
          ` stroke="${INK}" stroke-width="1.6"`,
        ),
        buttons([100], [36, 46], INK),
        collar(),
        bow(INK),
        lapels(56),
        rim,
      )
      break
    case 'uniform':
    case 'epaulettes':
      out.push(
        fill(bodyPath, INK),
        fill(
          d`M${L(nw + 3)} ${y - 13} L${S(nw + 3)} ${y - 13} L${S(nw + 5)} ${y + 3} L${L(nw + 5)} ${y + 3}Z`,
          INK,
          ` stroke="${PAPER}" stroke-width="1.4"`,
        ),
        buttons([L(9), S(9)], [14, 28, 42], PAPER),
        ink(d`M100 ${y + 6} L100 ${y + 60}`, 1.2, PAPER, ' opacity="0.4"'),
        rim,
      )
      if (o === 'epaulettes')
        out.push(
          shape(
            d`M${L(nw + 16)} ${y + 2} L${L(sw - 8)} ${y + 8} L${L(sw - 6)} ${y + 15} L${L(nw + 15)} ${y + 9}Z`,
            PAPER,
            1.4,
          ),
          [0, 1, 2, 3]
            .map((i) => ink(d`M${L(sw - 8 - i * 3)} ${y + 15} l0 7`, 1.2, PAPER))
            .join(''),
          shape(
            d`M${S(nw + 16)} ${y + 2} L${S(sw - 8)} ${y + 8} L${S(sw - 6)} ${y + 15} L${S(nw + 15)} ${y + 9}Z`,
            '#777',
            1.4,
          ),
        )
      break
    case 'turtleneck':
    case 'peacoat':
      out.push(fill(bodyPath, INK))
      if (o === 'peacoat')
        out.push(
          fill(
            d`M${L(nw + 8)} ${y + 2} L${L(sw - 20)} ${y + 18} L${L(18)} ${y + 56} L${L(6)} ${y + 56}Z`,
            '#2c2c2c',
            ` stroke="${PAPER}" stroke-width="1.4"`,
          ),
          buttons([L(14), S(14)], [36, 52], PAPER),
        )
      out.push(
        fill(
          d`M${L(nw + 5)} ${chinY - 2} Q100 ${chinY + 8} ${S(nw + 5)} ${chinY - 2} L${S(nw + 9)} ${y + 7} Q100 ${y + 14} ${L(nw + 9)} ${y + 7}Z`,
          o === 'peacoat' ? '#3a3a3a' : INK,
          ` stroke="${PAPER}" stroke-width="1.2"`,
        ),
      )
      out.push(
        [0, 1, 2, 3]
          .map((i) =>
            ink(
              d`M${L(nw + 3 - i * 5)} ${chinY + 4} l0 ${y - chinY + 2}`,
              1,
              PAPER,
              ' opacity="0.55"',
            ),
          )
          .join(''),
        rim,
      )
      break
    case 'vest':
      out.push(
        light(PAPER),
        collar(),
        ink(d`M${L(sw - 14)} ${y + 18} q${-s * 6} 14 ${-s * 2} 30`, 1.4),
      )
      out.push(
        fill(
          d`M${L(sw + 6)} 252 L${L(sw - 8)} ${y + 8} L${L(nw + 7)} ${y + 2} L${L(4)} ${y + 40} L${L(4)} 252Z`,
          INK,
        ),
        fill(
          d`M${S(sw + 6)} 252 L${S(sw - 8)} ${y + 8} L${S(nw + 7)} ${y + 2} L${S(4)} ${y + 40} L${S(4)} 252Z`,
          INK,
        ),
        buttons([L(8)], [46, 58], PAPER),
      )
      break
    case 'gown':
      out.push(
        light(PAPER),
        ink(d`M${L(nw + 2)} ${y + 6} Q${L(nw + 18)} ${y + 2} ${L(sw - 20)} ${y + 6}`, 1.4),
        ink(
          d`M${S(nw + 2)} ${y + 6} Q${S(nw + 18)} ${y + 2} ${S(sw - 20)} ${y + 6}`,
          1.4,
          PAPER,
          ' opacity="0.5"',
        ),
      )
      out.push(
        fill(
          d`M-20 252 L-20 ${y + 46} Q${L(30)} ${y + 34} ${L(4)} ${y + 46} Q100 ${y + 40} ${S(4)} ${y + 46} Q${S(30)} ${y + 34} 220 ${y + 46} L220 252Z`,
          INK,
          ` stroke="${PAPER}" stroke-width="1.2"`,
        ),
      )
      break
    case 'dress':
      out.push(
        fill(bodyPath, INK),
        fill(
          d`M${L(nw + 9)} ${y - 1} Q${L(8)} ${y + 34} 100 ${y + 36} Q${S(8)} ${y + 34} ${S(nw + 9)} ${y - 1}Z`,
          PAPER,
        ),
        fill(
          d`M${S(nw + 9)} ${y - 1} Q${S(8)} ${y + 34} 100 ${y + 36} L${S(3)} ${y - 1}Z`,
          INK,
          ' opacity="0.85"',
        ),
        rim,
      )
      break
    case 'blouse':
    case 'blouse_bow':
    case 'apron':
      out.push(light(PAPER), buttons([100], [18, 30, 42, 54], INK))
      out.push(
        shape(
          d`M100 ${y + 6} Q${L(nw + 18)} ${y + 10} ${L(nw + 8)} ${y - 6} L${L(nw)} ${y - 4}Z`,
          PAPER,
          1.6,
        ),
        shape(
          d`M100 ${y + 6} Q${S(nw + 18)} ${y + 10} ${S(nw + 8)} ${y - 6} L${S(nw)} ${y - 4}Z`,
          PAPER,
          1.6,
        ),
      )
      if (o === 'blouse_bow') out.push(bow(INK))
      if (o === 'apron')
        out.push(
          shape(
            d`M${L(18)} ${y + 22} L${S(18)} ${y + 22} L${S(22)} 252 L${L(22)} 252Z`,
            '#d8d5ce',
            1.8,
          ),
          ink(
            d`M${L(18)} ${y + 22} L${L(nw + 2)} ${y - 4} M${S(18)} ${y + 22} L${S(nw + 2)} ${y - 4}`,
            2.4,
          ),
          ink(d`M${L(10)} ${y + 40} L${S(10)} ${y + 40}`, 1.1, INK, ' opacity="0.5"'),
        )
      break
    case 'cardigan':
      out.push(
        fill(bodyPath, INK),
        shirtV(40),
        shape(
          d`M100 ${y + 4} Q${L(nw + 14)} ${y + 8} ${L(nw + 6)} ${y - 6} L${L(nw)} ${y - 4}Z`,
          PAPER,
          1.4,
        ),
        shape(
          d`M100 ${y + 4} Q${S(nw + 14)} ${y + 8} ${S(nw + 6)} ${y - 6} L${S(nw)} ${y - 4}Z`,
          PAPER,
          1.4,
        ),
        buttons([L(6)], [44, 56], PAPER),
        [0, 1, 2]
          .map((i) =>
            ink(d`M${L(sw - 10 - i * 6)} ${y + 20} l${s * 2} 40`, 1, PAPER, ' opacity="0.35"'),
          )
          .join(''),
        rim,
      )
      break
    case 'white_jacket':
      out.push(
        light(PAPER),
        shape(
          d`M${L(nw + 2)} ${y - 8} L${L(nw + 4)} ${y + 6} L100 ${y + 12} L${S(nw + 4)} ${y + 6} L${S(nw + 2)} ${y - 8} Q100 ${y - 2} ${L(nw + 2)} ${y - 8}Z`,
          PAPER,
          1.6,
        ),
        ink(d`M100 ${y + 12} L100 252`, 1.6),
        buttons([L(5)], [22, 36, 50], INK),
        ink(d`M${L(sw - 16)} ${y + 22} q${-s * 4} 16 0 30`, 1.2),
      )
      break
    case 'coveralls':
      out.push(
        light('#6d6b67'),
        shape(
          d`M${L(nw + 1)} ${y - 8} L${L(4)} ${y + 12} L${L(nw + 10)} ${y + 8}Z`,
          '#6d6b67',
          1.6,
        ),
        shape(
          d`M${S(nw + 1)} ${y - 8} L${S(4)} ${y + 12} L${S(nw + 10)} ${y + 8}Z`,
          '#6d6b67',
          1.6,
        ),
        ink(d`M100 ${y + 12} L100 252`, 2),
        dot(L(26), y + 34, 3.5, INK, ' opacity="0.5"'),
        dot(L(34), y + 42, 2, INK, ' opacity="0.5"'),
      )
      break
    case 'chef':
      out.push(
        light(PAPER),
        ink(d`M${L(20)} ${y + 2} Q${L(4)} ${y + 30} ${S(16)} 252`, 1.6),
        buttons([L(14), S(2)], [20, 34, 48], INK),
        fill(
          d`M${L(nw + 4)} ${y - 6} L${S(nw + 4)} ${y - 6} L${S(nw + 6)} ${y + 2} L${L(nw + 6)} ${y + 2}Z`,
          PAPER,
          ` stroke="${INK}" stroke-width="1.6"`,
        ),
      )
      break
    case 'clerical':
      out.push(
        fill(bodyPath, INK),
        fill(
          d`M${L(nw + 4)} ${y - 14} L${S(nw + 4)} ${y - 14} L${S(nw + 6)} ${y + 4} L${L(nw + 6)} ${y + 4}Z`,
          INK,
          ` stroke="${PAPER}" stroke-width="0.8"`,
        ),
        fill(d`M${L(4)} ${y - 12} L${S(4)} ${y - 12} L${S(4)} ${y - 2} L${L(4)} ${y - 2}Z`, PAPER),
        rim,
      )
      break
    case 'fur':
      out.push(
        fill(bodyPath, INK),
        fill(d`M${L(nw + 9)} ${y - 1} Q100 ${y + 30} ${S(nw + 9)} ${y - 1}Z`, PAPER),
      )
      out.push(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((i) => {
            const t = i / 9
            const x = 100 - sw + 6 + t * (2 * sw - 12)
            const yy = y + 12 + Math.abs(t - 0.5) * -10 + 8
            return dot(
              x,
              yy,
              10,
              x * s > 100 * s ? '#cfcac0' : PAPER,
              ` stroke="${INK}" stroke-width="1.6"`,
            )
          })
          .join(''),
      )
      break
    case 'towel':
      out.push(
        light(PAPER),
        ink(d`M${L(28)} ${y + 26} Q${L(14)} ${y + 36} 100 ${y + 30}`, 1.6),
        ink(d`M${L(sw - 10)} ${y + 8} q${-s * 6} 10 ${-s * 3} 22`, 1.4),
      )
      out.push(
        shape(
          d`M${L(nw + 2)} ${y - 6} Q${L(nw + 16)} ${y + 2} ${L(20)} 252 L${L(6)} 252 Q${L(6)} ${y + 20} ${L(nw - 4)} ${y - 2}Z`,
          PAPER,
          1.8,
        ),
        shape(
          d`M${S(nw + 2)} ${y - 6} Q${S(nw + 16)} ${y + 2} ${S(20)} 252 L${S(6)} 252 Q${S(6)} ${y + 20} ${S(nw - 4)} ${y - 2}Z`,
          '#8d8a84',
          1.8,
        ),
        ink(
          d`M${L(10)} ${y + 40} L${L(19)} ${y + 40} M${L(10)} ${y + 45} L${L(19)} ${y + 45}`,
          1.4,
        ),
      )
      break
    case 'shawl':
      out.push(
        fill(bodyPath, '#2b2b2b'),
        fill(
          d`M${L(sw + 20)} 252 L${L(nw + 6)} ${y - 2} Q100 ${y + 26} ${S(nw + 6)} ${y - 2} L${S(sw + 20)} 252Z`,
          INK,
        ),
        [0, 1, 2, 3, 4, 5, 6, 7]
          .map((i) => dot(L(sw - 6 - i * 9), y + 34 + (i % 2) * 7, 1.8, PAPER, ' opacity="0.7"'))
          .join(''),
        fill(d`M${L(nw + 9)} ${y - 1} Q100 ${y + 22} ${S(nw + 9)} ${y - 1}Z`, PAPER),
        rim,
      )
      break
    case 'leather':
      out.push(
        fill(bodyPath, INK),
        shirtV(30, '#3b3b3b'),
        ink(d`M100 ${y + 30} L100 252`, 1.6, PAPER, ' opacity="0.7"'),
      )
      out.push(
        [0, 1, 2, 3, 4]
          .map((i) =>
            dot(
              L(nw + 4 + i * 6),
              y + 2 + i * 1.5,
              7,
              PAPER,
              ` stroke="${INK}" stroke-width="1.4"`,
            ),
          )
          .join(''),
        [0, 1, 2, 3, 4]
          .map((i) =>
            dot(
              S(nw + 4 + i * 6),
              y + 2 + i * 1.5,
              7,
              '#9a968e',
              ` stroke="${INK}" stroke-width="1.4"`,
            ),
          )
          .join(''),
        rim,
      )
      break
  }
  return out.join('')
}

function neck(g: Geo, id: string): string {
  const { L, S, nw, chinY, shoulderY } = g
  const neckPath = d`M${L(nw)} ${chinY - 18} L${L(nw + 2)} ${shoulderY + 6} L${S(nw + 2)} ${shoulderY + 6} L${S(nw)} ${chinY - 18}Z`
  return (
    `<defs><clipPath id="${id}-neck"><path d="${neckPath}"/></clipPath></defs>` +
    fill(neckPath, PAPER, ` stroke="${INK}" stroke-width="2.4"`) +
    `<g clip-path="url(#${id}-neck)">` +
    fill(
      d`M${S(1)} ${chinY - 20} L${S(40)} ${chinY - 20} L${S(40)} ${shoulderY + 8} L${S(4)} ${shoulderY + 8}Z`,
      SHADE,
      ' opacity="0.22"',
    ) +
    fill(
      d`M${L(40)} ${chinY - 20} L${S(40)} ${chinY - 20} L${S(40)} ${chinY + 9} Q100 ${chinY + 14} ${L(40)} ${chinY + 4}Z`,
      SHADE,
      ' opacity="0.3"',
    ) +
    `</g>`
  )
}

function ears(g: Geo): string {
  const { w, cy, L, S } = g
  return (
    `<ellipse cx="${r1(L(w + 0.5))}" cy="${r1(cy + 7)}" rx="6" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="2.2"/>` +
    ink(d`M${L(w + 2)} ${cy} q${-g.s * -2.5} 6 0 12`, 1.3) +
    `<ellipse cx="${r1(S(w + 0.5))}" cy="${r1(cy + 7)}" rx="6" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="2.2"/>` +
    `<ellipse cx="${r1(S(w + 0.5))}" cy="${r1(cy + 7)}" rx="6" ry="11" fill="${SHADE}" opacity="0.35"/>`
  )
}

function hat(g: Geo, h: Hat, id: string): { back: string; front: string; shade: number } {
  const { w, top, cy, L, S, s, eyeY } = g
  const brimY = top + g.h * 0.36
  const crownTop = top - 16
  const fedora = (low: boolean, band: string, tilt: number) => {
    const by = brimY + (low ? 6 : 0)
    return (
      `<g transform="rotate(${tilt} 100 ${r1(by)})">` +
      shape(
        d`M${100 - w - 2} ${by} C${100 - w} ${by - 20}, ${100 - w + 6} ${crownTop}, ${L(6)} ${crownTop + 2} Q100 ${crownTop + 8} ${S(6)} ${crownTop + 2} C${100 + w - 6} ${crownTop}, ${100 + w} ${by - 20}, ${100 + w + 2} ${by}Z`,
        INK,
        2,
      ) +
      fill(
        d`M${100 - w - 1} ${by - 9} L${100 + w + 1} ${by - 9} L${100 + w + 2} ${by - 1} L${100 - w - 2} ${by - 1}Z`,
        band,
      ) +
      shape(
        d`M${100 - w - 30} ${by + 4} Q100 ${by - 12} ${100 + w + 30} ${by + 4} Q100 ${by + 6} ${100 - w - 30} ${by + 4}Z`,
        INK,
        2,
      ) +
      ink(
        d`M${L(w + 24)} ${by + 2} Q${L(w * 0.4)} ${by - 7} ${L(2)} ${by - 6}`,
        1.4,
        PAPER,
        ' opacity="0.8"',
      ) +
      ink(
        d`M${L(w - 6)} ${by - 12} C${L(w - 8)} ${crownTop + 10}, ${L(10)} ${crownTop + 4}, ${L(4)} ${crownTop + 4}`,
        1.4,
        PAPER,
        ' opacity="0.6"',
      ) +
      `</g>`
    )
  }
  const peaked = (color: string, badge: string) => {
    const by = brimY + 2
    return (
      shape(
        d`M${100 - w - 4} ${by} C${100 - w - 10} ${by - 14}, ${100 - w} ${crownTop + 2}, 100 ${crownTop + 1} C${100 + w} ${crownTop + 2}, ${100 + w + 10} ${by - 14}, ${100 + w + 4} ${by}Z`,
        color,
        2,
      ) +
      fill(
        d`M${100 - w - 3} ${by - 8} L${100 + w + 3} ${by - 8} L${100 + w + 4} ${by} L${100 - w - 4} ${by}Z`,
        INK,
        ` stroke="${PAPER}" stroke-width="1"`,
      ) +
      shape(d`M${100 - w + 2} ${by} Q100 ${by + 18} ${100 + w - 2} ${by} Z`, INK, 1.6) +
      badge
    )
  }
  switch (h) {
    case 'fedora':
      return { back: '', front: fedora(false, '#4a4a4a', 0), shade: brimY + 6 }
    case 'fedora_low':
      return { back: '', front: fedora(true, '#4a4a4a', 0), shade: eyeY + 5 }
    case 'fedora_band':
      return { back: '', front: fedora(false, PAPER, s * -4), shade: brimY + 8 }
    case 'fedora_tilt':
      return { back: '', front: fedora(false, '#4a4a4a', s * 10), shade: brimY + 2 }
    case 'flat_cap':
    case 'newsboy': {
      const by = brimY + 4
      const puff = h === 'newsboy' ? 8 : 2
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 4} ${by} C${100 - w - 8} ${top - puff}, ${100 + w + 8} ${top - puff - 4}, ${100 + w + 6} ${by - 2} Z`,
            h === 'newsboy' ? '#3a3a3a' : INK,
            2,
          ) +
          (h === 'newsboy'
            ? [-0.5, 0, 0.5]
                .map((k) =>
                  ink(
                    d`M${100 + k * w * 1.3} ${by - 2} Q${100 + k * w * 0.8} ${top} 100 ${top - 4}`,
                    1,
                    PAPER,
                    ' opacity="0.5"',
                  ),
                )
                .join('') + dot(100, top - 4, 3, INK)
            : '') +
          shape(
            d`M${100 - w + 4} ${by - 2} Q${L(4)} ${by + 14} ${L(-w - 6)} ${by + 2} Z`,
            INK,
            1.8,
          ),
        shade: by + 6,
      }
    }
    case 'peaked':
      return { back: '', front: peaked(INK, ''), shade: brimY + 8 }
    case 'peaked_badge':
      return {
        back: '',
        front: peaked(
          INK,
          `<path d="${d`M100 ${brimY - 22} l3 6 6 1 -4.5 4 1.5 6.5 -6 -3.5 -6 3.5 1.5 -6.5 -4.5 -4 6 -1Z`}" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`,
        ),
        shade: brimY + 8,
      }
    case 'peaked_braid':
      return {
        back: '',
        front: peaked(
          INK,
          ink(d`M${100 - w} ${brimY - 10} Q100 ${brimY - 14} ${100 + w} ${brimY - 10}`, 2, PAPER) +
            ink(
              d`M${100 - w + 4} ${brimY - 14} Q100 ${brimY - 18} ${100 + w - 4} ${brimY - 14}`,
              1.2,
              PAPER,
            ),
        ),
        shade: brimY + 8,
      }
    case 'peaked_white':
      return { back: '', front: peaked(PAPER, ''), shade: brimY + 6 }
    case 'pillbox':
    case 'pillbox_strap': {
      const x0 = h === 'pillbox' ? L(w * 0.2) : 100
      return {
        back: '',
        front:
          `<g transform="rotate(${h === 'pillbox' ? -s * 12 : 0} ${r1(x0)} ${r1(top)})">` +
          shape(
            d`M${x0 - 18} ${top + 6} L${x0 - 16} ${top - 10} Q${x0} ${top - 14} ${x0 + 16} ${top - 10} L${x0 + 18} ${top + 6} Q${x0} ${top + 10} ${x0 - 18} ${top + 6}Z`,
            INK,
            2,
          ) +
          ink(d`M${x0 - 17} ${top} Q${x0} ${top + 4} ${x0 + 17} ${top}`, 1.6, PAPER) +
          `</g>` +
          (h === 'pillbox_strap'
            ? ink(
                d`M${100 - w + 4} ${top + 8} Q${100 - w + 8} ${g.chinY - 10} 100 ${g.chinY + 1} Q${100 + w - 8} ${g.chinY - 10} ${100 + w - 4} ${top + 8}`,
                1.4,
                INK,
              )
            : ''),
        shade: 0,
      }
    }
    case 'toque':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${brimY} L${100 - w} ${top - 10} C${100 - w - 14} ${top - 30}, ${100 - 10} ${top - 50}, 100 ${top - 38} C${100 + 10} ${top - 52}, ${100 + w + 14} ${top - 30}, ${100 + w} ${top - 10} L${100 + w - 2} ${brimY}Z`,
            PAPER,
            2,
          ) +
          fill(
            d`M${S(2)} ${top - 44} L${S(w + 20)} ${top - 30} L${S(w)} ${brimY} L${S(6)} ${brimY}Z`,
            '#a9a59d',
            ' opacity="0.7"',
          ) +
          ink(d`M${100 - w + 1} ${brimY - 10} L${100 + w - 1} ${brimY - 10}`, 1.6),
        shade: 0,
      }
    case 'nurse_cap':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${top + 12} L${100 - w + 6} ${top - 8} Q100 ${top - 14} ${100 + w - 6} ${top - 8} L${100 + w - 2} ${top + 12} Q100 ${top + 4} ${100 - w + 2} ${top + 12}Z`,
            PAPER,
            2,
          ) +
          fill(
            d`M${100 - w + 3} ${top + 2} Q100 ${top - 5} ${100 + w - 3} ${top + 2} L${100 + w - 2} ${top + 6} Q100 ${top - 1} ${100 - w + 2} ${top + 6}Z`,
            INK,
          ),
        shade: 0,
      }
    case 'beret':
      return {
        back: '',
        front:
          shape(
            d`M${L(w + 8)} ${top + 14} C${L(w + 14)} ${top - 10}, ${S(w)} ${top - 16}, ${S(w + 4)} ${top + 2} Q${S(w * 0.4)} ${top + 14} ${L(w + 8)} ${top + 14}Z`,
            INK,
            2,
          ) + ink(d`M${S(4)} ${top - 12} l${s * 2} -6`, 2.4),
        shade: 0,
      }
    case 'top_hat':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${brimY} L${100 - w + 6} ${top - 52} Q100 ${top - 56} ${100 + w - 6} ${top - 52} L${100 + w - 2} ${brimY}Z`,
            INK,
            2,
          ) +
          fill(
            d`M${100 - w + 3} ${brimY - 12} L${100 + w - 3} ${brimY - 12} L${100 + w - 2.5} ${brimY - 3} L${100 - w + 2.5} ${brimY - 3}Z`,
            '#4a4a4a',
          ) +
          shape(
            d`M${100 - w - 22} ${brimY + 2} Q100 ${brimY - 10} ${100 + w + 22} ${brimY + 2} Q100 ${brimY + 6} ${100 - w - 22} ${brimY + 2}Z`,
            INK,
            2,
          ) +
          ink(d`M${L(w - 10)} ${brimY - 14} L${L(w - 12)} ${top - 48}`, 2, PAPER, ' opacity="0.6"'),
        shade: brimY + 6,
      }
    case 'bowler':
    case 'homburg':
      return {
        back: '',
        front:
          shape(
            h === 'bowler'
              ? d`M${100 - w - 1} ${brimY} C${100 - w - 2} ${top - 26}, ${100 + w + 2} ${top - 26}, ${100 + w + 1} ${brimY}Z`
              : d`M${100 - w - 1} ${brimY} C${100 - w} ${top - 10}, ${100 - w + 6} ${top - 18}, 100 ${top - 12} C${100 + w - 6} ${top - 18}, ${100 + w} ${top - 10}, ${100 + w + 1} ${brimY}Z`,
            INK,
            2,
          ) +
          fill(
            d`M${100 - w - 0.5} ${brimY - 8} L${100 + w + 0.5} ${brimY - 8} L${100 + w + 1} ${brimY - 1} L${100 - w - 1} ${brimY - 1}Z`,
            '#4a4a4a',
          ) +
          shape(
            d`M${100 - w - 16} ${brimY + 1} Q${100 - w - 18} ${brimY - 8} ${100 - w - 8} ${brimY - 3} Q100 ${brimY - 6} ${100 + w + 8} ${brimY - 3} Q${100 + w + 18} ${brimY - 8} ${100 + w + 16} ${brimY + 1} Q100 ${brimY + 6} ${100 - w - 16} ${brimY + 1}Z`,
            INK,
            2,
          ) +
          ink(
            d`M${L(w - 4)} ${brimY - 10} C${L(w - 4)} ${top - 8}, ${L(10)} ${top - 16}, ${L(2)} ${top - 15}`,
            1.6,
            PAPER,
            ' opacity="0.6"',
          ),
        shade: brimY + 6,
      }
    case 'boater':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${brimY} L${100 - w + 3} ${top - 6} Q100 ${top - 10} ${100 + w - 3} ${top - 6} L${100 + w - 2} ${brimY}Z`,
            PAPER,
            2,
          ) +
          fill(
            d`M${100 - w + 2.5} ${brimY - 10} L${100 + w - 2.5} ${brimY - 10} L${100 + w - 2} ${brimY - 2} L${100 - w + 2} ${brimY - 2}Z`,
            INK,
          ) +
          shape(
            d`M${100 - w - 22} ${brimY + 1} L${100 + w + 22} ${brimY + 1} L${100 + w + 20} ${brimY + 5} L${100 - w - 20} ${brimY + 5}Z`,
            PAPER,
            2,
          ) +
          [0, 1, 2, 3]
            .map((i) =>
              ink(
                d`M${100 - w + 6} ${top + i * 5} L${100 + w - 6} ${top + i * 5}`,
                0.7,
                INK,
                ' opacity="0.4"',
              ),
            )
            .join(''),
        shade: brimY + 4,
      }
    case 'aviator':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 4} ${cy + 22} C${100 - w - 8} ${top - 6}, ${100 + w + 8} ${top - 6}, ${100 + w + 4} ${cy + 22} L${100 + w - 3} ${cy + 22} L${100 + w - 4} ${cy - 10} Q100 ${top + 16} ${100 - w + 4} ${cy - 10} L${100 - w + 3} ${cy + 22}Z`,
            INK,
            2,
          ) +
          ink(
            d`M${L(w - 2)} ${cy - 8} Q${L(w * 0.4)} ${top + 4} ${S(4)} ${top + 2}`,
            1.4,
            PAPER,
            ' opacity="0.7"',
          ) +
          ink(
            d`M${100 - w - 2} ${cy + 22} L${100 - w + 6} ${g.chinY - 4} M${100 + w + 2} ${cy + 22} L${100 + w - 6} ${g.chinY - 4}`,
            1.6,
          ),
        shade: 0,
      }
    case 'preacher':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${brimY} L${100 - w + 4} ${top - 14} Q100 ${top - 18} ${100 + w - 4} ${top - 14} L${100 + w - 2} ${brimY}Z`,
            INK,
            2,
          ) +
          shape(
            d`M${100 - w - 34} ${brimY + 2} L${100 + w + 34} ${brimY + 2} L${100 + w + 32} ${brimY + 7} L${100 - w - 32} ${brimY + 7}Z`,
            INK,
            2,
          ) +
          ink(d`M${L(w + 28)} ${brimY + 3} L${L(4)} ${brimY + 3}`, 1.2, PAPER, ' opacity="0.7"'),
        shade: eyeY - 2,
      }
    case 'wide_feather':
      return {
        back: '',
        front:
          `<g transform="rotate(${-s * 8} 100 ${r1(brimY)})">` +
          shape(
            d`M${100 - w + 6} ${brimY - 4} C${100 - w + 6} ${top - 10}, ${100 + w - 6} ${top - 10}, ${100 + w - 6} ${brimY - 4}Z`,
            INK,
            2,
          ) +
          shape(
            d`M${100 - w - 36} ${brimY + 2} Q100 ${brimY - 16} ${100 + w + 36} ${brimY + 2} Q100 ${brimY + 4} ${100 - w - 36} ${brimY + 2}Z`,
            INK,
            2,
          ) +
          ink(
            d`M${S(w - 8)} ${brimY - 8} C${S(w + 6)} ${top - 16}, ${S(w + 24)} ${top - 28}, ${S(w + 40)} ${top - 30}`,
            2.4,
            PAPER,
          ) +
          [0, 1, 2, 3, 4, 5]
            .map((i) => ink(d`M${S(w + 4 + i * 6)} ${top - 6 - i * 4} l${s * 3} -7`, 1.1, PAPER))
            .join('') +
          `</g>`,
        shade: brimY + 4,
      }
    case 'veil':
      return {
        back: '',
        front:
          shape(
            d`M${L(w * 0.1)} ${top + 4} C${L(w * 0.2)} ${top - 14}, ${S(w * 0.9)} ${top - 16}, ${S(w * 0.9)} ${top + 2}Z`,
            INK,
            2,
          ) +
          `<g clip-path="url(#${id}-head)" opacity="0.55">` +
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .map((i) =>
              ink(
                d`M${100 - w - 4 + i * 8} ${top + 2} L${100 - w - 16 + i * 8} ${g.noseY}`,
                0.6,
                INK,
              ),
            )
            .join('') +
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .map((i) =>
              ink(
                d`M${100 - w - 16 + i * 8} ${top + 2} L${100 - w - 4 + i * 8} ${g.noseY}`,
                0.6,
                INK,
              ),
            )
            .join('') +
          `</g>` +
          ink(d`M${100 - w - 2} ${g.noseY} Q100 ${g.noseY + 4} ${100 + w + 2} ${g.noseY}`, 0.9),
        shade: 0,
      }
    case 'headscarf':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 5} ${cy + 18} C${100 - w - 10} ${top - 10}, ${100 + w + 10} ${top - 10}, ${100 + w + 5} ${cy + 18} L${100 + w} ${cy + 16} C${100 + w - 2} ${top + 22}, ${100 - w + 2} ${top + 22}, ${100 - w} ${cy + 16}Z`,
            '#3d3d3d',
            2,
          ) +
          [0, 1, 2, 3, 4, 5, 6]
            .map((i) =>
              dot(
                100 - w * 0.8 + i * w * 0.27,
                top + 2 + (i % 2) * 6,
                1.8,
                PAPER,
                ' opacity="0.8"',
              ),
            )
            .join('') +
          shape(d`M100 ${g.chinY + 2} l-7 6 l7 4 l7 -4Z`, '#3d3d3d', 1.6),
        shade: 0,
      }
    case 'turban':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 6} ${top + 26} C${100 - w - 12} ${top - 20}, ${100 + w + 12} ${top - 20}, ${100 + w + 6} ${top + 26} Q100 ${top + 16} ${100 - w - 6} ${top + 26}Z`,
            '#2f2f2f',
            2,
          ) +
          [0, 1, 2]
            .map((i) =>
              ink(
                d`M${100 - w - 2} ${top + 18 - i * 10} Q100 ${top + 4 - i * 12} ${100 + w + 2} ${top + 18 - i * 10}`,
                1.2,
                PAPER,
                ' opacity="0.55"',
              ),
            )
            .join('') +
          dot(100, top + 8, 4.5, PAPER, ` stroke="${INK}" stroke-width="1.6"`) +
          ink(d`M100 ${top + 4} l0 -12`, 1.6, PAPER),
        shade: 0,
      }
    case 'knit_cap':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 3} ${brimY + 2} C${100 - w - 4} ${top - 14}, ${100 + w + 4} ${top - 14}, ${100 + w + 3} ${brimY + 2}Z`,
            '#353535',
            2,
          ) +
          fill(
            d`M${100 - w - 4} ${brimY - 10} L${100 + w + 4} ${brimY - 10} L${100 + w + 4} ${brimY + 3} L${100 - w - 4} ${brimY + 3}Z`,
            INK,
            ` stroke="${INK}" stroke-width="2"`,
          ) +
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map((i) =>
              ink(d`M${100 - w + i * w * 0.22} ${brimY - 8} l0 9`, 0.9, PAPER, ' opacity="0.5"'),
            )
            .join(''),
        shade: brimY + 4,
      }
    case 'paper_cap':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w + 2} ${top + 10} L${100 - w + 10} ${top - 8} L${100 + w - 10} ${top - 8} L${100 + w - 2} ${top + 10} Q100 ${top + 4} ${100 - w + 2} ${top + 10}Z`,
            PAPER,
            2,
          ) + ink(d`M${100 - w + 6} ${top + 2} L${100 + w - 6} ${top + 2}`, 1.2),
        shade: 0,
      }
    case 'eyeshade':
      return {
        back: '',
        front:
          ink(d`M${100 - w - 1} ${brimY - 4} Q100 ${top - 4} ${100 + w + 1} ${brimY - 4}`, 2.6) +
          fill(
            d`M${100 - w - 4} ${brimY - 4} Q100 ${brimY - 10} ${100 + w + 4} ${brimY - 4} L${100 + w + 6} ${brimY + 8} Q100 ${brimY + 14} ${100 - w - 6} ${brimY + 8}Z`,
            '#5b5b5b',
            ` stroke="${INK}" stroke-width="2" opacity="0.92"`,
          ),
        shade: brimY + 12,
      }
    case 'surgical_cap':
      return {
        back: '',
        front:
          shape(
            d`M${100 - w - 3} ${brimY + 4} C${100 - w - 4} ${top - 10}, ${100 + w + 4} ${top - 10}, ${100 + w + 3} ${brimY + 4} Q100 ${brimY - 2} ${100 - w - 3} ${brimY + 4}Z`,
            '#d6d3cc',
            2,
          ) +
          [0, 1, 2]
            .map((i) =>
              ink(d`M${100 - w + 6 + i * w * 0.6} ${top} q2 8 0 16`, 0.9, INK, ' opacity="0.5"'),
            )
            .join(''),
        shade: 0,
      }
    case 'headset':
      return {
        back: '',
        front:
          ink(
            d`M${L(w + 2)} ${cy} C${L(w + 6)} ${top - 14}, ${S(w + 6)} ${top - 14}, ${S(w + 2)} ${cy}`,
            3,
          ) +
          `<ellipse cx="${r1(L(w + 2))}" cy="${r1(cy + 4)}" rx="5" ry="8" fill="${INK}" stroke="${PAPER}" stroke-width="1"/>` +
          ink(d`M${L(w + 2)} ${cy + 10} Q${L(w - 4)} ${g.mouthY + 8} ${L(10)} ${g.mouthY + 3}`, 2) +
          dot(L(9), g.mouthY + 3, 3, INK),
        shade: 0,
      }
    case 'feather_band':
      return {
        back: '',
        front:
          ink(d`M${100 - w - 2} ${top + 18} Q100 ${top + 8} ${100 + w + 2} ${top + 18}`, 3.4) +
          ink(
            d`M${100 - w - 2} ${top + 18} Q100 ${top + 8} ${100 + w + 2} ${top + 18}`,
            1.2,
            PAPER,
            ' stroke-dasharray="2 3"',
          ) +
          dot(S(w * 0.6), top + 11, 3.5, PAPER, ` stroke="${INK}" stroke-width="1.4"`) +
          ink(
            d`M${S(w * 0.6)} ${top + 9} C${S(w * 0.7)} ${top - 14}, ${S(w * 0.5)} ${top - 30}, ${S(w * 0.9)} ${top - 40}`,
            2.4,
          ) +
          [0, 1, 2, 3, 4, 5]
            .map((i) =>
              ink(
                d`M${S(w * 0.62 + i * 0.6)} ${top - 4 - i * 6} l${s * 5} -4 M${S(w * 0.62 + i * 0.6)} ${top - 4 - i * 6} l${-s * 4} -5`,
                1,
                INK,
              ),
            )
            .join(''),
        shade: 0,
      }
  }
}

function extras(g: Geo, list: Extra[], rand: () => number): { face: string; top: string } {
  const { L, S, ex, eyeY, noseY, mouthY, chinY, w, cy, s, shoulderY: y, nw, top } = g
  const face: string[] = []
  const over: string[] = []
  const lens = (x: number, shapeD: string, lit: boolean) =>
    ink(shapeD, lit ? 2.2 : 1.4, lit ? INK : PAPER) +
    (lit ? ink(d`M${x - 3} ${eyeY - 4} l3 -2`, 1.2, INK, ' opacity="0.6"') : '')
  for (const e of list) {
    switch (e) {
      case 'glasses_round':
        face.push(
          lens(L(ex), d`M${L(ex) - 8} ${eyeY} a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0`, true),
          lens(S(ex), d`M${S(ex) - 8} ${eyeY} a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0`, false),
          ink(d`M${L(ex - 8)} ${eyeY - 1} Q100 ${eyeY - 4} ${S(ex - 8)} ${eyeY - 1}`, 1.8),
          ink(d`M${L(ex + 8)} ${eyeY - 1} L${L(w + 1)} ${eyeY - 3}`, 1.8),
        )
        break
      case 'glasses_horn':
        face.push(
          ink(
            d`M${L(ex + 10)} ${eyeY - 6} L${L(ex - 9)} ${eyeY - 6} L${L(ex - 8)} ${eyeY + 5} Q${L(ex)} ${eyeY + 8} ${L(ex + 9)} ${eyeY + 5}Z`,
            3,
          ),
          ink(
            d`M${S(ex + 10)} ${eyeY - 6} L${S(ex - 9)} ${eyeY - 6} L${S(ex - 8)} ${eyeY + 5} Q${S(ex)} ${eyeY + 8} ${S(ex + 9)} ${eyeY + 5}Z`,
            1.6,
            PAPER,
          ),
          ink(d`M${L(ex - 9)} ${eyeY - 4} Q100 ${eyeY - 7} ${S(ex - 9)} ${eyeY - 4}`, 2.4),
          ink(d`M${L(ex + 10)} ${eyeY - 5} L${L(w + 1)} ${eyeY - 4}`, 2.4),
        )
        break
      case 'glasses_half':
        face.push(
          ink(d`M${L(ex + 8)} ${eyeY + 3} Q${L(ex)} ${eyeY + 12} ${L(ex - 8)} ${eyeY + 3}Z`, 1.8),
          ink(
            d`M${S(ex + 8)} ${eyeY + 3} Q${S(ex)} ${eyeY + 12} ${S(ex - 8)} ${eyeY + 3}Z`,
            1.2,
            PAPER,
          ),
          ink(d`M${L(ex - 8)} ${eyeY + 3} Q100 ${eyeY + 1} ${S(ex - 8)} ${eyeY + 3}`, 1.4),
          ink(d`M${L(ex + 8)} ${eyeY + 3} L${L(w + 1)} ${eyeY - 1}`, 1.4),
          ink(
            d`M${L(w + 1)} ${eyeY} Q${L(w + 6)} ${y - 10} ${L(nw + 6)} ${y + 6}`,
            0.8,
            INK,
            ' stroke-dasharray="1.5 1.5"',
          ),
        )
        break
      case 'glasses_cat':
        face.push(
          ink(
            d`M${L(ex - 8)} ${eyeY - 3} L${L(ex + 11)} ${eyeY - 8} Q${L(ex + 10)} ${eyeY + 4} ${L(ex)} ${eyeY + 6} Q${L(ex - 8)} ${eyeY + 5} ${L(ex - 8)} ${eyeY - 3}Z`,
            2.6,
          ),
          ink(
            d`M${S(ex - 8)} ${eyeY - 3} L${S(ex + 11)} ${eyeY - 8} Q${S(ex + 10)} ${eyeY + 4} ${S(ex)} ${eyeY + 6} Q${S(ex - 8)} ${eyeY + 5} ${S(ex - 8)} ${eyeY - 3}Z`,
            1.4,
            PAPER,
          ),
          ink(d`M${L(ex - 8)} ${eyeY - 2} Q100 ${eyeY - 5} ${S(ex - 8)} ${eyeY - 2}`, 2),
        )
        break
      case 'monocle':
        face.push(
          ink(d`M${L(ex) - 9} ${eyeY} a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0`, 2.4),
          ink(
            d`M${L(ex - 2)} ${eyeY + 9} Q${L(ex + 4)} ${chinY} ${L(nw + 10)} ${y + 12}`,
            0.9,
            INK,
            ' stroke-dasharray="1.6 1.4"',
          ),
          ink(d`M${L(ex) - 4} ${eyeY - 5} l4 -2`, 1.4, INK, ' opacity="0.5"'),
        )
        break
      case 'loupe':
        face.push(
          fill(
            d`M${L(ex) - 8} ${eyeY - 6} L${L(ex) + 8} ${eyeY - 6} L${L(ex) + 6} ${eyeY + 6} L${L(ex) - 6} ${eyeY + 6}Z`,
            INK,
          ),
          `<ellipse cx="${r1(L(ex))}" cy="${r1(eyeY)}" rx="6" ry="5" fill="#777" stroke="${PAPER}" stroke-width="1.2"/>`,
          dot(L(ex) - s * 2, eyeY - 1.5, 1.4, PAPER),
        )
        break
      case 'cigarette':
      case 'cigar':
      case 'holder': {
        const x0 = L(8)
        const y0 = mouthY + 1
        const len = e === 'holder' ? 34 : e === 'cigar' ? 18 : 16
        const x1 = L(8 + len)
        const y1 = y0 + (e === 'holder' ? -6 : 4)
        if (e === 'holder') face.push(ink(d`M${x0} ${y0} L${x1} ${y1}`, 1.8))
        const cx = e === 'holder' ? x1 : x0
        const cyy = e === 'holder' ? y1 : y0
        const ex2 = e === 'holder' ? L(8 + len + 12) : x1
        const ey2 = e === 'holder' ? y1 - 2 : y1
        face.push(
          ink(
            d`M${cx} ${cyy} L${ex2} ${ey2}`,
            e === 'cigar' ? 5.5 : 3,
            e === 'cigar' ? '#3a3a3a' : PAPER,
          ),
          ink(d`M${cx} ${cyy} L${ex2} ${ey2}`, e === 'cigar' ? 0.8 : 0.6, INK, ' opacity="0.6"'),
          dot(ex2, ey2, e === 'cigar' ? 2.6 : 1.6, '#e6e1d6'),
        )
        if (e === 'cigar') face.push(ink(d`M${L(13)} ${y0 + 0.5} L${L(14)} ${y0 + 5.5}`, 2, PAPER))
        over.push(
          ink(
            d`M${ex2} ${ey2 - 2} C${ex2 + -s * 8} ${ey2 - 18}, ${ex2 - -s * 6} ${ey2 - 30}, ${ex2 + -s * 10} ${ey2 - 46} S${ex2 + -s * 2} ${ey2 - 70}, ${ex2 + -s * 14} ${ey2 - 84}`,
            2.2,
            PAPER,
            ' opacity="0.55"',
          ),
          ink(
            d`M${ex2 + -s * 3} ${ey2 - 8} C${ex2 + -s * 14} ${ey2 - 22}, ${ex2 + -s * 4} ${ey2 - 36}, ${ex2 + -s * 16} ${ey2 - 52}`,
            1.4,
            PAPER,
            ' opacity="0.4"',
          ),
        )
        break
      }
      case 'pipe':
        face.push(
          ink(d`M${L(6)} ${mouthY + 1} Q${L(18)} ${mouthY + 6} ${L(26)} ${mouthY + 8}`, 2.6),
          shape(
            d`M${L(22)} ${mouthY + 2} L${L(34)} ${mouthY + 2} L${L(33)} ${mouthY + 16} Q${L(28)} ${mouthY + 20} ${L(23)} ${mouthY + 16}Z`,
            '#2a2a2a',
            1.8,
          ),
        )
        over.push(
          ink(
            d`M${L(28)} ${mouthY} C${L(34)} ${mouthY - 16}, ${L(24)} ${mouthY - 28}, ${L(34)} ${mouthY - 44}`,
            2,
            PAPER,
            ' opacity="0.5"',
          ),
        )
        break
      case 'toothpick':
        face.push(ink(d`M${L(7)} ${mouthY} L${L(19)} ${mouthY - 3}`, 1.4))
        break
      case 'earrings_drop':
        face.push(
          ink(d`M${L(w + 1)} ${cy + 16} l0 7`, 1.2),
          dot(L(w + 1), cy + 26, 3.2, PAPER, ` stroke="${INK}" stroke-width="1.4"`),
          dot(S(w + 1), cy + 26, 2.6, PAPER, ' opacity="0.85"'),
        )
        break
      case 'earrings_hoop':
        face.push(
          `<circle cx="${r1(L(w + 1))}" cy="${r1(cy + 24)}" r="6" fill="none" stroke="${INK}" stroke-width="1.8"/>`,
          `<circle cx="${r1(S(w + 1))}" cy="${r1(cy + 24)}" r="6" fill="none" stroke="${PAPER}" stroke-width="1.4" opacity="0.8"/>`,
        )
        break
      case 'pearls':
      case 'long_pearls':
      case 'beads': {
        const depth = e === 'long_pearls' ? 52 : e === 'beads' ? 36 : 20
        const strands = e === 'beads' ? 3 : 1
        for (let k = 0; k < strands; k++) {
          for (let i = 0; i <= 12; i++) {
            const t = i / 12
            const x = 100 - nw - 6 - k * 3 + t * (2 * nw + 12 + k * 6)
            const yy = y - 2 + Math.sin(Math.PI * t) * (depth + k * 8)
            over.push(
              dot(
                x,
                yy,
                e === 'beads' ? 2 : 2.7,
                x * s < 100 * s ? PAPER : '#bdb9b1',
                ` stroke="${INK}" stroke-width="0.9"`,
              ),
            )
          }
        }
        break
      }
      case 'scar':
        face.push(
          ink(d`M${L(ex + 6)} ${eyeY + 8} L${L(8)} ${mouthY - 4}`, 1.6),
          [0.25, 0.5, 0.75]
            .map((t) =>
              ink(
                d`M${L(ex + 6 - (ex - 2) * t) - 2.5} ${eyeY + 8 + (mouthY - eyeY - 12) * t - 1.5} l5 2.5`,
                1.1,
              ),
            )
            .join(''),
        )
        break
      case 'beauty_mark':
        face.push(dot(L(11), mouthY - 6, 1.6, INK))
        break
      case 'pencil_ear':
        over.push(
          `<g transform="rotate(${-s * 62} ${r1(L(w + 2))} ${r1(cy - 4)})">${shape(d`M${L(w + 2) - 2.5} ${cy - 24} L${L(w + 2) + 2.5} ${cy - 24} L${L(w + 2) + 2.5} ${cy + 14} L${L(w + 2)} ${cy + 19} L${L(w + 2) - 2.5} ${cy + 14}Z`, '#d9d5cc', 1.2)}</g>`,
        )
        break
      case 'flower_hair':
      case 'flower_lapel': {
        const fx = e === 'flower_hair' ? L(w - 2) : L(nw + 16)
        const fy = e === 'flower_hair' ? top + 18 : y + 14
        const rr = e === 'flower_hair' ? 5 : 3.6
        over.push(
          [0, 1, 2, 3, 4]
            .map((i) =>
              dot(
                fx + Math.cos((i * 2 * Math.PI) / 5) * rr,
                fy + Math.sin((i * 2 * Math.PI) / 5) * rr,
                rr * 0.75,
                PAPER,
                ` stroke="${INK}" stroke-width="1.2"`,
              ),
            )
            .join('') + dot(fx, fy, rr * 0.45, INK),
        )
        break
      }
      case 'tape_measure':
      case 'strap_pair':
        over.push(
          shape(
            d`M${L(nw + 2)} ${y - 6} Q${L(nw + 8)} ${y + 20} ${L(nw + 2)} 252 L${L(nw - 5)} 252 Q${L(nw + 1)} ${y + 20} ${L(nw - 5)} ${y - 6}Z`,
            e === 'tape_measure' ? '#e2ddd2' : '#555',
            1.4,
          ),
          shape(
            d`M${S(nw + 2)} ${y - 6} Q${S(nw + 8)} ${y + 20} ${S(nw + 2)} 252 L${S(nw - 5)} 252 Q${S(nw + 1)} ${y + 20} ${S(nw - 5)} ${y - 6}Z`,
            e === 'tape_measure' ? '#a8a49b' : '#333',
            1.4,
          ),
        )
        if (e === 'tape_measure')
          over.push(
            [0, 1, 2, 3, 4, 5, 6]
              .map((i) => ink(d`M${L(nw + 4)} ${y + 4 + i * 8} l${s * 3} 0`, 0.9))
              .join(''),
          )
        break
      case 'mask_down':
        over.push(
          shape(
            d`M${L(nw + 4)} ${chinY + 2} L${S(nw + 4)} ${chinY + 2} L${S(nw + 2)} ${chinY + 18} Q100 ${chinY + 22} ${L(nw + 2)} ${chinY + 18}Z`,
            PAPER,
            1.6,
          ),
          ink(
            d`M${L(nw + 2)} ${chinY + 8} L${S(nw + 2)} ${chinY + 8} M${L(nw + 2)} ${chinY + 13} L${S(nw + 2)} ${chinY + 13}`,
            0.9,
            INK,
            ' opacity="0.6"',
          ),
          ink(d`M${L(nw + 4)} ${chinY + 4} L${L(w)} ${cy + 10}`, 1),
        )
        break
      case 'goggles':
        over.push(
          ink(
            d`M${100 - w - 3} ${top + 20} Q100 ${top + 12} ${100 + w + 3} ${top + 20}`,
            3.4,
            '#444',
          ),
          `<circle cx="${r1(L(ex))}" cy="${r1(top + 16)}" r="9" fill="#555" stroke="${INK}" stroke-width="2.4"/>`,
          `<circle cx="${r1(S(ex))}" cy="${r1(top + 16)}" r="9" fill="#333" stroke="${INK}" stroke-width="2.4"/>`,
          ink(d`M${L(ex) + 2} ${top + 11} l4 2`, 1.6, PAPER, ' opacity="0.8"'),
        )
        break
      case 'scarf':
        over.push(
          shape(
            d`M${L(nw + 6)} ${chinY + 2} Q100 ${chinY + 14} ${S(nw + 6)} ${chinY + 2} L${S(nw + 8)} ${y + 8} Q100 ${y + 16} ${L(nw + 8)} ${y + 8}Z`,
            PAPER,
            1.8,
          ),
          shape(
            d`M${L(nw + 4)} ${y + 4} Q${L(nw + 20)} ${y + 30} ${L(sw(g) - 14)} 252 L${L(sw(g) - 30)} 252 Q${L(nw + 8)} ${y + 30} ${L(nw - 4)} ${y + 8}Z`,
            PAPER,
            1.8,
          ),
        )
        break
      case 'press_card':
        over.push(
          `<g transform="rotate(${-s * 8} ${r1(L(w * 0.5))} ${r1(top + 6)})">${shape(d`M${L(w * 0.5) - 8} ${top - 2} L${L(w * 0.5) + 8} ${top - 2} L${L(w * 0.5) + 8} ${top + 10} L${L(w * 0.5) - 8} ${top + 10}Z`, PAPER, 1.2)}${ink(d`M${L(w * 0.5) - 5} ${top + 2} l10 0 M${L(w * 0.5) - 5} ${top + 6} l7 0`, 1.2)}</g>`,
        )
        break
      case 'keys':
        over.push(
          `<circle cx="${r1(L(26))}" cy="${r1(y + 36)}" r="6" fill="none" stroke="${PAPER}" stroke-width="1.8"/>`,
          [0, 1, 2]
            .map((i) =>
              ink(
                d`M${L(26) - 3 + i * 3} ${y + 41} l${(i - 1) * 2} 12 m0 -4 l2 0 m-2 -3 l2 0`,
                1.6,
                PAPER,
              ),
            )
            .join(''),
        )
        break
      case 'bandage_nose':
        face.push(
          shape(
            d`M${L(6)} ${eyeY + 8} L${S(6)} ${eyeY + 14} L${S(5)} ${eyeY + 18} L${L(7)} ${eyeY + 12}Z`,
            PAPER,
            1.2,
          ),
          shape(
            d`M${S(6)} ${eyeY + 8} L${L(6)} ${eyeY + 14} L${L(5)} ${eyeY + 18} L${S(7)} ${eyeY + 12}Z`,
            PAPER,
            1.2,
          ),
        )
        break
      case 'freckles':
        for (let i = 0; i < 9; i++)
          face.push(dot(L(6 + rand() * 16), noseY - 6 + rand() * 7, 0.8, INK, ' opacity="0.75"'))
        break
      case 'stethoscope':
        over.push(
          ink(
            d`M${L(nw + 6)} ${y - 6} Q${L(nw + 12)} ${y + 30} ${L(10)} ${y + 40} M${S(nw + 6)} ${y - 6} Q${S(nw + 10)} ${y + 18} ${S(8)} ${y + 30}`,
            2.4,
            '#3a3a3a',
          ),
          dot(L(10), y + 42, 5, '#bbb', ` stroke="${INK}" stroke-width="1.6"`),
        )
        break
      case 'bow_hair':
        over.push(
          fill(
            d`M${S(w * 0.4)} ${top + 4} l-10 -8 l0 14Z M${S(w * 0.4)} ${top + 4} l10 -8 l0 14Z`,
            INK,
            ` stroke="${PAPER}" stroke-width="1"`,
          ),
          dot(S(w * 0.4), top + 4, 2.6, INK),
        )
        break
      case 'satchel':
        over.push(
          fill(
            d`M${L(sw(g) - 30)} ${y + 4} L${L(sw(g) - 22)} ${y} L${S(sw(g) - 10)} 252 L${S(sw(g) - 22)} 252Z`,
            '#5a5a5a',
            ` stroke="${INK}" stroke-width="1.4"`,
          ),
        )
        break
      case 'camera':
        over.push(
          ink(
            d`M${L(nw + 6)} ${y - 4} L${L(4)} ${y + 40} M${S(nw + 6)} ${y - 4} L${S(4)} ${y + 40}`,
            1.6,
            PAPER,
            ' opacity="0.7"',
          ),
          shape(
            d`M${L(22)} ${y + 38} L${S(22)} ${y + 38} L${S(22)} ${y + 62} L${L(22)} ${y + 62}Z`,
            '#2a2a2a',
            1.8,
          ),
          `<circle cx="100" cy="${r1(y + 50)}" r="8" fill="#555" stroke="${PAPER}" stroke-width="1.6"/>`,
          dot(100 - s * 2, y + 47, 1.8, PAPER),
        )
        break
      case 'comb':
        over.push(
          fill(
            d`M${L(24)} ${y + 20} L${L(34)} ${y + 20} L${L(34)} ${y + 24} L${L(24)} ${y + 24}Z`,
            INK,
          ),
          [0, 1, 2, 3, 4].map((i) => ink(d`M${L(25 + i * 2)} ${y + 24} l0 3`, 0.9)).join(''),
          ink(d`M${L(20)} ${y + 24} L${L(38)} ${y + 24}`, 1.2),
        )
        break
      case 'name_tag':
        over.push(
          shape(
            d`M${L(20)} ${y + 22} L${L(36)} ${y + 22} L${L(36)} ${y + 30} L${L(20)} ${y + 30}Z`,
            PAPER,
            1.2,
          ),
          ink(d`M${L(22)} ${y + 26} l10 0`, 1, INK, ' transform="scale(1)"'),
        )
        break
      case 'cloth_shoulder':
        over.push(
          shape(
            d`M${L(nw + 10)} ${y - 2} Q${L(nw + 26)} ${y - 4} ${L(sw(g) - 10)} ${y + 8} L${L(sw(g) - 14)} ${y + 34} L${L(sw(g) - 26)} ${y + 32} L${L(nw + 18)} ${y + 6}Z`,
            '#d6d2c9',
            1.6,
          ),
          ink(d`M${L(nw + 20)} ${y + 4} L${L(sw(g) - 18)} ${y + 14}`, 1, INK, ' opacity="0.5"'),
        )
        break
      case 'rosette':
        over.push(
          fill(d`M${L(nw + 14)} ${y + 18} l-4 16 l4 -4 l4 4Z`, '#555'),
          dot(L(nw + 14), y + 16, 6, PAPER, ` stroke="${INK}" stroke-width="1.6"`),
          dot(L(nw + 14), y + 16, 2.4, INK),
        )
        break
      case 'watch_chain':
        over.push(
          ink(
            d`M${L(10)} ${y + 40} Q${L(22)} ${y + 50} ${L(34)} ${y + 40}`,
            1.4,
            PAPER,
            ' stroke-dasharray="2 1.5"',
          ),
        )
        break
      case 'smudge':
        face.push(fill(d`M${L(14)} ${noseY + 6} q4 -3 8 0 q-2 4 -8 0Z`, INK, ' opacity="0.55"'))
        break
      case 'bow_tie':
        over.push(
          fill(
            d`M100 ${y + 2} L${L(9)} ${y - 4} L${L(9)} ${y + 8}Z M100 ${y + 2} L${S(9)} ${y - 4} L${S(9)} ${y + 8}Z`,
            INK,
            ` stroke="${PAPER}" stroke-width="0.8"`,
          ),
          dot(100, y + 2, 2.4, INK),
        )
        break
      case 'neckerchief':
        over.push(
          shape(d`M${L(nw + 4)} ${y - 6} L${S(nw + 4)} ${y - 6} L100 ${y + 14}Z`, INK, 1.6),
          ink(d`M${L(6)} ${y - 2} L${S(6)} ${y - 2}`, 1, PAPER, ' opacity="0.6"'),
        )
        break
    }
  }
  return { face: face.join(''), top: over.join('') }
}

const sw = (g: Geo) => g.sw

/**
 * The SVG markup for one suspect's portrait (200×250). [idPrefix] keeps ids unique when several share a page;
 * [attrs] replaces the root's namespace attribute, e.g. with a position when the portrait is nested in another SVG.
 */
export function portraitSvg(
  suspect: Suspect,
  idPrefix = `p${suspect.id}`,
  attrs = 'xmlns="http://www.w3.org/2000/svg"',
): string {
  return renderPortrait(suspect, kitFor(suspect), idPrefix, attrs)
}

/** Draws [suspect]'s face wearing [kit]. Exported so every part can be checked, not only the roster's picks. */
export function renderPortrait(
  suspect: Suspect,
  kit: Kit,
  idPrefix = `p${suspect.id}`,
  attrs = 'xmlns="http://www.w3.org/2000/svg"',
): string {
  const rand = seeded(suspect.id * 2654435761 + 97)
  const g = geometry(suspect, kit, rand)
  const id = idPrefix
  const hatted =
    kit.hat !== undefined &&
    ![
      'headset',
      'feather_band',
      'veil',
      'pillbox',
      'beret',
      'nurse_cap',
      'paper_cap',
      'eyeshade',
    ].includes(kit.hat)
  const h = kit.hat ? hat(g, kit.hat, id) : { back: '', front: '', shade: 0 }
  const ex = extras(g, kit.extras ?? [], rand)
  const head = headPath(g)
  const shade =
    h.shade > 0
      ? `<g clip-path="url(#${id}-head)">${fill(d`M0 0 L200 0 L200 ${h.shade} Q100 ${h.shade + 4} 0 ${h.shade}Z`, SHADE, ' opacity="0.36"')}</g>`
      : ''
  return (
    `<svg ${attrs} viewBox="0 0 200 250">` +
    backdrop(g, id) +
    `<g filter="url(#${id}-wash)"><g filter="url(#${id}-ink)">` +
    h.back +
    hairBack(g, kit.hair) +
    neck(g, id) +
    outfit(g, kit.outfit, id) +
    ears(g) +
    fill(head, PAPER, ` stroke="${INK}" stroke-width="2.6"`) +
    `<g clip-path="url(#${id}-head)">${washShadow(g, id)}</g>` +
    features(g, kit) +
    facialHair(g, kit.facial, rand) +
    hairFront(g, kit.hair, hatted) +
    ex.face +
    shade +
    h.front +
    ex.top +
    `</g></g>` +
    `<rect width="200" height="250" filter="url(#${id}-grain)" opacity="0.1"/>` +
    `</svg>`
  )
}

/** A data URI for `<img src>`, so portraits need no inline markup. */
export function portraitUri(suspect: Suspect): string {
  return `data:image/svg+xml,${encodeURIComponent(portraitSvg(suspect))}`
}
