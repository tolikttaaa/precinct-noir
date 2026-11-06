package dev.ttaaa.precinctnoir.server

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
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.simple.JdbcClient
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.WebSocket
import java.net.http.WebSocketHandshakeException
import java.nio.ByteBuffer
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionStage
import java.util.concurrent.TimeUnit

@SpringBootTest(webEnvironment = RANDOM_PORT, properties = ["app.allowed-origins=$ALLOWED_ORIGIN"])
@Testcontainers
class WalkingSkeletonIT {

    @LocalServerPort
    private var port = 0

    @Autowired
    private lateinit var jdbc: JdbcClient

    private val http = HttpClient.newHttpClient()

    @Test
    fun `health endpoint reports UP`() {
        val res = get("/actuator/health")
        assertThat(res.statusCode()).isEqualTo(200)
        assertThat(res.body()).contains("\"status\":\"UP\"")
    }

    @Test
    fun `flyway migrations ran against postgres`() {
        val owner = jdbc.sql("SELECT value FROM app_meta WHERE key = 'schema_owner'").query(String::class.java).single()
        assertThat(owner).isEqualTo("precinctnoir")
    }

    @Test
    fun `client-side routes fall back to the SPA shell`() {
        val res = get("/play/ABCD")
        assertThat(res.statusCode()).isEqualTo(200)
        assertThat(res.body()).contains("spa-shell")
        assertThat(res.headers().firstValue("Cache-Control")).hasValue("no-store")
    }

    @Test
    fun `existing static files are served directly`() {
        val res = get("/index.html")
        assertThat(res.statusCode()).isEqualTo(200)
        assertThat(res.body()).contains("spa-shell")
    }

    @Test
    fun `backend paths and missing files are not rewritten to the SPA`() {
        listOf("/api", "/api/does-not-exist", "/ws/unknown", "/actuator/nope", "/missing-bundle.js").forEach { path ->
            assertThat(get(path).statusCode()).describedAs(path).isEqualTo(404)
        }
    }

    @Test
    fun `responses carry security headers`() {
        val headers = get("/").headers()
        val csp = headers.firstValue("Content-Security-Policy").orElseThrow()
        assertThat(csp).contains("default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "frame-src https://challenges.cloudflare.com")
        // A fresh nonce per response, for the script Cloudflare's bot detection injects into the page.
        val nonce = Regex("script-src 'self' 'nonce-([A-Za-z0-9+/]{22}==)' https://challenges.cloudflare.com;").find(csp)!!.groupValues[1]
        assertThat(get("/").headers().firstValue("Content-Security-Policy").orElseThrow()).doesNotContain(nonce)
        assertThat(headers.firstValue("X-Content-Type-Options")).hasValue("nosniff")
        assertThat(headers.firstValue("X-Frame-Options")).hasValue("DENY")
        assertThat(headers.firstValue("Referrer-Policy")).hasValue("no-referrer")
    }

    @Test
    fun `websocket echoes text from an allowed origin`() {
        val listener = RecordingListener()
        val ws = connect(ALLOWED_ORIGIN, listener)
        ws.sendText("hello precinct", true).join()
        assertThat(listener.firstMessage.get(5, TimeUnit.SECONDS)).isEqualTo("hello precinct")
        ws.sendClose(WebSocket.NORMAL_CLOSURE, "done").join()
    }

    @Test
    fun `websocket handshake from a foreign origin is rejected`() {
        assertThatThrownBy { connect("https://evil.example", RecordingListener()) }
            .hasCauseInstanceOf(WebSocketHandshakeException::class.java)
    }

    @Test
    fun `oversized frames close the connection with 1009`() {
        val listener = RecordingListener()
        val ws = connect(ALLOWED_ORIGIN, listener)
        ws.sendText("x".repeat(5 * 1024), true)
        assertThat(listener.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1009)
    }

    @Test
    fun `binary frames close the connection with 1003`() {
        val listener = RecordingListener()
        val ws = connect(ALLOWED_ORIGIN, listener)
        ws.sendBinary(ByteBuffer.wrap(byteArrayOf(1, 2, 3)), true)
        assertThat(listener.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1003)
    }

    @Test
    fun `message floods close the connection with 1008`() {
        val listener = RecordingListener()
        val ws = connect(ALLOWED_ORIGIN, listener)
        repeat(40) { ws.sendText("spam $it", true).join() }
        assertThat(listener.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008)
    }

    @Test
    fun `main boots the application with production wiring`() {
        var context: ConfigurableApplicationContext? = null
        val captureContext = SpringApplicationHook {
            object : SpringApplicationRunListener {
                override fun ready(ctx: ConfigurableApplicationContext, timeTaken: Duration?) {
                    context = ctx
                }
            }
        }
        SpringApplication.withHook(captureContext, Runnable {
            main(
                arrayOf(
                    "--server.port=0",
                    "--spring.datasource.url=${postgres.jdbcUrl}",
                    "--spring.datasource.username=${postgres.username}",
                    "--spring.datasource.password=${postgres.password}",
                ),
            )
        })
        val booted = checkNotNull(context) { "application never became ready" }
        try {
            assertThat(booted.isActive).isTrue()
            assertThat(booted.getBean(PrecinctNoirApplication::class.java)).isNotNull()
        } finally {
            booted.close()
        }
    }

    private fun get(path: String): HttpResponse<String> =
        http.send(HttpRequest.newBuilder(URI("http://localhost:$port$path")).GET().build(), HttpResponse.BodyHandlers.ofString())

    private fun connect(origin: String, listener: WebSocket.Listener): WebSocket =
        http.newWebSocketBuilder()
            .header("Origin", origin)
            .buildAsync(URI("ws://localhost:$port/ws/echo"), listener)
            .join()

    private class RecordingListener : WebSocket.Listener {
        val firstMessage = CompletableFuture<String>()
        val closeCode = CompletableFuture<Int>()
        private val buffer = StringBuilder()

        override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
            buffer.append(data)
            if (last) firstMessage.complete(buffer.toString()).also { buffer.clear() }
            webSocket.request(1)
            return null
        }

        override fun onClose(webSocket: WebSocket, statusCode: Int, reason: String): CompletionStage<*>? {
            closeCode.complete(statusCode)
            return null
        }

        override fun onError(webSocket: WebSocket, error: Throwable) {
            closeCode.completeExceptionally(error)
        }
    }

    companion object {
        @Container
        @ServiceConnection
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18-alpine")
    }
}

private const val ALLOWED_ORIGIN = "http://allowed.test"
