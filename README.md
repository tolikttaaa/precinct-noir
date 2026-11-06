# Precinct Noir

**A hidden-identity deduction party game for the living room or a video call.**

Rain on the windows, a city full of suspects, and nobody is who they say they are.
One screen (TV or laptop) shows the city: a grid of suspects that slides, shifts and
collapses as the night goes on. Players join from their phones with a room code,
secretly become one of the suspects, and hunt each other through the crowd.

> Status: **in development.** See the milestone plan in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> It will be playable at `https://precinctnoir.ttaaa.dev`.

## How it plays
- **Host:** open the site on the TV and press *Host a game*. A room code and QR code appear.
- **Join:** everyone scans the code (or types it) on their phone or laptop and picks a name.
  The first player to join is the **VIP**, who picks the case and starts the game.
- **Play:** the TV shows the public board and the case log. Your phone shows your secret
  identity, your hand and the moves you can make right now. You make every move from your
  own device; the server checks each one and announces who is "next to" whom.
- **Remote:** without a TV, every device shows the board too, so a voice call is enough.

## Cases (game modes)
| Case | Players | In one line |
|---|---|---|
| **Shadow Duel** | 2 | A killer hides in the crowd while an inspector closes in, and each is the other's prey. |
| **Spy Ring** | 3–6, 8, 9 | Every player is a spy. Catch rival spies for trophies, solo or in agencies. |
| **The Hit List** | 2 | A hitman works through a secret list while a sleuth tries to unmask them. |
| **Cat Burglar** | 2 | A master thief robs the whole city while the police chief plants officers in the crowd. |
| **Feds vs. Mob** | 6, 8 | Two teams with unique roles: bombs, threats, snipers, undercover agents and autopsies. |
| **Casino Heist** | 5–7 | A crew of specialist thieves cracks four vaults under a security chief's nose. |

Full rules, written for this project: [`docs/RULES.md`](docs/RULES.md).

## Tech
- **Engine:** pure Kotlin, deterministic and server-authoritative. Hidden information is enforced with per-viewer projections.
- **Server:** Spring Boot + raw WebSockets, with room snapshots in PostgreSQL so a redeploy doesn't end a game.
- **Client:** React + TypeScript (Vite), one responsive UI for TV, laptop and phone, in English and Russian.
- **Hosting:** a single container on a home server behind Cloudflare, with rate limiting and abuse protection built in.

## Development
You need JDK 25, Node 24 and Docker.

```bash
docker compose -f compose.dev.yaml up -d   # local PostgreSQL 18
./gradlew :server:bootRun                  # API + WebSockets on :8080 (dev profile)
cd web && npm install && npm run dev       # client on http://localhost:5173
```

- Tests: `./gradlew check` (engine + server, using Testcontainers), then `cd web && npm test`.
- Production image: `docker build -t precinctnoir:dev .`
- Merging to `main` deploys automatically; see [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Acknowledgements
Precinct Noir is an independent, unofficial fan project. Its mechanics are inspired by the
deduction card game *Noir* by D. Brad Talton Jr. (Level 99 Games). All characters, artwork,
names and text here are original. The project is not affiliated with or endorsed by
Level 99 Games or its publishers.
