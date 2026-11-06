# Precinct Noir: design

How the game looks and why. The code is `web/src/index.css` (tokens at the top), the components in
`web/src/components/`, and the drawn artwork in `web/src/portraits/`. Keep new screens inside this system.
Before adding something, check whether it is paper, ink or a stamp (see the principles below).

## 1. Subject
A city precinct at night in the 1940s: case files, the line-up wall, rubber stamps, typewriters, light
through venetian blinds. Players are friends in a living room with a TV and their phones, so the
screens must read from across a room in English and Russian.

## 2. Principles
1. **Paper and night.** Records are manila paper with typed text: the room code, forms, and the suspect
   cards. Behind them is the evidence wall, lit only through venetian blinds.
2. **Status is stamped, not badged.** VIP, "case closed" and results are rubber-stamp marks, slightly
   rotated, with an ink texture. Don't add pill badges.
3. **One loud element per screen.** On the board screen it is the stamped room code; everything else
   stays quiet. In the game (M5) it will be the board itself.
4. **Structure carries meaning.** The line-up's placard numbers are the join order, which decides who
   plays. Lines are the height chart players stand on. Don't add numbering or rules that encode nothing.
5. **Motion answers something.** The code lands like a stamp, and a new player slides into the line-up.
   Nothing else moves on its own, and `prefers-reduced-motion` turns all of it off.

## 3. Tokens
| Token | Value | Use |
|---|---|---|
| `--ink` | `#141a24` | background: blue-black night, not neutral black |
| `--ink-raised` | `#1d2533` | inputs and panels on ink |
| `--smoke` / `--smoke-light` | `#3a4250` / `#9aa1ac` | borders / secondary text |
| `--fog` | `#dde1e6` | text on ink |
| `--manila` / `--manila-back` | `#e2cf9e` / `#d2bb83` | folder front and back panels, placards |
| `--ribbon` | `#2a241c` | typed text and buttons on manila |
| `--stamp-red` | `#b0262c` (`#ff9ea2` on ink) | the room-code stamp, kills, destructive actions |
| `--evidence-blue` | `#2e5e8e` (`#9cc0e6` on ink) | connection notices, and exonerated suspects in M5 |
| `--brass` | `#b8945a` (`#dcbb80` light) | primary buttons, focus ring, VIP |

The game is dark-only on purpose: it is played in living rooms and on TVs.

## 4. Type
| Family | Role |
|---|---|
| **Sofia Sans Extra Condensed** (variable) | display: names in the line-up, headings, the room code. Tall and condensed, so it reads at 10 feet |
| **Sofia Sans** (variable) | interface text and buttons (same family voice) |
| **Cousine** | only text typed on paper: form inputs, the join address, placard numbers. Never labels |

- All three are self-hosted (`@fontsource`) and cover Cyrillic.
- Vite must not inline them as `data:` URIs, because the CSP's `font-src 'self'` blocks them; see
  `build.assetsInlineLimit` in `web/vite.config.ts`.
- Sizes come from a 1.25 modular scale that grows with the viewport (`--step--1` … `--step-4`).
- Sentence case everywhere. Uppercase appears only inside stamps and in the room code.

## 5. The evidence wall and the folders
- **The wall** (`portraits/wall.ts`, `components/EvidenceWall.tsx`) sits behind every screen: a charcoal
  corkboard in a dark office.
  - **What hangs on it:** twelve suspect index cards around the edges, a made-up district map in the middle,
    newspaper clippings, polaroids, a fingerprint card and red string.
  - **Signs it shares with the game:** a red X marks a killed suspect, and a blue "cleared" stamp one who
    was ruled out.
  - **Light:** venetian-blind light over everything, and a vignette.
  - **Deterministic:** the same twelve suspects on every device.
- **How it's drawn:** one SVG built in about 1 ms, shown as a `data:` image, so the browser rasterises it
  once off the main thread. Fonts inside it are system fonts (Georgia, Courier New), because images can't
  load web fonts.
- **Readability:**
  - On the home page and the TV the wall shows at 78% brightness. A shadow pool sits behind the home title,
    and a dark `.slate` sits behind the TV's line-up.
  - On phones and plain pages it is dimmed to 36% and blurred, so text can sit straight on it.
- **Folders** (`.folder`) look like real manila folders:
  - the taller back panel carries the tab, with a typed label stuck on it;
  - two typed sheets peek out;
  - the front panel has a thumb cut, a paperclip and a fine fibre texture.
  - Content goes in `.folder__front`.
- **Everything is our own.** The look takes its mood from noir evidence boards in general. Never copy
  another game's characters, card templates, title lettering or layouts.

## 6. Suspect portraits
`portraits/portrait.ts` draws each of the 60 roster suspects as an original black-and-white "bold ink"
bust (SVG, 200×250).
- **Lighting:** hard from one side, so the far third of the face falls into solid ink. A small triangle of
  light lands on the shadow cheek, and the shadow eye keeps only its glint.
- **Ink feel:** a displacement filter wobbles the lines like brush ink, and grain sits on top.
- **One look per job (`KITS`):** the suspect's archetype picks the hat, hair, clothes, facial hair and
  props. Their id varies the face: proportions, which side is lit, jaw and chin.
- **Deterministic:** a suspect looks the same everywhere (wall, board cards), with no randomness outside the
  seeded generator.
- **Adding a suspect:** give the new archetype a kit. Tests fail when an archetype has none, or when any
  part produces invalid SVG.
- **Using them:** `portraitUri(suspect)` gives an `<img>` source. `portraitSvg(suspect, prefix, attrs)`
  nests one inside another SVG, keeping its ids under the prefix.

## 7. Layouts
- **TV / board screen** (`/tv/CODE`, priority):
  - Overscan-safe margins (5vw / 3–5vh).
  - Two columns: on the left, the case file with the stamped code, QR and join address; on the right,
    the line-up and status.
  - Names are about 3.6vw tall.
- **Phone** (`/CODE`, priority):
  - One column, max 40rem.
  - The main action (Start, Play again, End game) sits in a sticky bar in the thumb zone, with Leave
    under it.
  - Touch targets are at least 44px.
- **Laptop:** the phone and TV layouts adapt (the TV layout goes to one column under 900px). Polishing
  remote play on one's own device is the final step (M11).

## 8. Interaction rules
- **Two taps for anything that affects others:** remove a player, leave, end the game. The first tap
  arms the button (red outline, new label), and it disarms after 4 s.
- **Errors say what happened and what to do,** in the interface's voice ("No room has the code BKTR.
  Check the code on the board."). The server sends codes; the texts live in `web/src/i18n/`.
- **Connection trouble is a blue bar at the top.** Refusals and timer nudges flash for 5 s above the
  action bar.
- **Hints are descriptions, not part of a field's name** (`aria-describedby`).

## 9. Coming next
- **M5:** the board, made of case-file cards. Each card shows the suspect's portrait, name and number,
  with Russian name transliterations.
- **The game's name stays "Precinct Noir" in Latin letters in every language,** since it is also the
  address players type. Never translate it as «Нуар»: that is the Russian edition title of another game.
