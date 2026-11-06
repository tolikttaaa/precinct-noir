package dev.ttaaa.precinctnoir.server

import dev.ttaaa.precinctnoir.server.protocol.ApiError
import dev.ttaaa.precinctnoir.server.protocol.CreateRoomResponse
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import dev.ttaaa.precinctnoir.server.security.ClientIp
import dev.ttaaa.precinctnoir.server.security.SocketGuard
import dev.ttaaa.precinctnoir.server.testing.TurnstileStub
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
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
import java.net.http.WebSocketHandshakeException
import java.util.concurrent.CompletionException

private const val SITE = "http://allowed.test"

/**
 * The abuse protections, wired into the running app. Each test acts as its own clients (via Cloudflare's
 * client-IP header), so limits used up in one test don't leak into another.
 */
@SpringBootTest(
    webEnvironment = RANDOM_PORT,
    properties = [
        "app.allowed-origins=$SITE",
        "app.turnstile.secret-key=test-secret",
        "app.turnstile.site-key=site-key-for-tests",
        "app.turnstile.timeout=500ms",
        "app.limits.create-room.requests=2",
        "app.limits.create-room.per=1h",
        "app.limits.join-room.requests=3",
        "app.limits.join-room.per=1h",
        "app.limits.failed-lookups.requests=2",
        "app.limits.failed-lookups.per=1h",
        "app.limits.api.requests=20",
        "app.limits.api.per=1h",
        "app.limits.sockets-per-client=2",
        "app.limits.sockets-total=4",
    ],
)
@Testcontainers
class SecurityIT {

    @LocalServerPort
    private var port = 0

    @Autowired
    private lateinit var sockets: SocketGuard

    private val http = HttpClient.newHttpClient()

    @Test
    fun `creating a room takes a Turnstile token that Cloudflare accepts for our site`() {
        assertThat(createRoom("10.1.0.1", body = "")).isEqualTo(400 to "malformed")
        assertThat(createRoom("10.1.0.2", token = "forged")).isEqualTo(403 to "captcha_failed")
        assertThat(createRoom("10.1.0.3", token = TurnstileStub.WRONG_HOST)).isEqualTo(403 to "captcha_failed")
        assertThat(createRoom("10.1.0.4", token = TurnstileStub.BROKEN)).isEqualTo(503 to "captcha_unavailable")
        assertThat(createRoom("10.1.0.5").first).isEqualTo(201)
    }

    @Test
    fun `each client may create only a few rooms`() {
        repeat(2) { assertThat(createRoom("10.2.0.1").first).isEqualTo(201) }
        val refused = post("/api/rooms", "10.2.0.1", """{"turnstileToken":"${TurnstileStub.PASS}"}""")
        assertThat(refused.statusCode() to error(refused)).isEqualTo(429 to "rate_limited")
        assertThat(refused.headers().firstValue("Retry-After").orElseThrow().toLong()).isBetween(1_790, 1_800)
        assertThat(createRoom("10.2.0.2").first).isEqualTo(201)
    }

    @Test
    fun `guessing room codes is throttled`() {
        val code = roomCode("10.3.9.9")
        assertThat(get("/api/rooms/BBBB", "10.3.0.1").statusCode()).isEqualTo(404)
        assertThat(post("/api/rooms/CCCC/players", "10.3.0.1", """{"name":"Guess"}""").statusCode()).isEqualTo(404)
        // Out of failed lookups: even a real code now waits.
        assertThat(get("/api/rooms/$code", "10.3.0.1").statusCode()).isEqualTo(429)
        assertThat(post("/api/rooms/$code/players", "10.3.0.1", """{"name":"Real"}""").statusCode()).isEqualTo(429)
        assertThat(get("/api/rooms/$code", "10.3.0.2").statusCode()).isEqualTo(200)
    }

    @Test
    fun `each client may join only a few times`() {
        val code = roomCode("10.4.9.9")
        for (name in listOf("Ann", "Bob", "Cy")) {
            assertThat(post("/api/rooms/$code/players", "10.4.0.1", """{"name":"$name"}""").statusCode()).isEqualTo(201)
        }
        assertThat(post("/api/rooms/$code/players", "10.4.0.1", """{"name":"Dee"}""").statusCode()).isEqualTo(429)
    }

    @Test
    fun `all API calls of a client count toward one limit`() {
        repeat(20) { assertThat(get("/api/modes", "10.5.0.1").statusCode()).isEqualTo(200) }
        assertThat(get("/api/modes", "10.5.0.1").statusCode()).isEqualTo(429)
        assertThat(get("/api/modes", "10.5.0.2").statusCode()).isEqualTo(200)
    }

    @Test
    fun `other sites can't create rooms or join through a visitor's browser`() {
        val body = """{"turnstileToken":"${TurnstileStub.PASS}"}"""
        val crossSite = post("/api/rooms", "10.6.0.1", body, origin = "https://evil.example")
        assertThat(crossSite.statusCode() to error(crossSite)).isEqualTo(403 to "forbidden_origin")
        assertThat(post("/api/rooms", "10.6.0.1", body, origin = SITE).statusCode()).isEqualTo(201)
        assertThat(get("/api/modes", "10.6.0.1", origin = "https://evil.example").statusCode()).isEqualTo(200)
    }

    @Test
    fun `the client config carries the public Turnstile site key`() {
        assertThat(get("/api/config", "10.7.0.1").body()).isEqualTo("""{"turnstileSiteKey":"site-key-for-tests"}""")
    }

    @Test
    fun `open sockets are capped per client and in total`() {
        val a = List(2) { socket("10.8.0.1") }
        assertThat(handshakeStatus { socket("10.8.0.1") }).isEqualTo(429)
        val b = List(2) { socket("10.8.0.2") }
        assertThat(handshakeStatus { socket("10.8.0.3") }).isEqualTo(429) // everyone together
        a.first().sendClose(WebSocket.NORMAL_CLOSURE, "bye").join()
        val deadline = System.nanoTime() + 5_000_000_000
        while (sockets.openSockets > 3 && System.nanoTime() < deadline) Thread.sleep(10)
        val c = socket("10.8.0.3")
        (a.drop(1) + b + c).forEach { it.sendClose(WebSocket.NORMAL_CLOSURE, "bye").join() }
    }

    // --- Helpers ---

    private fun createRoom(client: String, token: String = TurnstileStub.PASS, body: String = """{"turnstileToken":"$token"}"""): Pair<Int, String> {
        val res = post("/api/rooms", client, body)
        return res.statusCode() to (if (res.statusCode() == 201) "" else error(res))
    }

    private fun roomCode(client: String): String =
        ProtocolJson.decodeFromString(CreateRoomResponse.serializer(), post("/api/rooms", client, """{"turnstileToken":"${TurnstileStub.PASS}"}""").body()).code

    private fun error(res: HttpResponse<String>) = ProtocolJson.decodeFromString(ApiError.serializer(), res.body()).error

    private fun request(path: String, client: String, origin: String?) = HttpRequest.newBuilder(URI("http://localhost:$port$path"))
        .header(ClientIp.HEADER, client)
        .apply { origin?.let { header("Origin", it) } }

    private fun get(path: String, client: String, origin: String? = null): HttpResponse<String> =
        http.send(request(path, client, origin).GET().build(), HttpResponse.BodyHandlers.ofString())

    private fun post(path: String, client: String, body: String, origin: String? = null): HttpResponse<String> = http.send(
        request(path, client, origin).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    private fun socket(client: String): WebSocket = http.newWebSocketBuilder()
        .header("Origin", SITE)
        .header(ClientIp.HEADER, client)
        .buildAsync(URI("ws://localhost:$port/ws/echo"), object : WebSocket.Listener {})
        .join()

    private fun handshakeStatus(connect: () -> Unit): Int {
        var status = 0
        assertThatThrownBy(connect).isInstanceOf(CompletionException::class.java).satisfies({
            status = (it.cause as WebSocketHandshakeException).response.statusCode()
        })
        return status
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
        }
    }
}
