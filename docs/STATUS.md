# Precinct Noir: status and resume guide

> **Purpose:** this is the single place to see what the project should become, what is already
> built, and what is next, so development can resume from any point (a new session, a new agent,
> or after a break). Update it in every milestone PR.
>
> **Last updated:** 2026-11-06. M3a (platform) is done on branch `m3/platform` (PR open); M3b (security) is next.
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
   curl -sS https://precinctnoir.ttaaa.dev/actuator/health
   ```
3. **Toolchain:** JDK 25 (the Gradle daemon is pinned), Node 24, and Docker (needed for Testcontainers and the image).
   ```bash
   ./gradlew check                          # all JVM tests + coverage gate
   cd web && npm ci && npm run test:coverage && npm run build
   ```
4. **Workflow rules (agreed with the owner):**
   - Before a big piece of work, put the open questions to the owner first; don't re-ask settled decisions.
   - Each milestone gets one feature branch and one PR. Never push to `main`: merging deploys to production.
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
  - Contract: [HOSTING.md](HOSTING.md). Deploy: the `build-and-deploy` workflow → home-infra `deploy` workflow.
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
| M3a | Platform: rooms, lobby, WS protocol, persistence, restore, shutdown, codegen | 🟡 PR open | `m3/platform` |
| M3b | Security: rate limits, Turnstile, WS limits, CSP nonce | ⬜ | – |
| M4 | Design system, portraits, lobby UI, i18n | ⬜ | – |
| M5 | Shadow Duel playable end-to-end → **release v0.1** | ⬜ | – |
| M6 | Spy Ring | ⬜ | – |
| M7 | The Hit List | ⬜ | – |
| M8 | Cat Burglar | ⬜ | – |
| M9 | Feds vs. Mob | ⬜ | – |
| M10 | Casino Heist | ⬜ | – |
| M11 | Hardening & polish | ⬜ | – |

**Next action:** after the M3a PR merges, start M3b (security) on a new branch; the owner adds Turnstile keys before it merges (see §5, M3b).

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
  - `/ws/echo` diagnostic: origin allowlist, 4 KB frames, 20 msg/s, binary refused. The landing page's "Wire is live" check uses it; it goes away in M4 (the game socket is `/ws` since M3a).
  - Config: production values from env (no default credentials); `dev` profile matches `compose.dev.yaml`.
- [x] **Web** (`web/`): Vite 8, React 19 with the React Compiler, ESLint, Prettier, Vitest; a placeholder noir landing page with a live "wire check" over the WebSocket.
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

### M3a: platform 🟡 (PR open, branch `m3/platform`)
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
- [x] **WebSocket gateway at `/ws`** (`ws/GameWebSocketHandler.kt`): hello within 5 s, origin allowlist, 4 KB frames, text only, 20 msg/s per socket, pings every 25 s and a 60 s dead timeout, `ConcurrentWebSocketSessionDecorator` send limits. `/ws/echo` stays until M4 replaces the landing page.
- [x] **Persistence** (`V2__rooms.sql`, `room/JdbcRoomRepository.kt`): `rooms` (snapshot JSONB), `room_commands` (append-only), `room_events` (case log with audiences), one transaction per change, saved before anyone is told.
- [x] **Restore at startup** before the web server accepts connections; unreadable games end with `restore_failed`, and unknown lobby modes fall back to the default.
- [x] **Graceful shutdown** (`config/PlatformConfig.kt`): every socket closes with 1012 before Tomcat's graceful shutdown.
- [x] **Sweeps:** lobby 30 min / finished 15 min expiry, 2 h idle game end, and turn-timer nudges (once per decision, never a move).
- [x] **Basic caps:** ≤ 300 rooms, ≤ 9 players per room.
- [x] **Protocol codegen:** `ProtocolTypesTest` generates and checks `web/src/protocol/generated.ts`; `./gradlew :server:generateProtocol` rewrites it.
- [x] **Engine API additions:** `AnyMode.view` returns typed `legal` options; `isVisible` takes the audience; `rematchConfig`.

Tests (209 JVM tests; 99.87% lines / 98.41% branches overall): room-service unit tests with fakes (lobby, seats, every refusal, a full game, rematch, dedupe, failed saves, reconnect, TTLs, timer, restore), transport tests with a fake socket, identity tests, and `PlatformIT` against Postgres (HTTP API, a game over real sockets, reconnect, hello rules, origin and frame limits, pings, and a **second app instance restoring the game from the database and closing with 1012 on stop**).

Not done in M3a (by design): the web client doesn't use the protocol yet (M4/M5), and the uncovered branches are room-closed race guards.

### M3b: security ⬜
- [ ] **Real client IP:** `CF-Connecting-IP`, else `X-Forwarded-For` (safe: the container is reachable only through Caddy).
- [ ] **Per-IP rate limits** (Bucket4j + Caffeine): create room 5 / 10 min; join 40 / 10 min; failed code lookups 10 / min then backoff; general `/api` 120 / min.
- [ ] **WebSocket limits:** a per-socket token bucket (~10 msg/s, burst 20, close 1008) replacing `RateWindow`; ≤ 30 sockets per IP and ≤ 3 000 in total.
- [ ] **Turnstile** on `POST /api/rooms`: verified server-side, fail-closed in production, Cloudflare's test keys in tests and dev. The owner adds the real keys (RUNBOOK §4.1) before the PR merges; the CSP gains Turnstile's origin in `script-src`/`frame-src`.
- [ ] ⚠️ **CSP vs Cloudflare "JavaScript Detections":** a per-request nonce in `script-src` (Cloudflare copies it onto the script it injects), `index.html` served `no-store`, verified in production with headless Chrome (no console errors).
- [ ] **Origin check on `POST /api/*`** (cross-site room creation).
- [ ] **Ops hygiene:** no tokens in logs; IPs hashed in logs.
- [ ] `docs/SECURITY.md`.
- [ ] Tests: rate-limit tests, token-bucket tests, Turnstile verification (success, failure, outage = fail-closed).

### M4: design system, portraits, lobby UI ⬜
- [ ] **Design tokens:**
  - Colours: ink black, smoke greys, cream case-file cards, blood red (kills), evidence blue (exonerated), brass (tokens).
  - Film grain and venetian-blind light.
- [ ] **Self-hosted fonts with Cyrillic support:** e.g. Playfair Display / Oswald for display, IBM Plex Sans for body, IBM Plex Mono for case-file text (via `@fontsource`).
- [ ] **Deterministic layered SVG portrait generator** driven by `shared/roster.json`: gender, age, archetype, plus traits.
  - **Owner review checkpoint** before any gameplay UI.
- [ ] **Three layouts from one component set:**
  - TV: 10-foot UI, 5% overscan margins, QR code + room code.
  - Laptop: board plus a side panel.
  - Phone: compact board, a dossier drawer, a thumb-zone action bar.
- [ ] **Join flow:** QR code, then name.
- [ ] **i18n:** EN and RU via i18next, with RU transliterations of character names.
- [ ] **Accessibility:** WCAG AA, reduced motion, touch targets ≥ 44 px, states shown by icon + colour.

### M5: Shadow Duel playable end-to-end → v0.1 ⬜
- [ ] **Board UI:** a CSS grid keyed by suspect id; Motion `layout` animations for shifts, swaps and collapses.
- [ ] **Interaction:** legal targets highlighted, edge arrows for shifts with the forbidden undo greyed out, and two-tap confirmation for kill/accuse.
- [ ] **Generic decision panels** rendered from `Opt`; game-over and reveal screens; case log.
- [ ] **"How to play" (EN/RU, own wording)** and a "your possible actions" helper on the phone.
- [ ] **Playwright E2E** (`e2e/`): a seeded game (seed endpoint only in the `test` profile) with one TV + 2 players at phone, laptop and 1080p viewports.
- [ ] **Release v0.1**, then a real session with phones and the TV.

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
- [ ] Docs finalised.

---

## 6. Owner steps (RUNBOOK)

| Step | Status |
|---|---|
| `new-app.sh precinctnoir` + Caddyfile commit (RUNBOOK §1.1) | ✅ |
| `HOME_INFRA_DEPLOY_TOKEN` (fine-grained, home-infra only, Actions read/write) (§1.2) | ✅ |
| Branch protection (§1.3): ruleset *Protect main* | ✅ |
| Turnstile widget + keys in `/srv/apps/precinctnoir/.env` (§4.1) | ⬜ before M3b merges |
| Cloudflare rate-limiting rule on `/api/*` (§4.2) | ⬜ with M3b |
| Delete the history backup `~/Projects/Personal/noir-game-backup-20261106.git` | ⬜ optional |

---

## 7. Known issues and follow-ups

- ⚠️ **CSP blocks Cloudflare's injected bot-detection script:** fix in M3b (see §5).
- ⚠️ **TypeScript 7 and `typescript-eslint`:** Dependabot ignores `typescript` majors (PR #4 was closed). Upgrade both together once `typescript-eslint` supports TS 7.
- ⚠️ **Planned docs not written yet:** `docs/SECURITY.md` (M3b), `docs/DESIGN.md` (M4); `e2e/` (M5). `docs/PROTOCOL.md` exists since M3a.
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
