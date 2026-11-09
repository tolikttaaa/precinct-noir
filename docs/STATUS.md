# Precinct Noir: status and resume guide

> **Purpose:** this is the single place to see what the project should become, what is already
> built, and what is next, so development can resume from any point (a new session, a new agent,
> or after a break). Update it in every milestone PR.
>
> **Last updated:** 2026-11-09. **`v0.1.0` is released and live:** Shadow Duel (M5–M5c), versioning (V) and the new home screen (H). P3 (the rules as typed pages in a file, and sound) and P4 (music and game sounds) are in review. Next up: Spy Ring (M6).
>
> **Legend:** ✅ done and merged · 🟡 done on a branch / PR open · ⬜ not started · ⚠️ known issue or follow-up

Detailed design lives in [ARCHITECTURE.md](ARCHITECTURE.md), and the rules (which are also the engine
spec) in [RULES.md](RULES.md). This file summarises them and tracks progress against them.

---

## 1. How to resume

1. **Read, in this order:** this file, `CLAUDE.md` (hard rules and commands), `docs/ARCHITECTURE.md` (§Milestones and §Engine design), `docs/RULES.md` (the section for the mode you're working on).
2. **Check where things stand:**
   ```bash
   git fetch --prune && git status && git log --oneline -10
   gh pr list --state all -L 15            # open PRs = unfinished milestones
   gh run list -L 5                         # CI and deploy health
   gh release list -L 3                     # releases (each one deployed)
   curl -sS https://precinctnoir.ttaaa.dev/api/config   # the version that's live
   curl -sS https://precinctnoir.ttaaa.dev/actuator/health
   ```
3. **Toolchain:** JDK 25 (the Gradle daemon is pinned), Node 24, and Docker (needed for Testcontainers and the image).
   ```bash
   ./gradlew check                          # all JVM tests + coverage gate
   cd web && npm ci && npm run test:coverage && npm run build
   ```
4. **Workflow rules (agreed with the owner):**
   - Before a big piece of work, put the open questions to the owner first; don't re-ask settled decisions.
   - Each milestone gets one feature branch and one PR. Never push to `main`. Merging doesn't deploy; the owner publishes a release, which does (RUNBOOK §5).
   - The owner runs every server-side and credential step; agents write copy-paste commands into `docs/RUNBOOK.md`.
   - Coverage stays near 100%. Never lower a floor to get a build through.
5. **Claude memory** (owner's machine): `~/.claude/projects/-Users-ttaaa-Projects-Personal-precinct-noir/memory/` holds decisions, workflow and progress. This file is the in-repo equivalent.

---

## 2. What we're building (spec summary)

- **Product:** a Jackbox-style web party game built on the *mechanics* of a hidden-identity
  deduction card game, with an **original identity**: title, ~60 characters, portraits, mode names and rules text are all our own.
  - **Screens:** one big screen (TV or laptop) shows the city; players join from phones or laptops with a 4-letter room code to see their secrets and act.
  - **Lobby and controls:** the first player is the VIP, who picks the mode, starts the game and can kick players. Remote play works without a TV.
  - **Languages:** EN and RU.
  - **Turn timer:** optional, and it only nudges; it never makes a move.
- **Six modes, built in this order:** Shadow Duel → Spy Ring → The Hit List → Cat Burglar → Feds vs. Mob → Casino Heist.
- **Stack:**
  - Pure-Kotlin deterministic `engine` (kotlinx.serialization only).
  - Spring Boot 4 / Kotlin 2 / JDK 25 `server` with raw WebSockets, room snapshots in Postgres JSONB.
  - React 19 + TypeScript + Vite `web`, served from the same container.
- **Hosting:**
  - The owner's home server runs the app behind Cloudflare (tunnel → Caddy → container) at `https://precinctnoir.ttaaa.dev`.
  - Contract: [HOSTING.md](HOSTING.md). Deploy: publishing a GitHub Release `vX.Y.Z` runs `build-and-deploy` → home-infra `deploy` workflow (RUNBOOK §5).
- **Security:**
  - Server-authoritative; per-viewer projections never leak secrets.
  - Abuse protection: Turnstile on room creation, Cloudflare rate rule, app-level rate limits, WebSocket limits, origin allowlist, strict CSP.

---

## 3. Milestones at a glance

| # | Milestone | Status | PR |
|---|---|---|---|
| M0 | Repo hygiene & English | ✅ | #1 |
| M1 | Walking skeleton (build, server, web, image, CI/CD, first deploy) | ✅ (live) | #2, #7 |
| M2 | Engine core + Shadow Duel (Killer vs Inspector) | ✅ (rules only; not playable yet) | #9 |
| M3a | Platform: rooms, lobby, WS protocol, persistence, restore, shutdown, codegen | ✅ (live; no UI yet) | #11 |
| M3b | Security: rate limits, Turnstile, WS limits, CSP nonce | ✅ (live) | #12 |
| M4 | Look and feel, home, join flow, lobby on TV and phone, EN/RU | ✅ (live) | #13 |
| P | Suspect portraits, evidence-wall background, realistic folders | ✅ (live) | #14 |
| M5 | Shadow Duel board and game UI → **release v0.1, first playable** | ✅ (live) | #15 |
| M5b | Browser end-to-end tests in CI (TV, laptop, phone) | ✅ (live) | #18 |
| M5c | Clearer turns: action tabs, reasons, drawn cards in the city, a full-screen file, a laptop layout; a collapse in the browser games | ✅ (live) | #19 |
| P2 | Picture portraits (files, with a drawn fallback) and the brief and prompts for making them | ✅ (live) | #16 |
| P2b | The 60 approved portrait pictures, and the drawing fixed to match | ✅ (live) | #17 |
| V | Versioning: the deployed version on screen; releases (tags on GitHub) are the only deploys | ✅ (live, v0.1.0) | #22 |
| H | Home: host and join folders the same size, and a game-type choice (owner's request) | ✅ (live, v0.1.0) | #23 |
| P3 | The rules as typed pages in a case file, turned one by one with animation, and sound (owner's request) | 🟡 PR open | #24 |
| P4 | Noir background music on the board and the home screen, and a sound for each action in the game (owner's request) | 🟡 PR open | #25 |
| M6 | Spy Ring | ⬜ | – |
| M7 | The Hit List | ⬜ | – |
| M8 | Cat Burglar | ⬜ | – |
| M9 | Feds vs. Mob | ⬜ | – |
| M10 | Casino Heist | ⬜ | – |
| M11 | Hardening & polish, incl. remote-play polish | ⬜ | – |

**Next action:** the owner reviews P3 (screenshots on phones, a tablet, laptops and the TV) and P4 (a recorded round with its sound) and merges them, P3 first, then publishes `v0.1.1`. Then a real session on the TV, and Spy Ring (M6), which starts with questions to the owner.

**Order of the next steps** (owner's choice, 2026-11-06; changed 2026-11-07): portraits first after all, because the owner asked for an evidence-wall background with the suspects on it, then the playable board. M5 then makes Shadow Duel playable, with the portraits on its case-file cards. Every later mode ships with its own UI in its milestone. TV + phones get the polish first; remote play on one's own device is polished last (M11).

---

## 4. Done: what exists and where

### M0: repo hygiene ✅
- [x] Copyrighted PDFs and box art purged from git history; local copies sit in the gitignored `reference/` (read for mechanics only, never copy or commit).
- [x] Backup of the old history: `~/Projects/Personal/noir-game-backup-20261106.git` (can be deleted once the owner is happy).
- [x] English README, `docs/RULES.md` (own words, pinned edge-case IDs), `docs/ARCHITECTURE.md`, `shared/roster.json` (60 original characters, ids 0–59, 30 f / 30 m).
- [x] Repo renamed to `tolikttaaa/precinct-noir`; local directory `~/Projects/Personal/precinct-noir`.

### M1: walking skeleton ✅ (live since 2026-11-06)
- [x] **Gradle:** 9.9.0 (checksum-pinned wrapper), version catalog, modules `:engine` and `:server`, daemon pinned to JDK 25.
- [x] **Server** (`server/`):
  - Spring Boot 4.1.2, virtual threads, graceful shutdown, Flyway (`V1__app_meta.sql`), actuator `health` only.
  - SPA hosting with client-route fallback; hashed assets cached for a year.
  - `SecurityHeadersFilter`: strict CSP, nosniff, frame deny, HSTS, Referrer and Permissions policies.
  - `/ws/echo` diagnostic (removed in M4; the game socket is `/ws` since M3a).
  - Config: production values from env (no default credentials); `dev` profile matches `compose.dev.yaml`.
- [x] **Web** (`web/`): Vite 8, React 19 with the React Compiler, ESLint, Prettier, Vitest; a placeholder landing page (replaced in M4).
- [x] **Image:** 3-stage `Dockerfile` (node → JDK 25 → JRE 25), uid 1000, Spring Boot layers, a `bash /dev/tcp` health check (the JRE image has no curl), linux/amd64.
- [x] **CI/CD:**
  - `ci.yml`: three required checks, *Engine & server (Gradle)*, *Web client* and *Docker image (build only)*.
  - `deploy.yml`: the home-infra template with `APP_NAME=precinctnoir` and `--ref main`.
  - Dependabot, which ignores majors for the node/temurin images, `@types/node` and `typescript`.
- [x] **Branch protection:** ruleset *Protect main* (id 26715638) requires a PR and the 3 checks, and blocks deletion and force-pushes; admins may bypass. There is no classic protection.
- [x] **Coverage gates:**
  - JVM: Kover on the JaCoCo 0.8.16 engine, ≥ 90% lines and ≥ 85% branches, aggregated, with test helpers excluded.
  - Web: Vitest V8, ≥ 95% lines/statements/functions and ≥ 90% branches.
  - Both currently sit at about 99–100%.
- [x] **Docs:** `CLAUDE.md`, `docs/HOSTING.md` (only the app-facing §1–§6; server ops stay private in home-infra), `docs/RUNBOOK.md`.
- [x] **Production checks:** health returns `UP`, the WS echo works through Cloudflare, a foreign-origin handshake gets 403, and headless Chrome renders the page at phone, laptop and TV sizes.

### M2: engine core + Shadow Duel ✅ (PR #9)
Package `dev.ttaaa.precinctnoir.engine`; the full shared core was built now, at the owner's request.

| Area | File(s) | Status |
|---|---|---|
| Ids, roster size | `core/ids/Ids.kt` | ✅ `SuspectId` 0..59, `Seat` |
| Deterministic RNG | `core/rng/Rng.kt` | ✅ SplitMix64, persisted `RngState` |
| Geometry | `core/board/Grid.kt` | ✅ `N(X)`, `N[X]`, straight/diagonal within d, k×k squares, row-major order |
| Tiles: markers and tokens | `core/board/Tile.kt` | ✅ exonerated, arrested, officer(stunned), treasure/protection/threat/bomb; they travel with the suspect |
| Board ops | `core/board/Board.kt` | ✅ shift ±1/±2 + `ShiftRecord.forbids` (modular undo), swap, kill, collapse (per-line picks, multi-collapse), token/marker ops |
| Casino Heist zones | `core/board/HeistGeometry.kt` | ✅ quadrants (`HX-1`), cross, centre, zones touching a cell |
| Cards | `core/cards/Cards.kt` | ✅ `Deck` (draw, drawN, putBottom, shuffleIn), `PlayerSecret` |
| Shared rule helpers | `core/rules/Rules.kt` | ✅ `EvidencePlacement` (`KI-2`), `IdentityDraw.drawLiving`, `Queries` |
| Flow | `core/flow/Flow.kt`, `core/api/FlowMode.kt` | ✅ `Agenda` (LIFO steps + ≤ 1 `Pending`), `GameState` (pending xor outcome), `Tx`, step driver |
| Options and choices | `core/legal/Options.kt` | ✅ Simple, Shift, Collapse, Target, Pair, Pick, TokenMove, Square, Vault; `Opt.accepts` |
| Events and audiences | `core/events/Events.kt` | ✅ `EventRecord<E>`, Public / Player / Team |
| Views | `core/view/Views.kt` | ✅ `Viewer`, whitelist `BoardView`, `PendingView` |
| Mode API | `core/api/GameMode.kt`, `ErasedMode.kt`, `ModeRegistry.kt` | ✅ typed `GameMode`, JSON boundary `AnyMode`, registry |
| Persistence format | `core/persist/Persist.kt` | ✅ strict `EngineJson` (`"t"` discriminator), `Migration` chain |
| Shadow Duel | `modes/killerinspector/*` | ✅ all actions, `KI-1`…`KI-8`, `interrogateDeadOnBoard`, `killerSeat` (rematch swap) |
| Test fixtures | `engine/src/testFixtures/.../testing/*` | ✅ `BoardAscii`, `Arbs`, option sampler, `playout`/`replay`, `CardLedger` |
| Tests | `engine/src/test/...` | ✅ properties, legacy-bug regressions, rules per KI-ID, scenarios, ~12k-step playouts, leak (non-interference) tests, golden `v1.json` |

**Engine pieces deliberately left for later** (they arrive with the first mode that needs them):
- ⬜ **Limbo** (drawn-but-unassigned cards shown only to the decision's actor): Copycat and Detective.
- ⬜ **Team-visible projections and `teamOf`** for real teams: Spy Ring agencies, Feds vs. Mob, Heist thieves.
- ⬜ **Pending kinds that are defined but unused so far:** `TRIGGER`, `REACTION` (Protect), `FORCED` (Cat Burglar's free grab).
- ⬜ **Theft tokens and vault state:** these sit on vaults, not suspects (Casino Heist model).
- ✅ **Turn-timer wiring:** the M3a room sweep sends `nudge` once per pending decision after the lobby's timer.

---

## 5. To do: specification of the remaining work

### M3a: platform ✅ (PR #11, live)
**Goal:** a real room lifecycle around the engine, with persistence and reconnects. No new game UI yet.
Settled with the owner: two PRs (M3a platform, M3b security); seats go to the earliest players and the VIP
removes players before starting; the VIP can end a running game; a game idle for 2 h ends. The TV gets its
own host token; expired rooms are deleted from the database.

Done, all in `server/` (details in [PROTOCOL.md](PROTOCOL.md)):
- [x] **Room HTTP API** (`api/RoomController.kt`): `POST /api/rooms`, `POST /api/rooms/{code}/players`, `GET /api/rooms/{code}`, `GET /api/modes`; errors are i18n codes. Strict kotlinx JSON, not Jackson.
- [x] **Identity** (`room/Identity.kt`): consonant-only room codes with a blocklist; 128-bit base64url tokens stored as SHA-256 and compared in constant time; NFC names without invisible/bidi characters, 1–16 characters, unique per room.
- [x] **Rooms as actors** (`room/RoomService.kt`): per-room lock; validate → engine → persist → fan out. Lobby commands for the VIP (mode, switches, timer, kick, start, end game, play again); players may leave between games.
  - Seats: the earliest players up to the mode's maximum; everyone else gets the spectator view.
  - "Play again" swaps Shadow Duel roles through the engine's new `rematchConfig` hook, only for the same mode and line-up.
  - `clientSeq` deduplication per sender, persisted so it survives restarts.
- [x] **WebSocket gateway at `/ws`** (`ws/GameWebSocketHandler.kt`): hello within 5 s, origin allowlist, 4 KB frames, text only, 20 msg/s per socket, pings every 25 s and a 60 s dead timeout, `ConcurrentWebSocketSessionDecorator` send limits. (`/ws/echo` was removed in M4.)
- [x] **Persistence** (`V2__rooms.sql`, `room/JdbcRoomRepository.kt`): `rooms` (snapshot JSONB), `room_commands` (append-only), `room_events` (case log with audiences), one transaction per change, saved before anyone is told.
- [x] **Restore at startup** before the web server accepts connections; unreadable games end with `restore_failed`, and unknown lobby modes fall back to the default.
- [x] **Graceful shutdown** (`config/PlatformConfig.kt`): every socket closes with 1012 before Tomcat's graceful shutdown.
- [x] **Sweeps:** lobby 30 min / finished 15 min expiry, 2 h idle game end, and turn-timer nudges (once per decision, never a move).
- [x] **Basic caps:** ≤ 300 rooms, ≤ 9 players per room.
- [x] **Protocol codegen:** `ProtocolTypesTest` generates and checks `web/src/protocol/generated.ts`; `./gradlew :server:generateProtocol` rewrites it.
- [x] **Engine API additions:** `AnyMode.view` returns typed `legal` options; `isVisible` takes the audience; `rematchConfig`.

Tests (209 JVM tests at merge; 99.87% lines / 98.41% branches overall): room-service unit tests with fakes (lobby, seats, every refusal, a full game, rematch, dedupe, failed saves, reconnect, TTLs, timer, restore), transport tests with a fake socket, identity tests, and `PlatformIT` against Postgres (HTTP API, a game over real sockets, reconnect, hello rules, origin and frame limits, pings, and a **second app instance restoring the game from the database and closing with 1012 on stop**).

Not done in M3a (by design): the web client doesn't use the protocol yet (M4/M5), and the uncovered branches are room-closed race guards.

### M3b: security ✅ (PR #12, live)
Everything below is described for readers in [SECURITY.md](SECURITY.md); code in `server/.../security/`.
- [x] **Client identity** (`ClientIp`): `CF-Connecting-IP`, else the peer; IPv6 grouped by /64; no DNS lookups.
- [x] **Per-client HTTP limits** (`ApiGuard`, a Spring MVC interceptor; Bucket4j + Caffeine): create room 5 / 10 min, join 40 / 10 min, non-existent codes 10 / min (then every lookup waits), all `/api` 120 / min. `429 rate_limited` + `Retry-After`.
- [x] **Origin check** on state-changing `/api` requests (`403 forbidden_origin`).
- [x] **Turnstile** on `POST /api/rooms` (`{turnstileToken}`): siteverify with a hostname check, fail-closed (`503 captcha_unavailable`) without a secret or when Cloudflare is unreachable; Cloudflare's test keys in the dev profile; `GET /api/config` hands the site key to the web client.
- [x] **WebSocket limits:** a per-socket token bucket (burst 20, then 10 / s → 1008) replaced `RateWindow`; ≤ 30 sockets per client and ≤ 3 000 in total (`SocketGuard`: handshake 429, atomic slot on open, 1013 if a socket loses the race), on `/ws` (and on `/ws/echo` until M4 removed it).
- [x] **CSP nonce** per response for Cloudflare's injected bot-detection script; Turnstile's origin in `script-src` and `frame-src`; HTML served `no-store`.
- [x] **Log privacy:** clients appear as HMAC pseudonyms (key never leaves memory); refusal logs throttled to one line per client per minute; no tokens or bodies logged.
- [x] `docs/SECURITY.md`; PROTOCOL and RUNBOOK §4 updated.
- [x] Tests: unit tests for each piece (`ApiGuardTest`, `SocketGuardTest`, `TurnstileTest` against a local siteverify stub, `RateLimiterTest`, `ClientIpTest`) and `SecurityIT` (all limits, Turnstile outcomes, origin check, socket caps, wired into the running app). 235 JVM tests; 99.71% lines / 98.57% branches.
- [x] **Checked in production after the merge:** headless Chrome shows no console errors (Cloudflare's injected script carries the nonce); `/api/config` returns the site key; a forged token gets `403 captcha_failed`.

### M4: look and feel, lobby, join flow ✅ (PR #13, live)
Design system and reasoning: [DESIGN.md](DESIGN.md). Code: `web/src/`.
- [x] **Design tokens and type:**
  - Night ink, manila case files, stamp red, evidence blue, brass; blind-light and film grain.
  - Self-hosted Sofia Sans (+ Extra Condensed) and Cousine, all with Cyrillic.
  - Assets are never inlined, because of the CSP.
- [x] **Home** (`/`): host a game (Turnstile, invisible) or join by code.
- [x] **Board screen** (`/tv/CODE`): the stamped room code, a QR code and the join address, the line-up (join order = who plays; VIP stamp; offline), status, and the mode summary. Shows "game on" and "case closed" states.
- [x] **Phone** (`/CODE`):
  - Join form (room lookup, name), then the lobby.
  - The VIP edits the game, house rules and turn timer, removes players and starts. Everyone else sees the rules read-only.
  - Two-tap Leave, End game and Remove; Play again.
  - Endings: removed, left, closed, gone.
  - A game that stops early (the VIP ends it, idle timeout, failed restore) drops everyone back to the lobby with a note saying why.
- [x] **Connection client** (`net/roomSocket.ts`):
  - Hello and resume from the last event.
  - Jittered backoff reconnects (deploys, drops, overload); stops for good on kick, leave, close or bad token.
  - Numbered commands, resent after a reconnect. The command counter is saved per room.
- [x] **i18n:** English and Russian (i18next, typed keys, Russian plural forms); the language follows the browser and can be switched.
- [x] **Accessibility:** visible focus, reduced motion, 44px targets, hints as descriptions, live regions for status.
- [x] **`/ws/echo` removed** (its flood check moved to `/ws`).
- [x] **Tests:**
  - 64 web tests; 100% lines, 98.88% branches.
  - The React Compiler is skipped under Vitest so coverage counts our branches, not its cache checks.
  - Checked in headless Chrome against the Spring-served build: no console errors under the real CSP, including Turnstile.
- [ ] Laptop-specific polish → M11 (owner's choice: TV + phones first).

### M5: Shadow Duel playable end-to-end → v0.1 ✅ (PR #15, live)
Owner's choices (2026-11-08): a mini-board on each phone, the identity behind hold-to-reveal, and both a
phone guide and a TV walkthrough. Design notes: [DESIGN.md](DESIGN.md) §7–8.
- [x] **Suspect cards:** the portrait, name and file number; Russian names for all 60 (`i18n/suspectNames.ts`).
- [x] **Board:** a grid keyed by suspect id. Shifts and collapses glide (Web Animations, no new dependency), and wrapped cards slide in from the edge.
- [x] **TV:** the board with row and column numbers and the last shift marked, plus the sides, turn, kill tally, prompt, case log, deck and face-up cards. At the end, the verdict and the reveal.
- [x] **Phone controls:**
  - Choose a verb, then a target on the mini-board or an arrow on its edge, then confirm with a named button.
  - The collapse picks bodies only where a line has several, and drawn cards appear as a 2×2 pick.
  - Controls come back after a refusal.
- [x] **The player's file:** hold-to-reveal identity and hand above the board, which also lights your card on the board while held.
- [x] **Case log** in EN/RU from the events. Russian agrees with each suspect's gender, and private draws stay out of the phone's visible log.
- [x] **"How to play"** (9 pages, own wording, EN/RU) on phones in the lobby and in game, and a "What can I do now?" list.
- [x] **TV walkthrough:** a new `show_guide` command (VIP, lobby) puts the VIP's page on the board.
- [x] **Fix:** the engine's role enum is now `ShadowDuelRole`. It used to share the TypeScript name `Role` with the room's host/player role, and the generator now fails on such clashes.
- [x] **Tests:**
  - Web: 151 tests; 100% lines, 99.5% branches.
  - JVM: `check` green, with a test for the new command.
  - Played start to finish in Chrome (TV + two phones, one in Russian).
- [x] **M5b: browser games in CI** (`e2e/`, Playwright 1.64.1; branch `m5b/e2e`).
  - **One session, on a TV (1920×1080) and two phones (390×844):** Ann in English and Борис in Russian.
    1. The TV opens a room and both phones join.
    2. Round 1: Ann (VIP) starts it. The inspector clears a suspect once, then slides the killer next to them and accuses.
    3. Ann starts a rematch from the same room.
    4. Round 2: the killer's phone reloads just before its turn and makes the move, then the killer hunts down the inspector.
  - **Checks:** each verdict on the TV and both phones; the TV never shows a file or anyone's own card; no errors in any console.
  - **How it plays:** the test reads each player's identity by holding their file open, as a person can. It plans shifts with `e2e/support/grid.ts`, and finds buttons by the app's own EN/RU texts.
  - **No seed endpoint, unlike the plan:** deals are random, so the production server carries no test-only code, and every run covers a new deal. 40 runs in a row passed.
  - **CI:** job `Browser games`, against the production image plus Postgres (`e2e/compose.yaml`) with Cloudflare's Turnstile test keys. It keeps a video of all three screens (`e2e/videos/session.mp4`) for 14 days when it fails, or when run by hand with "video" ticked.
  - **The video:**
    - Each screen is recorded through Chrome's screencast (`support/recorder.ts`), and every frame is stamped with one shared clock.
    - `stitch.mjs` places the frames on a common 25 fps timeline, so the TV and both phones stay in step to within a frame, reloads included.
    - Playwright's own video files couldn't be lined up: they drop the still stretches at their start and end.
    - Every tap shows as a ring (`support/taps.ts`), including the press-and-hold that opens a player's file.
- [x] **M5c: clearer turns on the phone** (PR #19, merged 2026-11-08 and live; the owner asked for it after watching the M5b video).
  - [x] **Action tabs** (`DuelPhone.tsx`): Kill / Disguise / Shift / Collapse, or Accuse / Clear a suspect / Shift / Collapse. Switch freely, with no Cancel. The open tab explains its action and shows it on the board.
  - [x] **Unavailable actions** keep their tab, with a dotted underline and the reason: the first move, no one next to you, an empty deck, or a city that can't collapse yet.
  - [x] **A turn opens on Shift,** so lit targets never show onlookers where you stand (DESIGN §7).
  - [x] **Drawn cards in the city:** while the inspector picks an identity or the card to clear, a switch shows "Cards" or "In the city", where the same cards are lit. A choice on either shows on both, and a dead suspect's card keeps its X.
    - The owner chose the switch from three layouts (cards above the city, the switch, or the city only), shown as screenshots on 2026-11-09.
  - [x] **The player's file** (`Dossier.tsx`) is a slim strip now. Held, it opens over the whole screen with the identity, the evidence and the city; the game's board no longer marks your tile.
    - In the file's city, your tile is outlined solid blue and your evidence dashed; the labels carry the same marks as a key.
    - Bigger hands wrap four to a row, and the city shrinks to the height that's left. Checked with hands of 3, 4, 6 and 8 cards.
    - On a laptop (wide, landscape) the open file is a spread: you and your evidence left, the city right.
  - [x] **The verdict comes into view** when a round ends. The laptop test found it hidden above the fold after a kill low on the board.
  - [x] **The game on a laptop** (from 1024px wide, landscape) is one screen with nothing to scroll: the board at full height on the left; the prompt, the file, the tabs, the confirm bar, the tally and the log on the right. The owner asked for it after seeing the laptop screenshots. The browser games check it on every laptop move.
  - [x] **The video** shows the TV on top and the laptop and phone side by side under it, with brass lines between them (the owner's layout). The TV is recorded at 1600×900.
  - [ ] Still for M11: the hints say "Tap" on a laptop, and the lobby keeps the phone's column.
  - [x] **Texts:** kill and accuse say "one of the eight tiles around you"; collapse says when it's possible.
  - [x] **Browser games:** Ann now plays from a laptop (1440×900, mouse) and Борис from a phone (390×844, touch), so every step runs on both layouts; the laptop's open file is checked to be a spread. The CI job is now just `Browser games` (renamed in #18 before it joins the ruleset). Round 1 builds up to a collapse and makes it, checking that the TV loses a line. The phones go through the tabs; the opening move checks the other tabs' reason; the inspector lights the accuse targets, then switches to clearing a suspect. The pick is checked in both directions between the cards and the city.
- [ ] **Release v0.1**, then a real session with phones and the TV.

### P: portraits, evidence wall, realistic folders ✅ (PR #14, live)
The owner asked for this after seeing M4 (2026-11-07): a background like a detective's evidence wall with
the suspects on it, and folders that look real. Design notes: [DESIGN.md](DESIGN.md) §5–6.
- [x] **Portrait generator** (`web/src/portraits/portrait.ts`):
  - Original "bold ink" busts for all 60 roster suspects, with one look per job and the face varied by id.
  - Deterministic, and nestable with unique ids.
- [x] **Evidence wall** (`portraits/wall.ts`, `components/EvidenceWall.tsx`):
  - A corkboard with twelve suspect cards, a district map, clippings, polaroids, a fingerprint card and red string, under venetian-blind light.
  - Shown behind every screen; dimmed and blurred on phones (owner's choice).
- [x] **Realistic folders:** back panel with a labelled tab, peeking sheets, a thumb cut, a paperclip and paper fibre. A dark slate sits behind the TV line-up.
- [x] **Roster in the web client:** imports `shared/roster.json` (`resolveJsonModule`; Vite `server.fs.allow`).
- [x] **Tests:**
  - 80 web tests; 100% lines, 99.23% branches.
  - Every part (hats, hair in each tone, outfits, facial hair, props) is drawn on both sides of the light and parsed as SVG. A single bad attribute would silently blank the image.
- [x] **Speed:** the wall builds in about 1 ms of script. Chrome draws it off the main thread, and the page is ready in 0.25 s even at 6× slower CPU.
- [ ] Check the wall on a real smart-TV browser after deploying. If it draws slowly there, pre-render it into an image at build time.
- [x] **Game name:** stays "Precinct Noir" in Latin letters in Russian too (owner asked; never «Нуар», the Russian title of another game).

### P2: picture portraits ✅ (PR #16, live); the approved pictures ✅ (P2b, PR #17, live)
- [x] The portraits become a black-and-white sketch: ink line with grey wash on cream paper, both eyes drawn,
  soft shading instead of solid-ink shadow. Same suspects, parts and ids, so the wall and the board change
  together.
- [x] `docs/PORTRAITS.md`: the brief for 60 image portraits in this style (rules, style, file format, the
  roster table).
- [x] The drawn faces drawn like people: real proportions, eyes, nose, lips and ears, and soft shading
  by planes; the figure is drawn closer, so the face fills the card's square.
- [x] Picture portraits: files in `web/src/portraits/images/` named by id show on cards and the wall; the
  drawn portrait stays for anyone without one. `docs/PORTRAITS.md` has a ready prompt for each suspect.
- [x] P2b, after PR #16 was merged: the drawing restyled after the reference cards' general look (brush ink, solid blacks, hatching,
  sepia parchment, a three-quarter turn, stronger expressions) and exported as the 60 pictures in
  `web/src/portraits/images/`, so the game shows static pictures now.
- [x] The owner chose a look between production and the ink version: the sketch version's faces, soft
  shading and detailed eyes, line and deep wash, on a plain grey wall. Then they
  reviewed all 60 by number, and every flagged glitch was fixed: hair under hats, glasses, beards, stubble,
  messy, wild and ponytail hair, the pencil behind the ear, Opal's loupe and Vera's far earring. The 60
  pictures are exported from that drawing, and the owner approved them (2026-11-08).
- [ ] The owner makes the 60 pictures (an artist or an image generator); an agent converts them to
  512 × 512 WebP and adds them.

### P3: the rules as pages in a file, and sound 🟡 (PR #24)
The owner asked: rules that look like separate papers in a file, turned one by one, animated, with sounds in the main
menu and on the page turns.
- [x] **Typed sheets in a case file** (`game/PaperStack.tsx`, `game/paper.css`): a steel fastener at the top; a turned
  page bends like paper (the owner asked for a more realistic flip): it rolls up from the bottom edge to the fastener,
  showing its back and shading the page beneath, and going back unrolls it; the sheets still to read show their edges. Every sheet is as tall
  as the longest page, so the file doesn't change size from page to page (the owner noticed it on the TV). Swipe, the arrow keys or
  Back/Next turn the pages; reduced motion just changes the page. The TV shows a wide sheet that follows the VIP.
- [x] **Pictures you can read, with a key** (owner's review): the killer and inspector squares had lost their colours on
  the paper (a rule for plain squares covered them). Now every mark is a colour and a sign (K/I, ✕ for a body, ✓ for
  cleared), and a key under each picture names the marks it uses, in EN and RU.
- [x] **The buttons stay at the thumb:** on a phone, Back, Next, "Show on the board" and Close sit in the bar at the
  bottom of the screen, in place of the lobby's or the game's bar (page 1's picture pushed them below the fold).
- [x] **Sound** (`web/src/sound/`): synthesised with the Web Audio API, so nothing is downloaded and the CSP is
  unchanged. Typewriter keys for the room code and stamps for the choices on the home screen; a folder and paper for
  the rules. A speaker switch beside the languages turns sound off on this device, remembered.
- [x] Built on a side branch while M5 was open, then moved onto `main` after `v0.1.0`.

### P4: music and game sounds 🟡 (PR #25, on top of #24)
The owner asked for background music with a noir atmosphere, and during the game a shot and other sounds for actions.
- [x] **Music** (`web/src/sound/music.ts`): an original slow jazz loop in D minor (bass, brushes, ride, piano, a muted
  trumpet every other time round), synthesised live and written a few seconds ahead on the audio clock, so a busy page
  never leaves a gap. It plays on the board and the home screen only, under its own switch (a note beside the speaker),
  at about 15 dB below the game sounds, and ducks under loud ones.
- [x] **Game sounds** (`game/sounds.ts`, `sound/useEventSounds.ts`): a sound per public Shadow Duel event (stamp, shot,
  slam, drawer, rumble, coat, cards, clock, a closing sting for each outcome). The board plays them; phones only when no
  board is connected. One action's sounds follow each other 0.4 s apart.
- [x] **Protocol:** `events` carries `replay: true` for what a client catches up on when connecting, so screens show it
  without sound (PROTOCOL §2.1).
- [x] Checked by recording a round on a TV, a laptop and a phone with the TV's audio captured on the audio clock: no
  gaps in the music, the game sounds stand clear of it, and each lands with what the board shows.

### M6–M10: remaining modes ⬜
Each mode follows the same recipe: engine rules + tests (every pinned ID) → projections → UI panels + tutorial (EN/RU) → E2E → deploy. Follow `CLAUDE.md` → *Engine conventions*.

| Milestone | Mode (id) | Players / city | Spec | Pinned IDs | New engine needs |
|---|---|---|---|---|---|
| M6 | Spy Ring (`spy_games`) | 3–6, 8, 9; 5×5 / 6×6 / 7×7 | RULES §3 | `SP-1`, `SP-2`, `SP-3`, `SP-6`; variants `teamsShareIdentities`, `sevenPlayers`, `forceFreeForAll` | agencies (teams), trophies, catch + redraw (`IdentityDraw`), interrogate N[T] |
| M7 | The Hit List (`hitman_sleuth`) | 2; 5×5 | RULES §4 | `HS-1`…`HS-3`, `HS-5`…`HS-7`; variant `hitListVisibleToHitman` | face-down hit list (never projected), escape, expose |
| M8 | Cat Burglar (`master_thief`) | 2; 5×5 | RULES §5 | `MT-1`…`MT-3`; variant `chiefChoosesOfficers` | treasure tokens, officer markers, quick disguise, FORCED free grab, optional match play |
| M9 | Feds vs. Mob (`fbi_mafia`) | 6 or 8; 6×6 / 7×7 | RULES §6 | `FM-1`…`FM-4`, `FM-6`, `FM-8`…`FM-14`; variants `fedsNeedOneMore`, `protectionConsumedOnUse` | 8 roles, team identities, arrests, bomb chains (`ChainNext`), threats, the Protect REACTION, deferred cleanup |
| M10 | Casino Heist (`heist`) | 5–7; 7×7 | RULES §7 | `HX-1`…`HX-12`; variants `officerCount`, `hiddenThiefRoles`, `shareIdentityUpdates`, `stunBlocksLineShift` | vault/theft-token state, overt/covert cadence, tiered role deck, Security Chief |

### M11: hardening & polish ⬜
- [ ] k6 load test and rate-limit verification (**local only**).
- [ ] `/security-review` before release.
- [ ] Accessibility pass and TV overscan check.
- [ ] Optional synthesized SFX.
- [ ] Remote play on one's own laptop or phone: polish the layouts for playing without a shared TV.
- [ ] Docs finalised.

### Owner's feature requests ⬜ (added 2026-11-09)

#### V: versioning ✅ (PR #22, live in v0.1.0)
The owner wants to see which version is deployed, and versions tagged on GitHub. Settled 2026-11-09:
- [x] **Scheme:** `vMAJOR.MINOR.PATCH`. `v0.1.0` is Shadow Duel, the first playable game; a minor bump per mode
  (`v0.2.0` with Spy Ring); a patch for fixes and small improvements; `v1.0.0` after M11.
- [x] **Releases are cut by hand and are the only deploys.** The owner publishes a GitHub Release (RUNBOOK §5);
  merging to `main` no longer deploys. `build-and-deploy` runs on a published release (or by hand from a tag):
  - it refuses tags that aren't `vX.Y.Z` or aren't on `main`, and skips pre-releases;
  - the image gets the version baked in (`APP_VERSION`, `APP_COMMIT`) and the tags `:<sha>`, `:vX.Y.Z`, `:latest`;
  - home-infra still deploys by the full commit sha; afterwards the workflow checks `/api/config` reports the version.
- [x] **Visible:** `GET /api/config` returns `version` and `commit` (absent in builds between releases). The home page
  and the TV lobby show "Version 0.1.0 · 1e96502", or "Development build".
- [x] **Published:** the owner released `v0.1.0` on 2026-11-09; production reports version 0.1.0, commit 2efa3c2.
- [ ] Optional: protect the version tags with a tag ruleset (RUNBOOK §5).

#### H: home screen ✅ (PR #23, live in v0.1.0)
- [x] **Host and Join folders the same size** side by side, with their buttons lined up along the bottom. Stacked on a
  phone they share the width, and each is as tall as what it holds (forcing equal heights left the Join folder
  half empty). The Join folder now also says the QR code on the board works.
- [x] **Choose the game type when hosting:** the Host folder lists all six games with their player counts (EN/RU names:
  Spy Ring / Шпионская сеть, The Hit List / Список целей, Cat Burglar / Домушник, Feds vs. Mob / Федералы против
  синдиката, Casino Heist / Налёт на казино).
  - The owner's idea (2026-11-09), after a list and a drop-down: the field pulls a **top-secret page** out of the
    folder with every game and what it's about (summaries for all six, EN/RU). Reviewed on 11 devices before merging.
  - The title and tagline shrink on small or short screens, so the folders show whole on the first screen (side by
    side everywhere from an iPad sideways up; the Host folder on phones).
  - A game is selectable when the server offers it (`GET /api/modes`); the others are greyed out as "Coming later". So each
    mode becomes selectable by itself as it ships (M6–M10).
  - `POST /api/rooms` takes `mode`, checked against the `ModeRegistry` before the bot check (`422 unknown_mode`).
  - The browser games pick Shadow Duel this way and check that Spy Ring can't be picked.
- [x] Fixed on the way: the home page scrolled sideways by a few dozen pixels (the title's shadow pool), in production too.
- [x] **Settled 2026-11-09:** keep both. The host picks the game on the home screen, and the VIP can still change it in the lobby (`set_mode`).

---

## 6. Owner steps (RUNBOOK)

| Step | Status |
|---|---|
| `new-app.sh precinctnoir` + Caddyfile commit (RUNBOOK §1.1) | ✅ |
| `HOME_INFRA_DEPLOY_TOKEN` (fine-grained, home-infra only, Actions read/write) (§1.2) | ✅ |
| Branch protection (§1.3): ruleset *Protect main* | ✅ |
| Add `Browser games` to the ruleset's required checks (§1.3) | ✅ 2026-11-09 |
| Turnstile widget + keys in `/srv/apps/precinctnoir/.env` (§4.1) | ✅ |
| Cloudflare rate-limiting rule on `/api/*` (§4.2) | ⬜ optional (edge layer on top of the app's limits) |
| Delete the history backup `~/Projects/Personal/noir-game-backup-20261106.git` | ⬜ optional |
| Publish release `v0.1.0` once V is merged (§5) | ✅ 2026-11-09 |
| Protect the version tags with a tag ruleset (§5) | ⬜ optional |

---

## 7. Known issues and follow-ups

- ⚠️ **CSP blocks Cloudflare's injected bot-detection script:** fixed in M3b (per-response nonce); confirm in production after the merge.
- ⚠️ **TypeScript 7 and `typescript-eslint`:** Dependabot ignores `typescript` majors (PR #4 was closed). Upgrade both together once `typescript-eslint` supports TS 7.
- ℹ️ **Turnstile and `style-src`:** the invisible test widget runs without CSP errors locally; confirm with the real widget in production after the M4 merge.
- ℹ️ **Shift options:** `Shift` lists explicit moves (not `amounts` + `forbidden`); the UI should render from `moves`.
- ℹ️ **Rendering the rulebook PDFs:** poppler isn't installed. Pages can be rendered with a small Swift/PDFKit script, for mechanics only.

---

## 8. Decisions log (settled; don't re-ask)

| Date | Decision |
|---|---|
| 2026-11-06 | Title **Precinct Noir**, app `precinctnoir`, package `dev.ttaaa.precinctnoir`, repo `tolikttaaa/precinct-noir` |
| 2026-11-06 | Mode order: Shadow Duel → Spy Ring → The Hit List → Cat Burglar → Feds vs. Mob → Casino Heist |
| 2026-11-06 | TV display-only; the first player is the VIP; remote play without a TV works |
| 2026-11-06 | EN + RU; optional turn timer (nudge only); Turnstile on room creation only |
| 2026-11-06 | Portraits: generated SVGs matching each character's gender + archetype; owner review before gameplay UI |
| 2026-11-06 | `docs/HOSTING.md` publishes only the app-facing §1–§6 of the private hosting guide |
| 2026-11-06 | Branch protection lives only in the *Protect main* ruleset |
| 2026-11-06 | Deploy dispatch uses `--ref main` so the deploy token stays Actions-only |
| 2026-11-06 | Shadow Duel roles: random first game; "Play again" swaps (`killerSeat`) |
| 2026-11-06 | M2 builds the full shared engine core for all modes |
| 2026-11-06 | JVM coverage measured with JaCoCo 0.8.16 (it filters serialization-generated code); floors unchanged |
| 2026-11-06 | The CSP nonce for Cloudflare's bot detection is part of M3 (M3b) |
| 2026-11-06 | M3 ships as two PRs: M3a platform, M3b security |
| 2026-11-06 | Seats go to the earliest players (mode max); the rest watch; the VIP removes players before starting |
| 2026-11-06 | The VIP can end a running game (UI confirms); a game idle for 2 h ends automatically |
| 2026-11-06 | Turnstile: build with Cloudflare's test keys; the owner adds real keys before M3b merges |
| 2026-11-06 | Room codes use consonants only (no words); the TV has its own host token; expired rooms are deleted |
| 2026-11-06 | Playable first: v0.1 uses case-file cards with silhouettes; the portrait generator and its review move to right after v0.1 |
| 2026-11-06 | Every mode ships with its own UI in its milestone |
| 2026-11-06 | Layout priority: TV + phones in one room first; remote play polished last (M11) |
| 2026-11-07 | Portraits pulled forward (bold ink style) for an evidence-wall background; phones get a dimmed wall |
| 2026-11-07 | The game's name stays "Precinct Noir" in Latin letters in Russian too |
| 2026-11-08 | M5 phones: a mini-board with choose → target → confirm; the identity behind hold-to-reveal; rules taught by a phone guide **and** a VIP-driven TV walkthrough |
| 2026-11-08 | Kill/accuse targets light up only after choosing the action, so a glance at a phone doesn't show where its player stands |
| 2026-11-08 | Portraits become **picture files** (hand-drawn noir comic style, ink with a sepia wash), not generated drawings; the drawings stay only as the fallback |
| 2026-11-08 | Portraits: no colour. The bold-ink look becomes a black-and-white sketch (ink line, grey wash, cream paper). Later, 60 drawn or generated image files in that style replace the drawings (brief: `docs/PORTRAITS.md`) |
| 2026-11-09 | Versions `vMAJOR.MINOR.PATCH`: `v0.1.0` = Shadow Duel; a minor bump per mode, a patch for fixes; `v1.0.0` after M11 |
| 2026-11-09 | The owner cuts releases by hand (a GitHub Release); only releases deploy, merges to `main` don't |
| 2026-11-09 | The game type is chosen on the home screen when hosting, and the VIP can still change it in the lobby |
| 2026-11-09 | The home screen's game choice is a top-secret page pulled out of the Host folder (every game, what it's about), not a list or a drop-down |
| 2026-11-09 | The rules are typed sheets in a case file, turned one by one; sound is synthesised in the browser, on by default, with a switch per device |
| 2026-11-09 | Music is original and synthesised in the browser; it plays on the board and the home screen only, with its own switch. Game sounds play from the board; phones play them only when no board is connected |
