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
`portraits/portrait.ts` draws each of the 60 roster suspects as an original black-and-white "sketch"
bust (SVG, 200×250): ink line and grey wash on cream paper, like a pencil-and-ink study. No colour.
- **Line and wash:** a filter keeps a thin ink edge on every dark shape (hair, hats, coats) and fills its
  inside with grey wash (`WASH`), so dark clothes read as shaded cloth, not solid black.
- **A close portrait:** the figure is drawn 1.22× larger about the face (`FRAME_SCALE`), so the head fills
  about half the frame and sits in its top square, with the shoulders cropped below. Board cards can show
  just that top square. Tall hats (top hat, chef's toque) are kept short enough to stay in the frame.
- **Drawn like a person:**
  - **Proportions:** eyes at mid-head and about one eye-width apart, the nose base halfway from the eyes to
    the chin, the mouth a third of the way on.
  - **Head:** temple, cheekbone, jaw angle and chin, rather than an oval.
  - **Eyes:** almond lids, a grey iris tucked under the upper lid with a catchlight, a lid crease and a faint
    lower lid. Women get a lash flick, and older faces bags under the eyes.
  - **Brows:** thick at the inner end, tapering to a fine tail.
  - **Nose:** a shadow-side bridge line, the wings, the underside of the tip and two nostrils.
  - **Mouth:** an upper lip with a cupid's bow. Men's lips are lightly washed; women's are filled in grey.
  - **Ears:** set from the brow to the nose base, with the rim's inner curve.
  - **Age:** grown men get faint lines from nose to mouth; older faces get crow's feet and a lined brow.
- **Lighting:** from one side, laid in by planes. Soft grey (`SHADE`) covers:
  - the far side of the face, turning away;
  - the eye sockets;
  - beside and under the nose, and under the lower lip;
  - under the chin, and under a hat brim.

  The head's outline is thin on the lit side and heavier on the shadow side.
- **Ink feel:** a light displacement filter wobbles the lines, and faint grain sits on top.
- **Real pictures later:** [PORTRAITS.md](PORTRAITS.md) is the brief for replacing these drawings with
  drawn or generated image files in the same style.
- **One look per job (`KITS`):** the suspect's archetype picks the hat, hair, clothes, facial hair and
  props. Their id varies the face: proportions, which side is lit, jaw and chin.
- **Deterministic:** a suspect looks the same everywhere (wall, board cards), with no randomness outside the
  seeded generator.
- **Adding a suspect:** give the new archetype a kit. Tests fail when an archetype has none, or when any
  part produces invalid SVG.
- **Using them:** `portraitUri(suspect)` gives an `<img>` source. `portraitSvg(suspect, prefix, attrs)`
  nests one inside another SVG, keeping its ids under the prefix.

## 7. The game board (Shadow Duel)
- **Suspect cards** (`game/SuspectCard.tsx`) are index cards: the portrait cropped to its top square
  (the face and shoulders, as big as the card allows), a file number in the corner, and the name in
  the condensed display face.
  - **The whole name always shows.** The card is a size container, and a long name shrinks to the
    card's width (`--chars` is its length) instead of being cut off with an ellipsis.
  - **Marks:** a dead suspect goes grey under a red grease-pencil X with the name struck through. A
    cleared suspect gets a "Cleared" stamp: solid blue on an opaque paper label with a paper margin,
    so it reads over the darkest portrait, sized to fit the card in either language.
  - **Lit in brass:** what can be picked right now; everything else on the board fades back.
  - **Red ring:** what you chose. **Blue glow:** your own identity, only while you hold your file open.
- **The board** (`game/Board.tsx`) is a grid keyed by suspect id. After a shift or a collapse each card
  glides from where it was, and a card that wrapped around slides in from the edge. Reduced motion
  turns this off.
- **TV:** the board on the left, on its own dark slate so the cards read cleanly against the wall. It
  is as tall as the screen allows between the masthead and the overscan margin, with row and column
  numbers that match the case log ("row 3"). The line that moved last is highlighted. On the right, on
  a second slate:
  - who plays which side, with the player to move marked;
  - the turn, and the kill tally in strokes of five;
  - what's happening ("Ann to move."), and the case log, newest first.
  - At the end, the verdict stamp, who won and why, and everyone's real identity and hand. The case
    log steps aside then, so the panel stays on screen.
- **Phone, the player's turn: choose, then target, then confirm.**
  - The action bar offers the verbs (Kill, Disguise, Collapse…), side by side so the board stays in
    view, and the phone's mini-board has shift arrows on every edge.
  - **Targets are lit only after choosing Kill or Accuse.** Lighting them all the time would show your
    neighbours, and so roughly where you stand, to anyone glancing at the phone.
  - Every move ends with a confirm button that names it ("Kill Dorothy", "Shift row 2 right"), with
    Cancel beside it.
  - **Collapse:** a line with a single body picks itself. You tap a body only where a line has several.
  - **Drawn cards** (the inspector's identity, the card to clear) replace the board with a 2×2 pick.
- **The player's file** sits above the board and holds the secrets: identity and evidence in hand.
  - It stays face down until pressed and held (or Space/Enter held), and closes on release.
  - It keeps its size open or closed, so the board never jumps.
  - Private draws never appear in the phone's visible case log.
- **Help:** a "What can I do now?" list of your role's actions, and the "How to play" walkthrough.

## 8. How to play
- **Pages** (`game/guides.ts`): each mode has its own walkthrough pages, in our own words. A page has a
  title, a few sentences and, optionally, a small picture of the city: you, your neighbours, a body, a
  row on the move.
- **Where it shows:**
  - On any phone, from the lobby or during a game.
  - On the TV, when the VIP presses "Show on the board": the board shows a folder with the VIP's
    current page and follows it as they page through. Everyone else's phone says so.
- **Adding a mode:** give it pages in `GUIDES` and texts under `guide.<mode>` in both languages. Tests
  fail when any page lacks a text.

## 9. Layouts
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

## 10. Interaction rules
- **Two taps for anything that affects others:** remove a player, leave, end the game. The first tap
  arms the button (red outline, new label), and it disarms after 4 s. Game moves use the same idea: the
  first tap chooses, a named confirm button acts.
- **Russian words agree with a suspect's gender** ("Ада убита", "Бруно убит") through the `_f`/`_m`
  i18n forms. Players' genders are unknown, so sentences about players avoid gendered verbs.
- **Errors say what happened and what to do,** in the interface's voice ("No room has the code BKTR.
  Check the code on the board."). The server sends codes; the texts live in `web/src/i18n/`.
- **Connection trouble is a blue bar at the top.** Refusals and timer nudges flash for 5 s above the
  action bar.
- **Hints are descriptions, not part of a field's name** (`aria-describedby`).

## 11. Notes for later
- **The game's name stays "Precinct Noir" in Latin letters in every language,** since it is also the
  address players type. Never translate it as «Нуар»: that is the Russian edition title of another game.
