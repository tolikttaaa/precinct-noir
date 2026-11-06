package dev.ttaaa.precinctnoir.server.ws

import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

/**
 * Echoes text frames back. A deployment smoke test for WebSocket passthrough.
 *
 * Even as a diagnostic it is rate limited: more than [MAX_MESSAGES_PER_SECOND] frames
 * within one second closes the session with 1008 (policy violation). Binary frames are refused.
 */
class EchoWebSocketHandler : TextWebSocketHandler() {

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val window = session.attributes.getOrPut(WINDOW_KEY) { RateWindow() } as RateWindow
        if (!window.tryAcquire(System.nanoTime())) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("rate limit"))
            return
        }
        session.sendMessage(TextMessage(message.payload))
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        session.close(CloseStatus.NOT_ACCEPTABLE.withReason("text frames only"))
    }

    /** Fixed one-second window counter; one per session, used only from that session's handler thread. */
    private class RateWindow {
        private var windowStart = 0L
        private var count = 0

        fun tryAcquire(now: Long): Boolean {
            if (now - windowStart >= ONE_SECOND_NANOS) {
                windowStart = now
                count = 0
            }
            return ++count <= MAX_MESSAGES_PER_SECOND
        }
    }

    companion object {
        const val MAX_MESSAGES_PER_SECOND = 20
        private const val ONE_SECOND_NANOS = 1_000_000_000L
        private const val WINDOW_KEY = "echo.rate"
    }
}
