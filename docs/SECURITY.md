# Precinct Noir: security and abuse protection

What protects the game and its players, and why each control is shaped the way it is. The app is a
public party game. Nobody has an account, rooms are short-lived, and the worst realistic attacks are:
flooding the server (rooms, sockets, messages); guessing room codes to crash other people's games;
using the API from other sites through a visitor's browser; and reading another player's secret
identity. Values below are production defaults (`app.*` settings, `AppProperties.kt`).

## 1. The path a request takes
```
browser ─► Cloudflare edge ─► cloudflared tunnel ─► Caddy ─► app container (port 8080, no published ports)
```
- **Cloudflare** proxies the hostname and absorbs network-level floods. It also offers one optional WAF
  rate-limiting rule (RUNBOOK §4.2) and Turnstile (§4).
- **Nothing reaches the app except through the tunnel**: the server has no inbound ports, and the
  container sits only on Caddy's internal network.

## 2. Who is a client
Limits count per **client**:
- **`CF-Connecting-IP`** is used when present. Cloudflare sets it and overwrites any value a visitor
  sends, and §1 guarantees every request went through Cloudflare.
- **Fallback:** the peer address, used in local dev and tests.
- **IPv6 is grouped by /64.** A household gets a whole /64, so rotating addresses inside it doesn't
  buy new limits.
- **No DNS lookups:** the header is parsed as an IP literal only.

Code: `security/ClientIp.kt`.

## 3. HTTP limits (`/api/**`)
`ApiGuard` is a Spring MVC interceptor, so it judges the endpoint Spring actually matched rather than the
raw URL.

| Limit (per client) | Default | Why |
|---|---|---|
| All API calls | 120 / min | general flood brake |
| Create room | 5 / 10 min | rooms are the expensive resource (also behind Turnstile) |
| Join room | 40 / 10 min | generous: a living room of phones shares one address |
| Room codes that don't exist | 10 / min; once used up, **every** lookup waits | stops brute-forcing the 20⁴ = 160 000 codes |

- **Refusals** are `429 {"error":"rate_limited"}` with `Retry-After` in seconds.
- **Buckets** are token buckets (Bucket4j) that refill smoothly. They live in bounded caches (Caffeine,
  100 000 clients per limit) and are forgotten once idle long enough to be full again.
- **Capacity:** ≤ 300 rooms in total, and ≤ 9 players per room.

## 4. Bot check on room creation (Cloudflare Turnstile)
`POST /api/rooms` needs `{"turnstileToken": …}` from the Turnstile widget on the TV. The widget is
invisible and is added to the UI in M4. The server checks the token with Cloudflare's siteverify
before creating anything:
- **Pass:** Cloudflare says `success`, and the token was issued on `precinctnoir.ttaaa.dev`.
- **Fail → `403 captcha_failed`:** a rejected token, a token from another hostname, or an empty or
  oversized one (the last two never reach Cloudflare).
- **Fail-closed → `503 captcha_unavailable`:** no secret key configured, or Cloudflare unreachable, slow
  (5 s), or answering nonsense.
- **Keys** come from the server's environment (RUNBOOK §4.1). The public site key reaches the web client
  through `GET /api/config`.
- **In dev**, Cloudflare's always-pass test keys are used, with the hostname check off. Tests use a
  local stand-in for siteverify.

Joining needs no bot check: it already requires a live room code, and §3 limits it.

## 5. Cross-site use
- **WebSocket handshakes** must come from an allowed `Origin`. This blocks cross-site WebSocket
  hijacking.
- **State-changing API requests** (anything but `GET`/`HEAD`/`OPTIONS`) with a foreign `Origin` get
  `403 forbidden_origin`. Requests without an `Origin` aren't from a browser and pass.
- **No CORS headers are sent**, so other sites can't read API responses.

## 6. WebSockets
| Control | Value | On violation |
|---|---|---|
| Open sockets per client / in total | 30 / 3 000 | handshake `429`; a socket that slips past the check at the same moment is closed with 1013 |
| Hello (auth) deadline | 5 s | close 4002 |
| Frame size | 4 KB text | close 1009 |
| Binary frames | refused | close 1003 |
| Messages | token bucket per socket: burst 20, then 10 / s | close 1008 |
| Liveness | server ping every 25 s; silent for 60 s | close 1001 |
| Slow readers | 5 s send time or 512 KB buffered | dropped, so they can't stall their room |

- **Socket caps** cover `/ws` and `/ws/echo` together (`security/SocketGuard.kt`). A slot is taken
  atomically when the socket opens and released when it closes.
- **Malformed messages** after the hello get an `error` reply. The first message must be a valid hello.

## 7. Identity, secrets and hidden information
- **Tokens:** host and player tokens are 128-bit random (`SecureRandom`), base64url.
  - Stored only as SHA-256 and compared in constant time.
  - Sent only in request bodies and the WebSocket hello, never in URLs.
  - A room code alone grants nothing.
- **The server is authoritative.**
  - The engine runs only on the server, and each viewer receives a projection built from a whitelist of
    what they may see. The engine's leak tests check that changing hidden data never changes another
    viewer's projection.
  - Case-log events carry an audience and are filtered per viewer.
  - The RNG state and deck order are never sent.
- **Input:** strict JSON (unknown fields are errors).
  - Names are NFC-normalized, with control and invisible characters (including bidi overrides)
    removed, 1–16 characters.
  - The server sends i18n keys, never prose, and the client renders text with React escaping only.

## 8. Browser hardening (`web/SecurityHeadersFilter.kt`)
- **CSP:**
  ```
  default-src 'self'; script-src 'self' 'nonce-…' https://challenges.cloudflare.com; style-src 'self';
  img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```
- **Why the nonce:**
  - Each response gets a fresh one. Our pages don't use it; it exists for Cloudflare's bot detection
    ("JavaScript Detections").
  - Cloudflare injects an inline script into HTML and copies the nonce from the CSP header onto it.
    Without the nonce the browser blocks that script.
  - HTML is served `Cache-Control: no-store`, so a cached page can never meet a newer nonce. Hashed
    assets are cached for a year.
- **Other headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`,
  `Cross-Origin-Opener-Policy: same-origin`, and HSTS.
- **Fonts are self-hosted.**

## 9. Logs and privacy
- **No IP addresses in logs.** A client appears as a 12-character pseudonym: an HMAC of its address,
  keyed by a secret that is created at startup and never leaves memory. Pseudonyms stay stable until
  the next restart and can't be reversed.
- **Never logged:** tokens, request bodies, or Turnstile secrets.
- **Refusal logs are throttled:** at most one line per client per minute, so a flood doesn't fill the disk.
- **Exposed management endpoints:** only `/actuator/health`, with details off. Error pages never include
  stack traces or messages.

## 10. Owner checklist and follow-ups
- **Owner steps (RUNBOOK §4):**
  - Turnstile keys must be on the server for room creation to work in production.
  - The Cloudflare WAF rule is optional, as an extra edge layer.
- **Dependabot** watches Gradle, npm, GitHub Actions and Docker base images.
- **Follow-ups:**
  - M4 adds the Turnstile widget and checks whether it needs any `style-src` allowance.
  - M11 adds a local k6 load test of these limits and a `/security-review` pass before release.
