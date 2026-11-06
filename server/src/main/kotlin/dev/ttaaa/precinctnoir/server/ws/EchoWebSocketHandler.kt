package dev.ttaaa.precinctnoir.server.ws

import dev.ttaaa.precinctnoir.server.config.WsSettings
import dev.ttaaa.precinctnoir.server.security.tokenBucket
import io.github.bucket4j.Bucket
import io.github.bucket4j.TimeMeter
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.time.Duration

/**
 * Echoes text frames back. A deployment smoke test for WebSocket passthrough.
 *
 * Even as a diagnostic it is rate limited like the game socket: a client that empties its token bucket
 * is closed with 1008 (policy violation). Binary frames are refused.
 */
class EchoWebSocketHandler(private val settings: WsSettings) : TextWebSocketHandler() {

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val bucket = session.attributes.getOrPut(BUCKET_KEY) {
            tokenBucket(settings.messageBurst, settings.messagesPerSecond, Duration.ofSeconds(1), TimeMeter.SYSTEM_NANOTIME)
        } as Bucket
        if (!bucket.tryConsume(1)) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("rate limit"))
            return
        }
        session.sendMessage(TextMessage(message.payload))
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        session.close(CloseStatus.NOT_ACCEPTABLE.withReason("text frames only"))
    }

    private companion object {
        const val BUCKET_KEY = "echo.rate"
    }
}
