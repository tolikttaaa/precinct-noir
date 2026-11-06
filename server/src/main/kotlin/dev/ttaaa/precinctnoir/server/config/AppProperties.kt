package dev.ttaaa.precinctnoir.server.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Application settings under the `app.` prefix.
 *
 * @property allowedOrigins browser origins allowed to open WebSockets. Blocks cross-site WebSocket hijacking.
 */
@ConfigurationProperties("app")
data class AppProperties(
    val allowedOrigins: List<String> = listOf("https://precinctnoir.ttaaa.dev"),
    val rooms: RoomLimits = RoomLimits(),
    val ws: WsSettings = WsSettings(),
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
 */
data class WsSettings(
    val authTimeout: Duration = Duration.ofSeconds(5),
    val pingInterval: Duration = Duration.ofSeconds(25),
    val deadAfter: Duration = Duration.ofSeconds(60),
    val sendTimeLimit: Duration = Duration.ofSeconds(5),
    val sendBufferBytes: Int = 512 * 1024,
    val maxMessagesPerSecond: Int = 20,
)
