package dev.ttaaa.precinctnoir.server

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.testing.sample
import dev.ttaaa.precinctnoir.server.protocol.ApiError
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage
import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.CreateRoomResponse
import dev.ttaaa.precinctnoir.server.protocol.JoinResponse
import dev.ttaaa.precinctnoir.server.protocol.ModeInfo
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import dev.ttaaa.precinctnoir.server.protocol.Role
import dev.ttaaa.precinctnoir.server.protocol.RoomSummary
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.protocol.You
import dev.ttaaa.precinctnoir.server.room.CommandRecord
import dev.ttaaa.precinctnoir.server.room.EventWrite
import dev.ttaaa.precinctnoir.server.room.JdbcRoomRepository
import dev.ttaaa.precinctnoir.server.room.PersistedRoom
import dev.ttaaa.precinctnoir.server.room.RoomSnapshot
import dev.ttaaa.precinctnoir.server.room.RoomStatus
import dev.ttaaa.precinctnoir.server.room.StoredEvent
import dev.ttaaa.precinctnoir.server.testing.TurnstileStub
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.SpringApplication
import org.springframework.boot.SpringApplicationHook
import org.springframework.boot.SpringApplicationRunListener
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.WebSocket
import java.nio.ByteBuffer
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionStage
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

private const val ORIGIN = "http://allowed.test"

@SpringBootTest(
    webEnvironment = RANDOM_PORT,
    properties = [
        "app.allowed-origins=$ORIGIN",
        "app.ws.auth-timeout=500ms",
        "app.ws.ping-interval=200ms",
        "app.rooms.sweep-interval=1h",
        // Many rooms come from one test client here; SecurityIT covers the limits.
        "app.limits.create-room.requests=1000",
        "app.limits.create-room.per=1m",
    ],
)
@Testcontainers
class PlatformIT {

    @LocalServerPort
    private var port = 0

    @Autowired
    private lateinit var jdbc: JdbcClient

    @Autowired
    private lateinit var repository: JdbcRoomRepository

    private val http = HttpClient.newHttpClient()

    // --- HTTP API ---

    @Test
    fun `the room API creates, describes and joins rooms`() {
        val created = createRoom()
        assertThat(created.code).matches("[BCDFGHJKLMNPQRSTVWXZ]{4}")
        val joined = join(created.code, "Ann")
        assertThat(joined.playerId).isEqualTo(1)
        val summary = get("/api/rooms/${created.code.lowercase()}")
        assertThat(summary.statusCode()).isEqualTo(200)
        assertThat(ProtocolJson.decodeFromString(RoomSummary.serializer(), summary.body()))
            .isEqualTo(RoomSummary(created.code, RoomStatus.LOBBY, 1, 9, "killer_inspector"))
        val modes = ProtocolJson.decodeFromString(ListSerializer(ModeInfo.serializer()), get("/api/modes").body())
        assertThat(modes.map { it.id }).containsExactly("killer_inspector")
        assertThat(get("/api/modes").body()).contains(""""t":"toggle","key":"interrogateDeadOnBoard"""")
        assertThat(get("/api/config").body()).isEqualTo("{}") // no Turnstile site key configured here
    }

    @Test
    fun `API errors are i18n codes, never prose`() {
        val code = createRoom().code
        join(code, "Ann")
        fun error(res: HttpResponse<String>) = res.statusCode() to ProtocolJson.decodeFromString(ApiError.serializer(), res.body()).error
        assertThat(error(post("/api/rooms/$code/players", """{"name":"ann"}"""))).isEqualTo(409 to "name_taken")
        assertThat(error(post("/api/rooms/$code/players", """{"name":"\u0007"}"""))).isEqualTo(422 to "invalid_name")
        assertThat(error(post("/api/rooms/$code/players", """{"name":"Bo","admin":true}"""))).isEqualTo(400 to "malformed")
        assertThat(error(post("/api/rooms/$code/players", ""))).isEqualTo(400 to "malformed")
        assertThat(error(post("/api/rooms/ZZZZ/players", """{"name":"Bo"}"""))).isEqualTo(404 to "room_not_found")
        assertThat(error(get("/api/rooms/nope"))).isEqualTo(404 to "room_not_found")
    }

    // --- WebSocket ---

    @Test
    fun `a TV and two players play over the socket, and a reconnect resumes where it left off`() {
        val table = SocketTable(port)
        table.start()
        table.play(steps = 6)
        val ann = table.players.getValue(1)
        val seen = ann.events()
        val resumed = Client(port).apply { send(ClientMessage.Hello(table.code, table.tokens.getValue(1), lastEventSeq = seen[1].seq)) }
        assertThat(resumed.await<ServerMessage.Welcome>()).isEqualTo(ServerMessage.Welcome(You(Role.PLAYER, 1)))
        assertThat(resumed.await<ServerMessage.Game>()).isEqualTo(ann.latest<ServerMessage.Game>())
        assertThat(resumed.await<ServerMessage.Events>().events).isEqualTo(seen.drop(2))
        table.closeAll()
        resumed.close()
    }

    @Test
    fun `sockets must say hello in time with a valid token, from an allowed origin`() {
        val room = createRoom()
        assertThat(Client(port).closed.get(5, TimeUnit.SECONDS)).isEqualTo(CloseReason.AUTH_TIMEOUT.code)
        assertThat(Client(port).apply { send(ClientMessage.Start(1)) }.closed.get(5, TimeUnit.SECONDS)).isEqualTo(CloseReason.HELLO_REQUIRED.code)
        val impostor = Client(port).apply { send(ClientMessage.Hello(room.code, "forged")) }
        assertThat(impostor.await<ServerMessage.Closing>()).isEqualTo(ServerMessage.Closing(CloseReason.BAD_TOKEN))
        assertThat(impostor.closed.get(5, TimeUnit.SECONDS)).isEqualTo(CloseReason.BAD_TOKEN.code)
        assertThatThrownBy { Client(port, origin = "http://evil.test") }.hasCauseInstanceOf(java.net.http.WebSocketHandshakeException::class.java)
        val big = Client(port).apply { socket.sendText("x".repeat(5_000), true) }
        assertThat(big.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1009)
        val binary = Client(port).apply { socket.sendBinary(ByteBuffer.wrap(byteArrayOf(1)), true) }
        assertThat(binary.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1003)
    }

    @Test
    fun `the server pings connected sockets to keep them alive through Cloudflare`() {
        val room = createRoom()
        val tv = Client(port).apply { send(ClientMessage.Hello(room.code, room.hostToken)) }
        tv.await<ServerMessage.Welcome>()
        assertThat(tv.pinged.get(5, TimeUnit.SECONDS)).isTrue()
        tv.close()
    }

    @Test
    fun `a restarted server restores the game from Postgres, and stopping it closes sockets with 1012`() {
        val table = SocketTable(port)
        table.start()
        table.play(steps = 3)
        val before = table.players.getValue(1).latest<ServerMessage.Game>()

        val second = boot()
        try {
            val secondPort = (second as WebServerApplicationContext).webServer!!.port
            val ann = Client(secondPort).apply { send(ClientMessage.Hello(table.code, table.tokens.getValue(1))) }
            assertThat(ann.await<ServerMessage.Game>()).isEqualTo(before)
            second.close()
            assertThat(ann.await<ServerMessage.Closing>()).isEqualTo(ServerMessage.Closing(CloseReason.RESTARTING))
            assertThat(ann.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1012)
        } finally {
            second.close()
            table.closeAll()
        }
    }

    // --- Persistence ---

    @Test
    fun `the repository keeps the room, its case log and its commands together`() {
        val snap = RoomSnapshot("QQQQ", RoomStatus.IN_GAME, 1, 1, "hash", mode = "killer_inspector", config = JsonObject(emptyMap()))
        val events = listOf(StoredEvent(1, Audience.Public, JsonPrimitive("a")), StoredEvent(2, Audience.ToPlayer(Seat(1)), JsonPrimitive("b")))
        repository.save(PersistedRoom(snap, JsonObject(mapOf("x" to JsonPrimitive(1)))), 7, EventWrite(false, events), CommandRecord(1, 7, JsonPrimitive("cmd")))
        val loaded = repository.loadAll().single { it.room.room.code == "QQQQ" }
        assertThat(loaded.room).isEqualTo(PersistedRoom(snap, JsonObject(mapOf("x" to JsonPrimitive(1)))))
        assertThat(loaded.events).isEqualTo(events)
        assertThat(row("SELECT status || ':' || action_seq FROM rooms WHERE code = 'QQQQ'")).isEqualTo("in_game:7")
        assertThat(row("SELECT count(*)::text FROM room_commands WHERE code = 'QQQQ'")).isEqualTo("1")

        repository.save(PersistedRoom(snap.copy(status = RoomStatus.LOBBY)), 0, EventWrite.RESET)
        assertThat(repository.loadAll().single { it.room.room.code == "QQQQ" }.events).isEmpty()
        repository.delete("QQQQ")
        assertThat(repository.loadAll().none { it.room.room.code == "QQQQ" }).isTrue()
        assertThat(row("SELECT count(*)::text FROM room_commands WHERE code = 'QQQQ'")).isEqualTo("0")
    }

    // --- Helpers ---

    private fun row(sql: String): String = jdbc.sql(sql).query { rs, _ -> rs.getString(1) }.single()

    private fun get(path: String): HttpResponse<String> =
        http.send(HttpRequest.newBuilder(URI("http://localhost:$port$path")).GET().build(), HttpResponse.BodyHandlers.ofString())

    private fun post(path: String, body: String): HttpResponse<String> = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port$path"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    private fun createRoom(): CreateRoomResponse = createRoom(http, port)

    private fun join(code: String, name: String): JoinResponse = join(http, port, code, name)

    /** Boots a second instance of the app on the same database, as a deploy would. */
    private fun boot(): ConfigurableApplicationContext {
        var context: ConfigurableApplicationContext? = null
        val capture = SpringApplicationHook {
            object : SpringApplicationRunListener {
                override fun ready(ctx: ConfigurableApplicationContext, timeTaken: Duration?) {
                    context = ctx
                }
            }
        }
        SpringApplication.withHook(capture, Runnable {
            main(
                arrayOf(
                    "--server.port=0",
                    "--app.allowed-origins=$ORIGIN",
                    "--spring.datasource.url=${postgres.jdbcUrl}",
                    "--spring.datasource.username=${postgres.username}",
                    "--spring.datasource.password=${postgres.password}",
                ),
            )
        })
        return checkNotNull(context) { "second instance never became ready" }
    }

    companion object {
        @Container
        @ServiceConnection
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18-alpine")

        @DynamicPropertySource
        @JvmStatic
        fun turnstile(registry: DynamicPropertyRegistry) {
            registry.add("app.turnstile.verify-url") { TurnstileStub.url.toString() }
            registry.add("app.turnstile.secret-key") { "test-secret" }
        }
    }
}

private fun createRoom(http: HttpClient, port: Int): CreateRoomResponse {
    val res = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port/api/rooms"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("""{"turnstileToken":"${TurnstileStub.PASS}"}"""))
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )
    assertThat(res.statusCode()).isEqualTo(201)
    return ProtocolJson.decodeFromString(CreateRoomResponse.serializer(), res.body())
}

private fun join(http: HttpClient, port: Int, code: String, name: String): JoinResponse {
    val res = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port/api/rooms/$code/players"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("""{"name":"$name"}"""))
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )
    assertThat(res.statusCode()).isEqualTo(201)
    return ProtocolJson.decodeFromString(JoinResponse.serializer(), res.body())
}

/** A room with a TV and two connected players (ids 1 and 2), driven over real sockets. */
private class SocketTable(port: Int) {
    private val http = HttpClient.newHttpClient()
    private val created = createRoom(http, port)
    val code = created.code
    val tokens = listOf("Ann", "Bob").associate { name -> join(http, port, code, name).let { it.playerId to it.playerToken } }
    val tv = Client(port).apply { send(ClientMessage.Hello(code, created.hostToken)) }
    val players = tokens.mapValues { (_, token) -> Client(port).apply { send(ClientMessage.Hello(code, token)) } }
    private var seq = 0L

    fun start() {
        (players.values + tv).forEach { it.await<ServerMessage.Welcome>() }
        val vip = players.getValue(1)
        vip.send(ClientMessage.Start(++seq))
        players.values.forEach { it.await<ServerMessage.Game>() }
        assertThat(vip.await<ServerMessage.Ack>()).isEqualTo(ServerMessage.Ack(seq))
    }

    /** Each step: the player with legal options picks one; everyone gets the new state. Stops early if the game ends. */
    fun play(steps: Int) {
        val rng = Rng.seeded(11)
        repeat(steps) {
            // Seeds are random per room, so a game can (rarely) be over within a few moves.
            val actor = players.values.singleOrNull { it.latest<ServerMessage.Game>().legal.isNotEmpty() } ?: return
            val game = actor.latest<ServerMessage.Game>()
            val decision = game.view.jsonObject["pending"]!!.jsonObject["id"]!!.jsonPrimitive.int
            actor.send(ClientMessage.Act(++seq, decision, game.legal[rng.nextInt(game.legal.size)].sample(rng)))
            players.values.forEach { it.await<ServerMessage.Game>() }
            assertThat(actor.await<ServerMessage.Ack>()).isEqualTo(ServerMessage.Ack(seq))
        }
    }

    fun closeAll() = (players.values + tv).forEach(Client::close)
}

/** A browser-like socket client that records every server message in order. */
private class Client(port: Int, origin: String = ORIGIN) : WebSocket.Listener {
    val messages = CopyOnWriteArrayList<ServerMessage>()
    val closed = CompletableFuture<Int>()
    val pinged = CompletableFuture<Boolean>()
    private var cursor = 0
    private val buffer = StringBuilder()
    val socket: WebSocket = HttpClient.newHttpClient().newWebSocketBuilder()
        .header("Origin", origin)
        .buildAsync(URI("ws://localhost:$port/ws"), this)
        .join()

    fun send(message: ClientMessage) {
        socket.sendText(ProtocolJson.encodeToString(ClientMessage.serializer(), message), true).join()
    }

    /** The next message of type [T] after the previous await; earlier ones stay in [messages]. */
    inline fun <reified T : ServerMessage> await(): T {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
        while (System.nanoTime() < deadline) {
            val index = (cursor..<messages.size).firstOrNull { messages[it] is T }
            if (index != null) {
                cursor = index + 1
                return messages[index] as T
            }
            Thread.sleep(10)
        }
        throw AssertionError("no ${T::class.simpleName} within 5 s; got ${messages.map { it::class.simpleName }}")
    }

    inline fun <reified T : ServerMessage> latest(): T = messages.filterIsInstance<T>().last()

    fun events() = messages.filterIsInstance<ServerMessage.Events>().flatMap { it.events }

    fun close() {
        if (!socket.isOutputClosed) socket.sendClose(WebSocket.NORMAL_CLOSURE, "bye")
    }

    override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
        buffer.append(data)
        if (last) {
            messages += ProtocolJson.decodeFromString(ServerMessage.serializer(), buffer.toString())
            buffer.clear()
        }
        webSocket.request(1)
        return null
    }

    override fun onPing(webSocket: WebSocket, message: ByteBuffer): CompletionStage<*>? {
        pinged.complete(true)
        webSocket.request(1)
        return null
    }

    override fun onClose(webSocket: WebSocket, statusCode: Int, reason: String): CompletionStage<*>? {
        closed.complete(statusCode)
        return null
    }

    override fun onError(webSocket: WebSocket, error: Throwable) {
        closed.completeExceptionally(error)
    }
}
