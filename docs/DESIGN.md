# Precinct Noir: design

How the game looks and why. The code is `web/src/index.css` (tokens at the top) and the components in
`web/src/components/`. Keep new screens inside this system. Before adding something, check whether it is
paper, ink or a stamp (see the principles below).

## 1. Subject
A city precinct at night in the 1940s: case files, the line-up wall, rubber stamps, typewriters, light
through venetian blinds. Players are friends in a living room with a TV and their phones, so the
screens must read from across a room in English and Russian.

## 2. Principles
1. **Paper and night.** Records are manila paper with typed text: the room code, forms, and later the
   suspect cards. The room around them is night ink under blind-light.
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
| `--manila` | `#e2cf9e` | case files, placards |
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

## 5. Layouts
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

## 6. Interaction rules
- **Two taps for anything that affects others:** remove a player, leave, end the game. The first tap
  arms the button (red outline, new label), and it disarms after 4 s.
- **Errors say what happened and what to do,** in the interface's voice ("No room has the code BKTR.
  Check the code on the board."). The server sends codes; the texts live in `web/src/i18n/`.
- **Connection trouble is a blue bar at the top.** Refusals and timer nudges flash for 5 s above the
  action bar.
- **Hints are descriptions, not part of a field's name** (`aria-describedby`).

## 7. Coming next
- **M5:** the board, made of case-file cards. Each card shows the name, the number and a simple
  silhouette by gender and archetype, plus Russian name transliterations.
- **After v0.1:** the full portrait generator, with the owner's review.
