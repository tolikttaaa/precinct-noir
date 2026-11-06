# Precinct Noir: status and resume guide

> **Purpose:** this is the single place to see what the project should become, what is already
> built, and what is next, so development can resume from any point (a new session, a new agent,
> or after a break). Update it in every milestone PR.
>
> **Last updated:** 2026-11-06, after M2 was merged (PR #9). M3 not started.
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
| M3 | Platform: rooms, lobby, WS protocol, persistence, security | ⬜ | – |
| M4 | Design system, portraits, lobby UI, i18n | ⬜ | – |
| M5 | Shadow Duel playable end-to-end → **release v0.1** | ⬜ | – |
| M6 | Spy Ring | ⬜ | – |
| M7 | The Hit List | ⬜ | – |
| M8 | Cat Burglar | ⬜ | – |
| M9 | Feds vs. Mob | ⬜ | – |
| M10 | Casino Heist | ⬜ | – |
| M11 | Hardening & polish | ⬜ | – |

**Next action:** start M3 on a branch `m3/platform`. Ask the owner the M3 open questions first (see §5, M3).

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
  - `/ws/echo` diagnostic: origin allowlist, 4 KB frames, 20 msg/s, binary refused. **To be replaced in M3.**
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
- ⬜ **Turn-timer wiring:** `onTimer` exists; the server-side scheduler is M3.

---

## 5. To do: specification of the remaining work

### M3: platform ⬜
**Goal:** a real room lifecycle around the engine, with persistence, reconnects and the full security layer. No new game UI yet.

**Open questions to put to the owner before starting:**
- Room code alphabet and bad-word list.
- Kick and leave semantics during a game.
- Does the TV need its own token?
- Retention period for finished rooms in the database.

Server (`server/`):
- [ ] **Room HTTP API:**
  - `POST /api/rooms` (Turnstile-verified) → `{code, hostToken}`
  - `POST /api/rooms/{code}/players {name}` → `{playerId, playerToken}`
  - Room codes: 4 letters from an unambiguous alphabet, with a bad-word filter.
  - Tokens: 128-bit `SecureRandom`, base64url, stored **hashed**; clients keep them in `localStorage` per room.
  - Names: NFC-normalized, 1–16 characters, control/bidi characters stripped, unique per room.
- [ ] **Lobby:** the VIP (first player) picks the mode and variant switches (from `AnyMode.configSpec`) and the turn timer (off/60/90/120 s), then starts or kicks. Rooms lock at start (token reconnects only).
- [ ] **Room lifecycle:** `LOBBY → IN_GAME → FINISHED → (Play again) LOBBY`.
  - TTLs: lobby idle 30 min, game idle 2 h, finished 15 min.
  - "Play again" in Shadow Duel swaps roles by passing `killerSeat` = the previous Inspector.
- [ ] **Room actor:** one command at a time under a per-room lock (virtual threads).
  - Each command: validate → `AnyMode.apply` → persist → fan out projections.
  - Sends go through `ConcurrentWebSocketSessionDecorator` with send-time and buffer limits.
- [ ] **WebSocket gateway at `/ws`** (replaces `/ws/echo`):
  - The first frame is `{hello, token, lastSeq}` and must arrive within 5 s; the token never goes in the URL.
  - Client messages: `{act, decisionId, choice, clientSeq}`, deduplicated by `clientSeq`.
  - Server messages: full per-viewer `{state, seq}` (from `AnyMode.view`: view + legal) plus an event stream filtered by `AnyMode.isVisible`.
- [ ] **Persistence:**
  - Flyway **`V2__rooms.sql`**: V1 is already taken by `app_meta`, so ARCHITECTURE's `V1__rooms.sql` becomes V2.
  - Tables: `rooms(code pk, status, snapshot jsonb, schema_version, action_seq, updated_at)`, `room_commands` (append-only) and `room_events`.
  - One transaction per applied command, via `JdbcClient` (no JPA).
- [ ] **Restore on startup:** `AnyMode.decode(json, schemaVersion)`. A schema mismatch without a migration ends the room gracefully with a message.
- [ ] **Graceful shutdown:** stop accepting, flush, close sockets with **1012**. Clients reconnect with jittered backoff and resume via token + `lastSeq`.
- [ ] **Turn-timer scheduler:** nudges only, using `AnyMode.nudge`.
- [ ] **Protocol codegen:** a Gradle task walks the `SerialDescriptor`s → `web/src/protocol/generated.ts` (discriminated unions). CI fails if the generated file drifts.

Security (`docs/SECURITY.md`, to be written):
- [ ] **Real client IP:** `CF-Connecting-IP`, else `X-Forwarded-For`.
- [ ] **Per-IP rate limits** (Bucket4j + Caffeine):
  - create room: 5 / 10 min
  - join: 40 / 10 min
  - failed code lookups: 10 / min, then backoff
  - general `/api`: 120 / min
- [ ] **WebSocket limits:**
  - per-connection token bucket (~10 msg/s, burst 20); violations close with 1008
  - ≤ 30 sockets per IP and ≤ 3 000 in total
  - app ping every 25 s; a connection is dead after 60 s
- [ ] **Capacity caps:** ≤ 300 rooms and ≤ 9 players per room, Caffeine-bounded maps, TTL sweeper.
- [ ] **Turnstile:** verified server-side, fail-closed in production. The owner adds the keys (RUNBOOK §4.1), and the CSP gains Turnstile's origin in `script-src`/`frame-src`.
- [ ] ⚠️ **CSP vs Cloudflare "JavaScript Detections":** Cloudflare injects an inline script that our CSP blocks (a console error on every load; the site still works).
  - Fix: a per-request nonce in `script-src`, which Cloudflare copies onto the script it injects.
  - Also serve `index.html` with `no-store`, so a cached page can't pair with a new nonce.
  - Verify in production with headless Chrome (no console errors).
- [ ] **Ops hygiene:** no tokens in logs; IPs hashed in logs.

Tests:
- [ ] Testcontainers Postgres snapshot/restore.
- [ ] WS protocol tests: auth deadline, origin, frame size, rate limit.
- [ ] Rate-limit tests.
- [ ] A test that restarts mid-game and resumes.
- [ ] A protocol-drift check in CI.

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
| Turnstile widget + keys in `/srv/apps/precinctnoir/.env` (§4.1) | ⬜ during M3 |
| Cloudflare rate-limiting rule on `/api/*` (§4.2) | ⬜ during M3 |
| Delete the history backup `~/Projects/Personal/noir-game-backup-20261106.git` | ⬜ optional |

---

## 7. Known issues and follow-ups

- ⚠️ **CSP blocks Cloudflare's injected bot-detection script:** fix in M3 (see §5).
- ⚠️ **TypeScript 7 and `typescript-eslint`:** Dependabot ignores `typescript` majors (PR #4 was closed). Upgrade both together once `typescript-eslint` supports TS 7.
- ⚠️ **Planned docs not written yet:** `docs/PROTOCOL.md` and `docs/SECURITY.md` (M3), `docs/DESIGN.md` (M4); `e2e/` (M5).
- ⚠️ **Flyway naming and the rooms schema:**
  - ARCHITECTURE line 57 (the M3 overview) still says `V1__rooms.sql` with `state jsonb`. Both are outdated.
  - V1 is taken, so M3 uses `V2__rooms.sql`.
  - The schema to build is the one in the Engine-design section (line 204): `snapshot jsonb`, `schema`, `action_seq`, plus `room_commands` and `room_events`.
  - Fix line 57 when M3 starts.
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
| 2026-11-06 | The CSP nonce for Cloudflare's bot detection is part of M3 |
