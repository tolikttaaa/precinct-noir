# Precinct Noir — Architecture & delivery plan

> Living document. Rules and pinned edge-case decisions live in [RULES.md](RULES.md).

## Context
- `tolikttaaa/noir-game` (PUBLIC) holds ~300 lines of early Kotlin domain code on Spring Boot 2.7 / Kotlin 1.6. Both are EOL, and the code doesn't build on the installed JDKs 21/25/26. The shift/collapse code has bugs: RIGHT/DOWN duplicates a card, and collapse removes *alive* cards along the wrong axis. The repo also contains the Russian edition PDFs of Level 99's *Noir* (rules, card scans, roles, tokens) and box art.
- Goal: a web party game built on those **mechanics**, with an **original identity**. One main screen (TV/laptop) shows the board, and players join from phones/laptops with a room code to see private info and act. All 6 variants get built one at a time, with strong anti-abuse/DDoS protection and a polished UI for TV, laptop and phone. It deploys to `precinctnoir.ttaaa.dev` per `home-infra/docs/APP-HOSTING.md`.
- IP rule: we implement mechanics only. The title, the 50+ characters, the portraits, mode names and all rules text are original. We do not translate or redistribute the rulebook.

## Decisions
| Topic | Decision |
|---|---|
| Title / URL / app name | **Precinct Noir**, `precinctnoir.ttaaa.dev`, app `precinctnoir` |
| Repo | Rename to `tolikttaaa/precinct-noir` (user runs `gh repo rename`); local dir → `~/Projects/Personal/precinct-noir`. Gradle `precinct-noir`, package `dev.ttaaa.precinctnoir` |
| Copyrighted PDFs + box art | Copy to a gitignored local `reference/`, **purge from git history** with git filter-repo, then force-push (explicit confirmation at that step) |
| Card art | Parametric SVG noir portraits for an original roster. Each character has a defined **gender + noir archetype**, and the portrait matches both |
| Languages | EN + RU via i18n from day one |
| Backend | Spring Boot 4 + Kotlin 2 on JDK 25, raw WebSockets, pure-Kotlin `engine` module |
| Frontend | React + TypeScript + Vite, served by Spring from the same container |
| Persistence | Room snapshots in Postgres (JSONB) after every action; restored on restart |
| Screen model | TV is display-only. The first player is the VIP (starts the game, picks the mode, kicks). Every device also shows the board, so remote play without a TV works |
| Turn timer | Optional, set in the lobby (off / 60 / 90 / 120 s). Nudge only, never auto-move |
| Edge defense | Cloudflare Turnstile on *Create room* + one documented CF rate-limit rule, on top of app-level limits |
| Git | Feature branch + PR per milestone; merging to main deploys |
| Mode order | 1 → 3 → 2 → 4 → 5 → 6 |
| Server setup | User runs it; I prepare a runbook with copy-paste commands |
| Shadow Duel roles | Random for the first game; "Play again" swaps them (the server passes `killerSeat`) |
| Engine scope in M2 | The full shared core for all six modes, plus Shadow Duel |
| M3 delivery | Two PRs: M3a platform (rooms, lobby, protocol, persistence, restore, shutdown, codegen, basic caps); M3b security (rate limits, Turnstile, WS token bucket and socket caps, CSP nonce) |
| Who plays | The earliest players up to the mode's maximum; the rest watch. The VIP removes players before starting |
| Ending games | The VIP can end a running game; a game idle for 2 h ends automatically |

## Architecture

### Repo layout (monorepo)
```
precinct-noir/
  settings.gradle.kts, build.gradle.kts, gradle/libs.versions.toml   # Gradle 9, Kotlin 2.x, JDK 25 toolchain
  engine/      # pure Kotlin + kotlinx.serialization: board, deck, decisions, modes, projections (no Spring, no IO)
  server/      # Spring Boot 4: HTTP API, WS gateway, rooms, security, Postgres snapshots, static SPA hosting
  web/         # React 19 + TS + Vite: landing, TV app, player app, design system, portraits, i18n
  shared/roster.json   # single source of truth for characters (id, gender, archetype, traits); read by engine + web
  e2e/         # Playwright multi-context tests (TV + N players)
  docs/        # RULES.md (own words), ARCHITECTURE.md, PROTOCOL.md, SECURITY.md, DESIGN.md, HOSTING.md, RUNBOOK.md
  Dockerfile, .dockerignore, compose.dev.yaml (local Postgres 18), .github/workflows/{ci.yml,deploy.yml}, CLAUDE.md
```

### Runtime flow
```
TV browser ──HTTP POST /api/rooms (Turnstile)──► server ──► {code, hostToken}
Phone      ──HTTP POST /api/rooms/{code}/players {name}──► {playerId, playerToken}
All        ──WS /ws ── first frame {hello, room, token, lastEventSeq} (5 s deadline) ──► socket bound to room
Player     ──{act, clientSeq, decisionId, choice}──► Room actor ─► engine.apply ─► save to PG
                                                     └─► per-viewer {game: view + legal} and {events} to each socket
```
- **Room = actor.** Each room handles commands one at a time under a per-room lock, on virtual threads (`spring.threads.virtual.enabled=true`). Within a room: validate → `engine.apply` → persist snapshot → fan out projections. Sends go through `ConcurrentWebSocketSessionDecorator` (send-time and buffer limits drop slow consumers).
- **The server sends full per-viewer projections** (a 7×7 board is a few KB), plus a separate event stream for the log, toasts and animations. Clients never derive hidden state.
- **Generic decision protocol.** The engine exposes the current `PendingDecision`(s) with the legal options per viewer. The UI renders only what is legal and replies `{decisionId, choice}`. The server re-validates everything. `clientSeq` dedupes replays after a reconnect.
- **Room lifecycle:** `LOBBY → IN_GAME → FINISHED → (Play again) LOBBY`. Rooms are locked once a game starts: only token reconnects are allowed. TTLs: lobby idle 30 min, game idle 2 h (the game ends, the room returns to the lobby), finished 15 min.
  - Seats go to the earliest players, up to the mode's maximum; the rest watch. The VIP (earliest player) removes players before starting, and can end a running game.
  - Full protocol, close codes and rules: [PROTOCOL.md](PROTOCOL.md).
- **Persistence:** Flyway `V2__rooms.sql` (V1 is `app_meta`) via Spring `JdbcClient` (no JPA). Every change is saved *before* clients hear about it, in one transaction:
  - `rooms(code pk, status, snapshot jsonb, mode, schema_version, action_seq, …)`: the room snapshot plus the engine's own JSON for the game;
  - `room_commands` (append-only, per round) and `room_events` (the current game's case log with audiences).
  - Restore runs at startup, before the web server accepts connections. A game whose schema has no migration ends with `restore_failed`; its room stays open.
  - On SIGTERM: stop accepting and close every socket with **1012** before Tomcat's graceful shutdown (nothing to flush). Clients reconnect with jittered backoff and resume with the same hello (token + `lastEventSeq`).
- **Protocol types:** Kotlin `@Serializable` types are the source of truth. `ProtocolTypesTest` walks them (kotlin-reflect for names, kotlinx descriptors for shapes) and compares with `web/src/protocol/generated.ts` (discriminated unions on `t`), so `./gradlew check` fails on drift; `./gradlew :server:generateProtocol` rewrites the file.
- **i18n:** the server never sends prose. It sends message keys and params; i18next renders EN/RU per device, and character names have RU transliterations in the catalogs.

### Engine
See **Engine design** below.

## Security & anti-DDoS (docs/SECURITY.md)
> Built in M3b. [SECURITY.md](SECURITY.md) describes what exists; the plan below is kept for context.
**Edge (Cloudflare):** proxied DNS gives the default L3/4/7 DDoS protection. **Turnstile** (invisible) runs on room creation only, verified server-side, fail-closed in prod. One free-plan **rate-limit rule** on `/api/*` is documented in the runbook for the user to apply. There are no inbound ports (tunnel only).

**App (always on):**
- **Real client IP:** `CF-Connecting-IP`, else `X-Forwarded-For`. This is safe because the container is reachable only via Caddy on the internal `web` network.
- **HTTP rate limits:** Bucket4j with Caffeine-backed per-IP buckets.
  - create room: 5 / 10 min
  - join: 40 / 10 min
  - room-code lookups that fail: 10 / min, then backoff (blocks brute-forcing codes)
  - general `/api`: 120 / min
  - Limits are deliberately generous for a living room where 10 devices share one NAT IP.
- **WebSocket:**
  - `Origin` allowlist (blocks cross-site WS hijacking)
  - authenticate within 5 s, token in the first frame, never in the URL
  - 4 KB max text frame, binary rejected
  - per-connection token bucket (≈10 msg/s, burst 20); violations close with 1008
  - ≤ 30 sockets per IP, ≤ 3 000 total
  - app ping every 25 s (Cloudflare closes idle connections after about 100 s); dead after 60 s
- **Capacity caps:** ≤ 300 rooms, ≤ 9 players per room; Caffeine-bounded maps; TTL sweeper.
- **Identity:** room codes use 4 letters from an unambiguous alphabet with a bad-word filter. Host and player tokens are 128-bit `SecureRandom`, base64url, stored hashed in snapshots, and kept in `localStorage` per room. The VIP can kick players.
- **Input:** strict kotlinx.serialization for client→server messages. Names are NFC-normalized, 1–16 chars, with control/bidi characters stripped and uniqueness enforced per room. React escaping only; no `dangerouslySetInnerHTML`.
- **Hidden-info safety:** server-authoritative engine, per-viewer projections, and property tests asserting that no projection ever contains another player's secrets.
- **HTTP headers:**
  - strict CSP: `default-src 'self'`; Turnstile allowed in `script-src`/`frame-src`; `connect-src 'self'`
  - `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
  - fonts self-hosted via @fontsource
- **Ops:** only `/actuator/health` is exposed; no tokens in logs; IPs hashed in logs; Dependabot for Gradle, npm and Actions. A k6 script verifies limits **locally only**, and `/security-review` runs before release.

## UI / design (docs/DESIGN.md)
- **Identity:** film-noir ink black, smoke greys, cream "case-file" cards, blood-red for kills, evidence-blue for exonerated, brass for tokens. Subtle film grain and venetian-blind light on the TV backdrop. Every font must support **Cyrillic** (e.g. Playfair Display / Oswald for display, IBM Plex Sans for body, IBM Plex Mono for case-file text), self-hosted. The `frontend-design` skill guides the build.
- **Three layouts from one component set** (container queries + `clamp()` type):
  - **TV**, 10-foot UI: large board centred; a rail with players, turn, timer and log; 5% overscan-safe margins; no hover dependence; QR code + room code in the lobby.
  - **Laptop**: board plus an action/dossier side panel.
  - **Phone** (portrait): compact board on top, a private "dossier" drawer (identity, hand, team), and a sticky thumb-zone action bar. Destructive actions (kill/accuse) need two-tap confirm.
- **Board:** CSS grid of tiles keyed by stable suspect id. Motion `layout` animations make shifts, swaps and collapses glide naturally.
  - Legal targets are highlighted and everything else dimmed.
  - Row/column shift arrows sit on the edges; the forbidden undo-shift is greyed.
  - States use icon + colour, never colour alone.
  - Reduced-motion and WCAG AA are respected; touch targets are ≥ 44 px.
- **Portraits:** a deterministic layered SVG generator driven by `shared/roster.json` traits: gender, age, archetype, headwear, hair, facial hair, accessories, collar, and chiaroscuro lighting. The roster is ~60 original characters with distinct, easy-to-call first names, roughly gender-balanced. Each game draws N² of them at random (digital play doesn't need the tabletop's 5/6/7 tiers). **There is a user review checkpoint on portraits before gameplay UI.**
- **Rules UX:** a per-mode "How to play" (EN/RU, own wording) shown in the lobby and in game, and a "your possible actions" helper on the phone.

## Milestones (each one = feature branch + PR, CI green, user merges → auto-deploy)
0. **M0 Repo hygiene & English.**
   - Make a mirror backup, copy the PDFs and logo to the gitignored `reference/`, then `git filter-repo --invert-paths` on them. Stash and restore the user's staged/modified files around this. **Confirm before force-pushing main.**
   - Rewrite the README in English (original text). Add `docs/RULES.md` (EN, own words, with the pinned ambiguity IDs) and `docs/ARCHITECTURE.md` (this document). Delete the stale scratch `TestMain.kt` (superseded by real tests).
   - Save the key decisions to Claude project memory, so they survive the directory rename and new session.
   - The user renames the repo (`gh repo rename precinct-noir`); I update `origin`.
   - **Last step of M0: rename the local directory** `~/Projects/Personal/noir-game` → `~/Projects/Personal/precinct-noir` (`mv`).
     - Do it at the very end, because it moves this session's working directory.
     - Also move the Claude project memory folder `~/.claude/projects/-Users-ttaaa-Projects-Personal-noir-game/` → `…-precinct-noir/` so memory carries over.
     - Check for absolute-path references (e.g. `.idea/`, which is untracked and regenerates).
     - Then the user restarts Claude Code from the new path and work continues at M1.
1. **M1 Walking skeleton:**
   - Gradle 9 multi-module, Spring Boot 4, Kotlin 2, JDK 25; web scaffold (ESLint, Prettier, Vitest)
   - 3-stage Dockerfile (node → gradle → temurin-25-jre, uid 1000, HEALTHCHECK that works in the JRE image)
   - `ci.yml`, plus `deploy.yml` from the template with `APP_NAME: precinctnoir`
   - `docs/HOSTING.md` (copied from home-infra as instructed) and `docs/RUNBOOK.md` (user steps: `new-app.sh precinctnoir`, Caddyfile commit, PAT secret, Turnstile keys in `/srv/apps/precinctnoir/.env`, CF rate rule)
   - `CLAUDE.md`
   - **First deploy:** a health check and a WS echo, verified with `websocat`.
2. **M2 Engine core + Mode 1 (Killer vs Inspector)**: pure Kotlin with exhaustive unit, property and scenario tests.
3. **M3 Platform:**
   - rooms, lobby, VIP, sessions/reconnect, WS protocol, TS codegen
   - Postgres snapshots + restore, graceful shutdown
   - full security layer
   - Spring integration tests with Testcontainers Postgres
4. **M4 Design system + portraits + lobby UI:** tokens, fonts, roster (~60), portrait generator, TV/phone/laptop shells, join flow with QR, i18n EN/RU. **Portrait/design review with the user.**
5. **M5 Mode 1 playable end-to-end:** board UI, decisions, animations, game-over screens, Playwright E2E (TV + 2 players). **Release v0.1.**
6. **M6 Spy Games** (3–6, 8, 9 players; free-for-all + teams of 2/3; trophies). Release.
7. **M7 Hitman vs Sleuth** (hit list, escape, expose). Release.
8. **M8 Master Thief vs Chief** (treasure tokens, uniformed officers, quick disguise, swear-in + free grab). Release.
9. **M9 FBI vs Mafia** (8 roles; bomb/threat/protection tokens; Operative reaction window; chain detonation). Release.
10. **M10 Heist** (7×7 vaults/quadrants, overt/covert turn order, tiered thief role deck, Security Chief). Release.
11. **M11 Hardening & polish:** k6 load + limit verification, `/security-review`, accessibility pass, TV overscan check, optional synthesized SFX, docs finalised.

Each mode milestone covers: engine rules + tests → projections → UI panels and tutorial (EN/RU) → E2E → deploy.

## Verification
- **Coverage policy:** target ~100%. CI fails below the floors, and new code ships with its tests.
  - JVM: Kover with the JaCoCo engine (0.8.15+ filters code generated by the kotlinx.serialization plugin, which otherwise counts as untested branches), aggregated over `:engine` and `:server`, excluding the engine's shared test helpers; at least 90% lines and 85% branches; part of `./gradlew check`.
  - Web: Vitest V8, at least 95% lines/statements/functions and 90% branches; `npm run test:coverage`.
  - The only code left out is test helpers. React Compiler memo branches are covered by re-render tests.
- **Engine:** `./gradlew :engine:check`, covering example tests per rule, Kotest property tests (shift is a permutation, shift then inverse is the identity, collapse keeps a rectangle, no projection leaks), and scripted scenarios reproducing the rulebook's worked examples.
- **Server:** `./gradlew :server:check`, using Testcontainers Postgres for snapshot/restore, WS protocol tests, rate-limit and origin/frame-size rejection tests, and restart-mid-game resume.
- **Web:** `npm run typecheck && npm run lint && npm test`; the protocol-drift check runs in CI.
- **E2E:** Playwright with seeded games (seed endpoint enabled only in the `test` profile). One TV context plus N player contexts play a full game per mode at phone, laptop and 1080p TV viewports.
- **Manual:** `docker compose -f compose.dev.yaml up` + `bootRun` + `npm run dev`, driven in Chrome at 390×844, 1440×900 and 1920×1080 with screenshots for review.
- **Production:**
  - `curl https://precinctnoir.ttaaa.dev/actuator/health`
  - a `websocat` handshake
  - redeploy during a live game to confirm it resumes after "Reconnecting…"
  - a real session with phones on the TV

---
## Engine design (`engine/`, package `dev.ttaaa.precinctnoir.engine`)
Pure Kotlin + kotlinx.serialization only. Deterministic: a SplitMix64 `Rng` whose state is persisted and **never** projected. No clock, no `kotlin.random`, no HashMap iteration order. Simultaneous effects resolve in row-major order. The legacy Spring Boot 2.7 model (`Area.kt` etc.) was removed in M1 when the multi-module build replaced it. It is still in git history, and M2 adds regression tests for its known shift/collapse bugs.

**Core types**
- **Board** (row-major `cells: List<SuspectId>`, `tiles`, `removed`):
  - `shift(line, by∈{±1,±2})` rotates with wraparound; a no-op shift is illegal.
  - `ShiftRecord.forbids()` is the modular "no immediate undo" test. Any other *main* action clears it; sub-steps, triggers, reactions and free actions don't.
  - `swap`, `kill` (clears tokens and officer marker; an exoneration stays on the corpse).
  - **Collapse:** `collapseAxes()` lists the legal axes; a line with 2+ dead means the **actor picks** exactly one dead tile per line. Relative order is kept, the board stays a rectangle, and removed tiles go to `removed`. Multi-collapse repeats as a SUBSTEP (`Collapse` | `StopCollapsing`) within one action.
  - Geometry: `neighbors` (8-neighbourhood, no wrap, excludes self) and `closedNeighbors`; `orthogonalWithin(3)`, `diagonalWithin(3)`, 4×4 `square`s; `HeistGeometry` (3×3 corner quadrants, the middle "cross", centre `hackable`).
  - Tokens and markers (`Exonerated`, `Arrested`, `Officer(stunned)`) belong to the suspect and move with it.
- **Deck / hands / secrets:** `Deck` (`draw`, `drawN`, `putBottom`, `shuffleIn`), `PlayerSecret(identity, hand)`, and a `CardLedger` that tests use to check each card is in exactly one place.
- **Shared rule helpers:** `BoardMoves`, `EvidencePlacement` (place if alive, else discard; returns whether to interrogate), `IdentityDraw.drawLiving`, `Queries`. The server computes every yes/no and raise-hands answer.

**Flow model**
- Each room's state is an `Agenda`: a LIFO stack of serializable mode `Step`s plus **at most one** `Pending(id, actor, kind ∈ {SETUP, TURN, SUBSTEP, TRIGGER, REACTION, FORCED}, prompt)`.
- Invariant at rest: `pending` XOR `outcome`.
- `FlowMode.apply` checks the decision id, actor and legality, then resolves and drains steps until the next pending decision.
- This one mechanism covers:
  - normal turns;
  - first-turn picks (Inspector 1-of-4, Sleuth 1-of-3, Master Thief active identity);
  - bomb chains (`ChainNext` SUBSTEPs);
  - Maniac threat placement;
  - Copycat 1-of-3;
  - start-of-turn triggers (Maniac kills, Operative protection upkeep, Heist token retrieval);
  - the **Protect reaction**: it always opens for any lethal effect on a protected tile, so its existence leaks nothing;
  - deferred friendly-fire cleanup (`FlushDeferred`);
  - Heist cadence (Chief after any overt action or after a full round of covert ones);
  - Master Thief's FORCED free grab;
  - caught-thief redraw turns.
- **Legal actions come from the viewer's projection** (`legalFor(project(state, viewer))`), so menus can't depend on hidden data. A Catch menu never excludes teammates; an Accuse menu never shrinks.
- `Opt` variants: `Simple`, `Shift(moves)` (every legal line/amount, the undo already removed), `Collapse(direction→candidates per line)`, `Target`, `Pair`, `Pick(min,max)`, `TokenMove`, `Square`, `Vault`. Each has a matching `Choice`, and `Opt.accepts(choice)` is the one legality test. These drive the UI generically.
- Rejections are opaque: `GAME_OVER | NOT_YOUR_DECISION | STALE_DECISION | ILLEGAL_INPUT | MALFORMED`.
- Timers: `onTimer` emits `Nudged` and never changes state.

**Events & projections**
- `EventRecord<E>(actionSeq, n, audience ∈ {Public, Player, Team}, event)`, where `E` is the mode's own sealed event type. Public events have the same *shape* whatever the hidden values, e.g. `CatchResult(caught?)`.
- Projections are built by **whitelist DTOs**, never "copy then blank". `View(board, deckCount, discard, seats, turn, lastShift, pending(public label), outcome, public, me)`.
- Never projected: deck order, RNG state, Limbo cards (except to that decision's actor), face-down hit-list cards.
- Game over brings `FinalReveal`. Teams see teammate identities in FBI vs Mafia; Heist thieves see only the *initial* identities; Spy teams don't share (rules-faithful; variant flag).
- No private team chat, because the rules require team talk to be audible to everyone.

**Server boundary**
- `GameMode<M, St, E, V>` (model, agenda step, event, view): `setup(players, config, seed)`, `project`, `legalFor(view)`, `apply`, `onTimer`, `teamOf`, `migrations`, `configSpec` (lobby variant toggles).
  - `FlowMode` implements the generic part: command validation, the `Tx` working copy, and draining steps to the next decision. A game at rest is `GameState(actionSeq, rng, agenda, outcome, model)`.
  - `ErasedMode` exposes it to the server as JSON in/out (`AnyMode`: setup, apply, view + legal, visibility, status, encode/decode with migrations, nudge); `ModeRegistry` lists the modes.
- **Persistence:** one transaction per applied command writes `rooms(snapshot jsonb, schema, action_seq)`, `room_commands` (append-only) and `room_events` (see Runtime flow above).
  - The engine state is versioned by the mode's `schemaVersion` with chained JSON `Migration`s; the server's room snapshot wraps it.
  - Replay of setup + commands must reproduce the snapshot byte for byte (CI check).
  - `Json{classDiscriminator="t"; encodeDefaults; explicitNulls=false; ignoreUnknownKeys=false}`; stable `@SerialName`s; canonical sorted lists.

**Roster:** `shared/roster.json` with ~60 original characters (`SuspectId` 0..59). Each game draws N² at random with the seeded RNG; there are no tabletop tiers.

**Module layout**
```
engine/src/main/kotlin/dev/ttaaa/precinctnoir/engine/
  core/{ids,rng,board,cards,rules,flow,legal,events,view,api,persist}/
  modes/{killerinspector,spygames,hitmansleuth,masterthief,fbimafia(+roles/,KillPipeline),heist(+roles/,Cadence)}/
engine/src/testFixtures/…/{ScenarioDsl, BoardAscii, Arbs, Playout, NonInterference}.kt
```

**Mode display names (original):**

| Internal | Display name |
|---|---|
| `killer_inspector` | *Shadow Duel* |
| `spy_games` | *Spy Ring* |
| `hitman_sleuth` | *The Hit List* |
| `master_thief` | *Cat Burglar* |
| `fbi_mafia` | *Feds vs. Mob* |
| `heist` | *Casino Heist* |

Role names are generic (Killer, Inspector, Operative…).

**Engine tests (Kotest)**
1. One example spec per action, plus a **pinned test per ambiguity ID** in [RULES.md](RULES.md).
2. Board property tests:
   - permutation, inverse, additivity;
   - `forbids` is exact;
   - collapse keeps a rectangle;
   - adjacency 3/5/8 with no wrap;
   - range functions match brute force;
   - tokens follow their suspect.
3. Random-playout invariants (≈2 000 steps per seed):
   - card conservation, `pending` XOR `outcome`;
   - counters match the board, PROTECTION ≤ 6;
   - snapshot round-trip;
   - every legal option is accepted, and malformed input is rejected without throwing;
   - replay is byte-identical.
4. **Non-interference leak tests:** change only the secrets V can't see; `project` and `legalActions` for V must be identical. Event audiences are checked too.
5. Scenario DSL replaying the rulebook's worked examples:
   - turn-1 kill and first pick;
   - failed disguise; exonerate → "Yes", kill → "No";
   - the p.7 shift/collapse figures;
   - Spy interrogation;
   - Detective and Sniper ranges;
   - Maniac p.24, bomb chain p.25, Heist Inspect p.31;
   - one full game per mode.
6. Golden JSON fixtures per schema version.
