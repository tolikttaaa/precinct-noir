# Precinct Noir: client–server protocol

How browsers talk to the server. The Kotlin `@Serializable` types in
`server/src/main/kotlin/dev/ttaaa/precinctnoir/server/protocol/Protocol.kt` are the source of truth;
`web/src/protocol/generated.ts` is generated from them (`./gradlew :server:generateProtocol`), and
`./gradlew check` fails if it is stale.

**Conventions**
- JSON everywhere, encoded strictly: unknown fields are errors, `null` fields are left out, and
  polymorphic objects carry their type in `"t"`.
- The server never sends prose. Errors, refusals and results are i18n keys (`room_full`, `not_vip`, …).
- Tokens are bearer secrets. They travel only in request bodies and the WebSocket hello, never in a URL,
  and the server stores only their SHA-256.

## 1. HTTP API (`/api`)

| Request | Success | Errors (`{"error": code}`) |
|---|---|---|
| `POST /api/rooms` `{turnstileToken, mode?}` | `201 {code, hostToken}`. The room starts in `mode` (the host's pick on the home screen), or the first mode without one; the VIP can still change it in the lobby | `422 unknown_mode` (checked before the bot check), `403 captcha_failed`, `503 captcha_unavailable`, `503 capacity` (300 rooms), `503 unavailable` (shutting down), `400 malformed` |
| `POST /api/rooms/{code}/players` `{name}` | `201 {playerId, playerToken}` | `404 room_not_found`, `409 room_locked` (game running), `409 room_full` (9 players), `409 name_taken`, `422 invalid_name`, `400 malformed`, `503 unavailable` |
| `GET /api/rooms/{code}` | `200 {code, status, players, maxPlayers, mode}` | `404 room_not_found` |
| `GET /api/modes` | `200 [{id, minPlayers, maxPlayers, config}]` | |
| `GET /api/config` | `200 {turnstileSiteKey?, version?, commit?}` (public settings for the web client; `version` is the running release, like `0.1.0`, absent in builds between releases; `commit` is the full commit hash) | |

Any API request can also be refused with `429 rate_limited` (with `Retry-After` in seconds), and a
state-changing request from another site with `403 forbidden_origin`. Limits and the Turnstile check are
described in [SECURITY.md](SECURITY.md).

- **Room codes:** 4 letters from `BCDFGHJKLMNPQRSTVWXZ`, case-insensitive. With no vowels they can't
  spell words, and there's no I/O to mix up with 1/0. A short blocklist catches the remaining
  consonant-only abbreviations.
- **Names:** NFC-normalized, control and invisible formatting characters (including bidi overrides)
  removed, runs of spaces collapsed, 1–16 characters, unique per room ignoring case.
- **Who gets a token:** the TV gets `hostToken` when it creates the room; each player gets their own
  `playerToken` when joining. Clients keep them in `localStorage` per room.

## 2. WebSocket (`/ws`)

Only allowed origins may connect, and each client may hold at most 30 open sockets (the handshake is
refused with HTTP 429; a socket that slips past at the same moment is closed with 1013). Text frames
only (binary → close 1003), at most 4 KB (→ 1009). Messages draw on a token bucket: a burst of 20, then
10 per second (→ 1008).

### 2.1 Hello and resume
The first frame must be a hello, within **5 s**:

```json
{"t": "hello", "room": "BCDF", "token": "…", "lastEventSeq": 41}
```

The server answers `welcome {you: {role: "host"|"player", playerId?}, protocol: 1}`, then the room, then,
if a game exists, your `game` view and the case-log `events` after `lastEventSeq` (all of them if you
leave it out). Reconnecting is the same hello again: there is no separate resume message.

### 2.2 Client → server
Every message after the hello is a command with a `clientSeq` that grows per sender (the TV and each
player count separately; reconnects continue the count). A repeated or older `clientSeq` is acknowledged
without running again, so resending after a reconnect is safe.

| `t` | Fields | Who | When |
|---|---|---|---|
| `act` | `decisionId`, `choice` | the seated player whose decision is pending | in game |
| `set_mode` | `mode` | VIP | lobby |
| `set_config` | `config` (keys from the mode's `configSpec`; missing keys get defaults) | VIP | lobby |
| `set_timer` | `seconds`: 60, 90, 120, or absent for off | VIP | lobby |
| `show_guide` | `page` (0–19), or absent to hide the walkthrough from the board | VIP | lobby |
| `kick` | `playerId` (not yourself) | VIP | lobby or finished |
| `leave` | | any player | lobby or finished |
| `start` | | VIP | lobby |
| `end_game` | | VIP (the UI asks to confirm) | in game |
| `play_again` | | VIP | finished |

Each command is answered with `ack {clientSeq}` or `rejected {clientSeq, reason}`, where `reason` is one
of `not_vip`, `not_a_player`, `wrong_status`, `unknown_mode`, `invalid_config`, `invalid_timer`,
`invalid_target`, `not_enough_players` (`illegal_input` also covers a walkthrough page out of range), or the engine's own `not_your_decision`, `stale_decision`,
`illegal_input`, `game_over`, `malformed`. A frame that isn't valid JSON for any message gets
`error {code: "malformed"}`.

### 2.3 Server → client
| `t` | Meaning |
|---|---|
| `welcome` | who you are |
| `room` | the room changed, or someone connected or disconnected: code, status, `version`, round, VIP, members (with `connected`), whether the TV is connected, mode, config, timer, seats (member ids by seat), last result, and the walkthrough page the board shows (`guide`, absent when hidden; starting a game or changing mode hides it) |
| `game` | your projection of the game (`view`, mode-specific: `ShadowDuelView` …) and your `legal` options; `seat` is absent for the TV and spectators |
| `events` | new case-log events you may see, each with its room-wide `seq` |
| `nudge` | the turn timer ran out for the pending decision; nothing changes |
| `ack` / `rejected` / `error` | replies to your messages |
| `closing` | sent just before the server closes the socket, with a reason |

The `game` message always carries the complete view for you, so a client never has to patch state from
events; events drive the case log, toasts and animations.

### 2.4 Close codes
| Code | Reason | Client should |
|---|---|---|
| 1000 | `left` | stay out |
| 1001 | silent for 60 s (no message, no pong) | reconnect |
| 1003 / 1008 / 1009 | binary frame / rate limit / frame too big | fix the client |
| 1013 | too many open sockets | reconnect later, with backoff |
| 1012 | `restarting` (deploy) | reconnect with jittered backoff and resend the hello |
| 4001 | `bad_token` | forget the token and rejoin |
| 4002 | `auth_timeout` | reconnect |
| 4003 | `kicked` | forget the token |
| 4004 | `room_closed` | forget the room |
| 4005 | `hello_required` | fix the client |

The server pings every socket every 25 s (browsers answer automatically), which keeps Cloudflare from
dropping idle connections after about 100 s.

## 3. Rooms

- **Lifecycle:** `lobby → in_game → finished → (play again) lobby`. Players can join in the lobby or
  after a game; the room is locked while a game runs (only token reconnects).
- **VIP:** the earliest player still in the room. They pick the mode, switches and timer, remove players,
  start, end a running game, and start the next round. The TV only watches.
- **Seats:** the first players to join, up to the mode's maximum; everyone else watches with the TV's
  view (no secrets). The VIP decides who plays by removing players before starting.
- **Play again:** in Shadow Duel the same two players swap roles. Any change of mode or line-up starts
  with fresh random roles.
- **Lifetimes:** a lobby with no accepted command for 30 min closes, and so does a finished game after
  15 min. A running game nobody touches for 2 h ends (`idle_timeout`), and the room returns to the lobby.
  The VIP can end a game at any time (`ended_by_host`).
- **Restarts:** every change is saved to Postgres before anyone hears about it, so a deploy loses
  nothing. On shutdown every socket closes with 1012; the next instance restores all rooms. A game saved
  under a schema the new engine can't read ends with `restore_failed`, and its room stays open.
