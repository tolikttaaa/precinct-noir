package dev.ttaaa.precinctnoir.server.security

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.WebSocketHandlerDecorator
import org.springframework.web.socket.server.HandshakeInterceptor
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Caps open sockets: at most [perClient] per client and [total] overall, across `/ws` and `/ws/echo`.
 *
 * The handshake check turns most excess sockets away with HTTP 429 before any upgrade. It can't reserve
 * a slot (a handshake may still fail later), so the binding count happens when a socket opens, in
 * [guard]: a socket that loses the race is closed with 1013 (try again later).
 */
class SocketGuard(private val perClient: Int, private val total: Int) : HandshakeInterceptor {
    private val log = LoggerFactory.getLogger(SocketGuard::class.java)
    private val byClient = ConcurrentHashMap<String, Int>()
    private val open = AtomicInteger()

    val openSockets: Int get() = open.get()

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val client = ClientIp.of((request as ServletServerHttpRequest).servletRequest)
        attributes[CLIENT] = client
        if (open.get() < total && (byClient[client] ?: 0) < perClient) return true
        log.info("Refused a socket for client {}: too many open", ClientIp.pseudonym(client))
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS)
        return false
    }

    override fun afterHandshake(request: ServerHttpRequest, response: ServerHttpResponse, wsHandler: WebSocketHandler, exception: Exception?) = Unit

    /** Wraps [handler] so each of its sockets holds a slot while open. */
    fun guard(handler: WebSocketHandler): WebSocketHandler = Admitting(handler)

    internal fun admit(client: String): Boolean {
        if (open.incrementAndGet() > total) {
            open.decrementAndGet()
            return false
        }
        var admitted = false
        byClient.compute(client) { _, count ->
            val now = count ?: 0
            if (now >= perClient) {
                count
            } else {
                admitted = true
                now + 1
            }
        }
        if (!admitted) open.decrementAndGet()
        return admitted
    }

    internal fun release(client: String) {
        byClient.computeIfPresent(client) { _, count -> (count - 1).takeIf { it > 0 } }
        open.decrementAndGet()
    }

    private inner class Admitting(delegate: WebSocketHandler) : WebSocketHandlerDecorator(delegate) {
        override fun afterConnectionEstablished(session: WebSocketSession) {
            val client = session.attributes[CLIENT] as? String ?: ClientIp.UNKNOWN
            if (!admit(client)) {
                session.close(CloseStatus.SERVICE_OVERLOAD.withReason("too many sockets"))
                return
            }
            session.attributes[ADMITTED] = client
            super.afterConnectionEstablished(session)
        }

        override fun handleMessage(session: WebSocketSession, message: WebSocketMessage<*>) {
            if (ADMITTED in session.attributes) super.handleMessage(session, message)
        }

        override fun afterConnectionClosed(session: WebSocketSession, closeStatus: CloseStatus) {
            val client = session.attributes.remove(ADMITTED) as? String ?: return
            release(client)
            super.afterConnectionClosed(session, closeStatus)
        }
    }

    companion object {
        /** Session attribute holding the client key, set during the handshake. */
        const val CLIENT = "precinctnoir.client"
        private const val ADMITTED = "precinctnoir.admitted"
    }
}
