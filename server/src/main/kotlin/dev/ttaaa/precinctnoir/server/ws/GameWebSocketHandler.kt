package dev.ttaaa.precinctnoir.server.ws

import dev.ttaaa.precinctnoir.server.config.WsSettings
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage
import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.ProtocolError
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.room.Connection
import dev.ttaaa.precinctnoir.server.room.RoomService
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.PingMessage
import org.springframework.web.socket.PongMessage
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.io.IOException
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * The game gateway at `/ws` (see docs/PROTOCOL.md). Handles transport concerns (hello deadline,
 * keepalive pings, rate limit, parsing) and hands authenticated commands to [RoomService].
 */
class GameWebSocketHandler(
    private val rooms: RoomService,
    private val scheduler: ScheduledExecutorService,
    private val settings: WsSettings,
    private val clock: Clock,
) : TextWebSocketHandler() {
    private val sessions = ConcurrentHashMap<String, LiveSession>()

    val openSessions: Int get() = sessions.size

    override fun afterConnectionEstablished(session: WebSocketSession) {
        if (!rooms.accepting) {
            session.close(CloseStatus.SERVICE_RESTARTED)
            return
        }
        val decorated = ConcurrentWebSocketSessionDecorator(session, settings.sendTimeLimit.toMillis().toInt(), settings.sendBufferBytes)
        val live = LiveSession(decorated, clock.millis(), RateWindow(settings.maxMessagesPerSecond))
        sessions[session.id] = live
        scheduler.schedule({ if (!live.helloReceived) live.close(CloseReason.AUTH_TIMEOUT) }, settings.authTimeout.toMillis(), TimeUnit.MILLISECONDS)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val live = sessions[session.id] ?: return
        live.lastSeen = clock.millis()
        if (!live.rate.tryAcquire(System.nanoTime())) {
            live.close(CloseStatus.POLICY_VIOLATION.withReason("rate limit"))
            return
        }
        val parsed = try {
            ProtocolJson.decodeFromString(ClientMessage.serializer(), message.payload)
        } catch (e: IllegalArgumentException) { // includes SerializationException
            null
        }
        when {
            !live.helloReceived -> {
                if (parsed !is ClientMessage.Hello) {
                    live.close(CloseReason.HELLO_REQUIRED)
                    return
                }
                live.helloReceived = true
                rooms.attach(live, parsed)
            }
            parsed == null -> live.send(ServerMessage.Error(ProtocolError.MALFORMED))
            else -> rooms.handle(live, parsed)
        }
    }

    override fun handlePongMessage(session: WebSocketSession, message: PongMessage) {
        sessions[session.id]?.lastSeen = clock.millis()
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        session.close(CloseStatus.NOT_ACCEPTABLE.withReason("text frames only"))
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        sessions.remove(session.id)?.let(rooms::detach)
    }

    /** Pings every open socket and closes the ones that went silent. Called periodically. */
    fun keepAlive() {
        val now = clock.millis()
        for (live in sessions.values.toList()) {
            if (now - live.lastSeen >= settings.deadAfter.toMillis()) {
                live.close(CloseStatus.GOING_AWAY.withReason("timeout"))
            } else {
                live.ping()
            }
        }
    }
}

/** A socket as a [Connection]. Sends never throw: a failed send closes the socket instead. */
class LiveSession(private val session: WebSocketSession, @Volatile var lastSeen: Long, val rate: RateWindow) : Connection {
    override val id: String = session.id

    @Volatile
    var helloReceived = false

    override fun send(message: ServerMessage) = deliver(TextMessage(ProtocolJson.encodeToString(ServerMessage.serializer(), message)))

    fun ping() = deliver(PingMessage())

    override fun close(reason: CloseReason) = close(CloseStatus(reason.code, reason.name.lowercase()))

    fun close(status: CloseStatus) {
        try {
            if (session.isOpen) session.close(status)
        } catch (e: IOException) {
            // Already gone.
        }
    }

    private fun deliver(message: WebSocketMessage<*>) {
        if (!session.isOpen) return
        try {
            session.sendMessage(message)
        } catch (e: IOException) {
            close(CloseStatus.SESSION_NOT_RELIABLE)
        } catch (e: IllegalStateException) { // closed meanwhile, or the send buffer overflowed (the decorator closes it)
            close(CloseStatus.SESSION_NOT_RELIABLE)
        }
    }
}
