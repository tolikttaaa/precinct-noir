package dev.ttaaa.precinctnoir.server.ws

import dev.ttaaa.precinctnoir.server.config.RoomLimits
import dev.ttaaa.precinctnoir.server.config.WsSettings
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage
import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.ProtocolError
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.room.RoomService
import dev.ttaaa.precinctnoir.server.testing.FakeRepository
import dev.ttaaa.precinctnoir.server.testing.MutableClock
import dev.ttaaa.precinctnoir.server.testing.SeededRandomness
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.PingMessage
import org.springframework.web.socket.PongMessage
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketExtension
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import java.io.IOException
import java.net.InetSocketAddress
import java.net.URI
import java.nio.ByteBuffer
import java.security.Principal
import java.time.Duration
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** A socket that records frames; it can be told to fail. */
class FakeSession(private val id: String) : WebSocketSession {
    val sent = mutableListOf<WebSocketMessage<*>>()
    var closedWith: CloseStatus? = null
    var sendFailure: Exception? = null
    var closeFailure: IOException? = null
    private val attributes = mutableMapOf<String, Any>()

    val texts: List<ServerMessage>
        get() = sent.filterIsInstance<TextMessage>().map { ProtocolJson.decodeFromString(ServerMessage.serializer(), it.payload) }

    override fun getId() = id

    override fun getUri(): URI? = null

    override fun getHandshakeHeaders() = HttpHeaders()

    override fun getAttributes() = attributes

    override fun getPrincipal(): Principal? = null

    override fun getLocalAddress(): InetSocketAddress? = null

    override fun getRemoteAddress(): InetSocketAddress? = null

    override fun getAcceptedProtocol(): String? = null

    override fun setTextMessageSizeLimit(messageSizeLimit: Int) = Unit

    override fun getTextMessageSizeLimit() = 0

    override fun setBinaryMessageSizeLimit(messageSizeLimit: Int) = Unit

    override fun getBinaryMessageSizeLimit() = 0

    override fun getExtensions(): List<WebSocketExtension> = emptyList()

    override fun sendMessage(message: WebSocketMessage<*>) {
        sendFailure?.let { throw it }
        sent += message
    }

    override fun isOpen() = closedWith == null

    override fun close() = close(CloseStatus.NORMAL)

    override fun close(status: CloseStatus) {
        closeFailure?.let { throw it }
        closedWith = status
    }
}

/** Runs scheduled tasks only when the test says so. */
class ManualScheduler : ScheduledThreadPoolExecutor(1) {
    val pending = mutableListOf<Runnable>()

    override fun schedule(command: Runnable, delay: Long, unit: TimeUnit): ScheduledFuture<*> {
        pending += command
        return super.schedule({}, 0, unit)
    }

    fun runAll() = pending.toList().also { pending.clear() }.forEach(Runnable::run)
}

class GameWebSocketHandlerTest {
    private val clock = MutableClock()
    private val rooms = RoomService(FakeRepository(), clock, SeededRandomness(3), RoomLimits())
    private val scheduler = ManualScheduler()
    private val settings = WsSettings(maxMessagesPerSecond = 5)
    private val handler = GameWebSocketHandler(rooms, scheduler, settings, clock)
    private val created = rooms.create()

    @AfterEach
    fun stop() {
        scheduler.shutdownNow()
    }

    private fun open(id: String = "s1") = FakeSession(id).also(handler::afterConnectionEstablished)

    private fun FakeSession.receive(message: ClientMessage) = receive(ProtocolJson.encodeToString(ClientMessage.serializer(), message))

    private fun FakeSession.receive(text: String) = handler.handleMessage(this, TextMessage(text))

    private fun FakeSession.hello() = receive(ClientMessage.Hello(created.code, created.hostToken))

    @Test
    fun `a socket that never says hello is closed at the deadline`() {
        val silent = open("silent")
        val polite = open("polite").apply { hello() }
        scheduler.runAll()
        assertThat(silent.closedWith).isEqualTo(CloseStatus(CloseReason.AUTH_TIMEOUT.code, "auth_timeout"))
        assertThat(polite.closedWith).isNull()
        assertThat(polite.texts.first()).isInstanceOf(ServerMessage.Welcome::class.java)
    }

    @Test
    fun `the first message must be a hello`() {
        open("a").apply { receive(ClientMessage.Start(1)) }.let { assertThat(it.closedWith?.code).isEqualTo(CloseReason.HELLO_REQUIRED.code) }
        open("b").apply { receive("{not json") }.let { assertThat(it.closedWith?.code).isEqualTo(CloseReason.HELLO_REQUIRED.code) }
        open("c").apply { receive(ClientMessage.Hello(created.code, "wrong")) }.let { assertThat(it.closedWith?.code).isEqualTo(CloseReason.BAD_TOKEN.code) }
    }

    @Test
    fun `after hello, malformed input gets an error and commands reach the room`() {
        val tv = open().apply { hello() }
        tv.receive("""{"t":"teleport"}""")
        assertThat(tv.texts.last()).isEqualTo(ServerMessage.Error(ProtocolError.MALFORMED))
        tv.receive(ClientMessage.Start(1))
        assertThat(tv.texts.last()).isEqualTo(ServerMessage.Rejected(1, dev.ttaaa.precinctnoir.server.protocol.Refusal.NOT_VIP))
        assertThat(tv.closedWith).isNull()
    }

    @Test
    fun `floods close with 1008 and binary frames with 1003`() {
        val flood = open("flood").apply { hello() }
        repeat(5) { flood.receive("{}") }
        assertThat(flood.closedWith).isEqualTo(CloseStatus.POLICY_VIOLATION.withReason("rate limit"))
        val binary = open("binary")
        handler.handleMessage(binary, BinaryMessage(ByteBuffer.allocate(1)))
        assertThat(binary.closedWith?.code).isEqualTo(CloseStatus.NOT_ACCEPTABLE.code)
    }

    @Test
    fun `keepalive pings live sockets and drops silent ones`() {
        val talker = open("talker").apply { hello() }
        val ponger = open("ponger").apply { hello() }
        val silent = open("silent").apply { hello() }
        clock.advance(Duration.ofSeconds(59))
        handler.handleMessage(ponger, PongMessage())
        talker.receive("{}")
        handler.handleMessage(FakeSession("unknown"), PongMessage())
        clock.advance(Duration.ofSeconds(1))
        handler.keepAlive()
        assertThat(silent.closedWith).isEqualTo(CloseStatus.GOING_AWAY.withReason("timeout"))
        assertThat(talker.sent.last()).isInstanceOf(PingMessage::class.java)
        assertThat(ponger.sent.last()).isInstanceOf(PingMessage::class.java)
    }

    @Test
    fun `closing a socket detaches it from its room`() {
        val tv = open().apply { hello() }
        assertThat(handler.openSessions).isEqualTo(1)
        handler.afterConnectionClosed(tv, CloseStatus.NORMAL)
        handler.afterConnectionClosed(tv, CloseStatus.NORMAL)
        assertThat(handler.openSessions).isZero()
        handler.handleMessage(tv, TextMessage("{}")) // late frame from a closed socket: ignored
        assertThat(tv.texts).hasSize(2) // welcome + room
    }

    @Test
    fun `during shutdown new sockets are refused with 1012`() {
        rooms.shutdown()
        assertThat(open().closedWith).isEqualTo(CloseStatus.SERVICE_RESTARTED)
    }

    @Test
    fun `a socket that fails to send or close is handled without throwing`() {
        val rate = RateWindow(10)
        val broken = FakeSession("broken").apply { sendFailure = IOException("reset") }
        LiveSession(broken, 0, rate).send(ServerMessage.Error(ProtocolError.MALFORMED))
        assertThat(broken.closedWith).isEqualTo(CloseStatus.SESSION_NOT_RELIABLE)

        val overflowing = FakeSession("overflow").apply { sendFailure = IllegalStateException("buffer") }
        LiveSession(overflowing, 0, rate).ping()
        assertThat(overflowing.closedWith).isEqualTo(CloseStatus.SESSION_NOT_RELIABLE)

        val closed = FakeSession("closed").apply { close() }
        LiveSession(closed, 0, rate).apply { send(ServerMessage.Error(ProtocolError.MALFORMED)); close(CloseReason.KICKED) }
        assertThat(closed.sent).isEmpty()
        assertThat(closed.closedWith).isEqualTo(CloseStatus.NORMAL)

        val stubborn = FakeSession("stubborn").apply { closeFailure = IOException("gone") }
        LiveSession(stubborn, 0, rate).close(CloseReason.KICKED)
        assertThat(stubborn.closedWith).isNull()
    }

    @Test
    fun `the rate window allows a burst per second`() {
        val window = RateWindow(2)
        assertThat(listOf(0L, 1L, 2L).map(window::tryAcquire)).containsExactly(true, true, false)
        assertThat(window.tryAcquire(1_000_000_000L)).isTrue()
    }
}
