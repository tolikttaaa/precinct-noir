# Precinct Noir: notes for Claude and other AI agents

A Jackbox-style hidden-identity deduction party game. The TV shows the board; players act from phones and laptops.

**Read first**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): decisions, architecture, milestones M0–M11, engine design.
- [docs/RULES.md](docs/RULES.md): the rules, which are also the engine spec. Edge-case IDs (`KI-2`, `FM-6`…) are pinned by tests.
- [docs/HOSTING.md](docs/HOSTING.md): the hosting contract for the home server. Merging to `main` deploys.
- [docs/RUNBOOK.md](docs/RUNBOOK.md): one-time server and credential steps. The repo owner runs these, not agents.

## Hard rules
- **Original identity only.** Implement mechanics only. Never use "Noir" as the game's title, or the original game's characters, art, mode names or rulebook text.
- **`reference/`** holds copyrighted PDFs locally. Never commit it, and never copy text from it.
- **`engine/` is pure Kotlin.** kotlinx.serialization only: no Spring, no IO, no clock, no `kotlin.random`. All randomness goes through `Rng`.
- **The server is authoritative.**
  - Clients receive per-viewer projections only. Hidden information must never reach a viewer who may not see it.
  - The server sends i18n keys and params, never prose.
- **Git:** one feature branch + PR per milestone. Never push to `main`: merging deploys to production.

## Commands
Toolchain: JDK 25 (the Gradle daemon is pinned in `gradle/gradle-daemon-jvm.properties`) and Node 24.

| What | Command |
|---|---|
| All JVM tests (server tests need Docker for Testcontainers) | `./gradlew check` |
| Local database | `docker compose -f compose.dev.yaml up -d` |
| Run server (dev profile, port 8080) | `./gradlew :server:bootRun` |
| Run web client (http://localhost:5173, proxies `/api`, `/ws`, `/actuator`) | `cd web && npm run dev` |
| Web checks | `cd web && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` |
| Production image | `docker build -t precinctnoir:dev .` |
