package dev.ttaaa.precinctnoir.server.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.net.URI
import java.time.Duration

/**
 * Application settings under the `app.` prefix.
 *
 * @property allowedOrigins browser origins allowed to open WebSockets and send `POST`s to the API.
 *   Blocks cross-site WebSocket hijacking and cross-site room creation.
 * @property version the release this build is, like `0.1.0`; blank between releases. The release workflow
 *   bakes it into the image as `APP_VERSION` (docs/RUNBOOK.md §5).
 * @property commit the full commit hash the build was made from (`APP_COMMIT`); blank for local builds.
 */
@ConfigurationProperties("app")
data class AppProperties(
    val allowedOrigins: List<String> = listOf("https://precinctnoir.ttaaa.dev"),
    val version: String = "",
    val commit: String = "",
    val rooms: RoomLimits = RoomLimits(),
    val ws: WsSettings = WsSettings(),
    val limits: AbuseLimits = AbuseLimits(),
    val turnstile: TurnstileSettings = TurnstileSettings(),
)

/** At most [requests] per [per] for one client, refilled smoothly. */
data class Rate(val requests: Long, val per: Duration)

/**
 * Per-client limits (a client is an IP address, or an IPv6 /64). Generous on purpose: a living room
 * full of phones shares one address. See docs/SECURITY.md.
 *
 * @property failedLookups room codes that turned out not to exist; once used up, every lookup waits.
 * @property api all `/api` requests together.
 */
data class AbuseLimits(
    val createRoom: Rate = Rate(5, Duration.ofMinutes(10)),
    val joinRoom: Rate = Rate(40, Duration.ofMinutes(10)),
    val failedLookups: Rate = Rate(10, Duration.ofMinutes(1)),
    val api: Rate = Rate(120, Duration.ofMinutes(1)),
    val socketsPerClient: Int = 30,
    val socketsTotal: Int = 3000,
)

/**
 * Cloudflare Turnstile, checked when a room is created. Without [secretKey] room creation is refused
 * (fail-closed). The dev profile uses Cloudflare's always-pass test keys.
 *
 * @property expectedHostname when set, a token must have been issued on this hostname.
 */
data class TurnstileSettings(
    val siteKey: String = "",
    val secretKey: String = "",
    val verifyUrl: URI = URI("https://challenges.cloudflare.com/turnstile/v0/siteverify"),
    val expectedHostname: String = "",
    val timeout: Duration = Duration.ofSeconds(5),
)

/**
 * Room capacity and lifetimes. Idle means no accepted command (joining counts; merely being connected doesn't).
 *
 * @property sweepInterval how often idle rooms are expired and turn timers checked.
 */
data class RoomLimits(
    val maxRooms: Int = 300,
    val maxPlayers: Int = 9,
    val lobbyIdle: Duration = Duration.ofMinutes(30),
    val gameIdle: Duration = Duration.ofHours(2),
    val finishedIdle: Duration = Duration.ofMinutes(15),
    val sweepInterval: Duration = Duration.ofSeconds(5),
)

/**
 * WebSocket transport settings.
 *
 * @property authTimeout the hello must arrive within this time.
 * @property pingInterval server pings keep Cloudflare (which drops idle sockets after ~100 s) and Caddy happy.
 * @property deadAfter a socket silent this long (no message, no pong) is closed.
 * @property sendTimeLimit / [sendBufferBytes] a client this slow to read is dropped instead of stalling its room.
 * @property messagesPerSecond / [messageBurst] a token bucket per socket; a client that empties it is closed (1008).
 */
data class WsSettings(
    val authTimeout: Duration = Duration.ofSeconds(5),
    val pingInterval: Duration = Duration.ofSeconds(25),
    val deadAfter: Duration = Duration.ofSeconds(60),
    val sendTimeLimit: Duration = Duration.ofSeconds(5),
    val sendBufferBytes: Int = 512 * 1024,
    val messagesPerSecond: Long = 10,
    val messageBurst: Long = 20,
)
