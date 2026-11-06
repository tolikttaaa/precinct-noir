package dev.ttaaa.precinctnoir.server.testing

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.util.concurrent.Executors

/** A local stand-in for Cloudflare's siteverify endpoint. The token decides the answer. */
object TurnstileStub {
    const val PASS = "pass"
    const val WRONG_HOST = "wrong-host"
    const val SLOW = "slow"
    const val BROKEN = "broken"
    const val GARBAGE = "garbage"
    const val HOSTNAME = "precinctnoir.ttaaa.dev"

    /** The form fields of the last request. */
    @Volatile
    var lastForm: Map<String, String> = emptyMap()
        private set

    private val server: HttpServer by lazy {
        HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0).apply {
            createContext("/siteverify", ::answer)
            executor = Executors.newVirtualThreadPerTaskExecutor()
            start()
        }
    }

    val url: URI get() = URI("http://127.0.0.1:${server.address.port}/siteverify")

    /** Runs [block] and checks that it sent nothing here. */
    fun verifyNothingSentFor(block: () -> Unit) {
        lastForm = emptyMap()
        block()
        check(lastForm.isEmpty()) { "expected no siteverify call, got $lastForm" }
    }

    private fun answer(exchange: HttpExchange) {
        val form = exchange.requestBody.readAllBytes().decodeToString().split('&').associate {
            it.substringBefore('=') to URLDecoder.decode(it.substringAfter('='), Charsets.UTF_8)
        }
        lastForm = form
        val (status, body) = when (form["response"]) {
            PASS -> 200 to """{"success":true,"hostname":"$HOSTNAME","challenge_ts":"2026-11-06T00:00:00Z","error-codes":[]}"""
            WRONG_HOST -> 200 to """{"success":true,"hostname":"evil.example"}"""
            SLOW -> {
                Thread.sleep(2_000)
                200 to """{"success":true,"hostname":"$HOSTNAME"}"""
            }
            BROKEN -> 500 to """{"success":false,"error-codes":["internal-error"]}"""
            GARBAGE -> 200 to "<html>not json</html>"
            else -> 200 to """{"success":false,"error-codes":["invalid-input-response"]}"""
        }
        val bytes = body.toByteArray()
        exchange.sendResponseHeaders(status, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }
}
