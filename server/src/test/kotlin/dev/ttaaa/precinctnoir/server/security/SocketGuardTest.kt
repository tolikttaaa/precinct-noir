package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.ws.FakeSession
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.http.server.ServletServerHttpResponse
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

class SocketGuardTest {
    private val guard = SocketGuard(perClient = 2, total = 3)
    private val seen = mutableListOf<String>()
    private val handler = guard.guard(
        object : TextWebSocketHandler() {
            override fun afterConnectionEstablished(session: WebSocketSession) {
                seen += "open ${session.id}"
            }

            override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                seen += "text ${session.id}"
            }

            override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
                seen += "closed ${session.id}"
            }
        },
    )

    /** The handshake check for [client]: the HTTP status it answers (101 stands for "go ahead"). */
    private fun handshake(client: String): Int {
        val response = MockHttpServletResponse()
        val attributes = mutableMapOf<String, Any>()
        val request = ServletServerHttpRequest(MockHttpServletRequest().apply { addHeader(ClientIp.HEADER, client) })
        val ok = guard.beforeHandshake(request, ServletServerHttpResponse(response), handler, attributes)
        guard.afterHandshake(request, ServletServerHttpResponse(response), handler, null)
        if (ok) assertThat(attributes).containsEntry(SocketGuard.CLIENT, client)
        return if (ok) 101 else response.status
    }

    private fun open(id: String, client: String?) = FakeSession(id).apply {
        client?.let { attributes[SocketGuard.CLIENT] = it }
        handler.afterConnectionEstablished(this)
        handler.handleMessage(this, TextMessage("hi"))
    }

    private fun FakeSession.closeNow() = handler.afterConnectionClosed(this, CloseStatus.NORMAL)

    @Test
    fun `each client may hold a few sockets, and everyone together a few more`() {
        val a1 = open("a1", "198.51.100.1")
        open("a2", "198.51.100.1")
        assertThat(handshake("198.51.100.1")).isEqualTo(429)
        assertThat(handshake("198.51.100.2")).isEqualTo(101)
        open("b1", "198.51.100.2")
        assertThat(guard.openSockets).isEqualTo(3)
        assertThat(handshake("198.51.100.3")).isEqualTo(429) // the total is reached
        assertThat(seen).containsExactly("open a1", "text a1", "open a2", "text a2", "open b1", "text b1")

        a1.closeNow()
        assertThat(seen.last()).isEqualTo("closed a1")
        assertThat(guard.openSockets).isEqualTo(2)
        assertThat(handshake("198.51.100.1")).isEqualTo(101)
        assertThat(handshake("198.51.100.3")).isEqualTo(101)
    }

    @Test
    fun `a socket that slips past the handshake check over the cap is closed with 1013 and never seen`() {
        open("a1", "198.51.100.1")
        open("a2", "198.51.100.1")
        val extra = open("a3", "198.51.100.1")
        open("b1", "198.51.100.2")
        val late = open("c1", "198.51.100.3")
        for (socket in listOf(extra, late)) {
            assertThat(socket.closedWith?.code).isEqualTo(CloseStatus.SERVICE_OVERLOAD.code)
            socket.closeNow()
        }
        assertThat(seen).noneMatch { it.endsWith("a3") || it.endsWith("c1") }
        assertThat(guard.openSockets).isEqualTo(3)
    }

    @Test
    fun `sockets without a known client share one slot group`() {
        open("u1", null)
        open("u2", null)
        assertThat(open("u3", null).closedWith?.code).isEqualTo(CloseStatus.SERVICE_OVERLOAD.code)
        assertThat(guard.openSockets).isEqualTo(2)
    }
}
