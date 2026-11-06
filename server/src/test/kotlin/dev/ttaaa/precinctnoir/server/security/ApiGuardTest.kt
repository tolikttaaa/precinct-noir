package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.config.AbuseLimits
import dev.ttaaa.precinctnoir.server.config.Rate
import dev.ttaaa.precinctnoir.server.testing.MutableClock
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.web.method.HandlerMethod
import java.time.Duration

class ApiGuardTest {
    private val clock = MutableClock()
    private val minute = Duration.ofMinutes(1)
    private val guard = ApiGuard(
        AbuseLimits(createRoom = Rate(1, minute), joinRoom = Rate(2, minute), failedLookups = Rate(2, minute), api = Rate(10, minute)),
        ClockTimeMeter(clock),
        setOf("https://ok.test"),
    )

    /** Stand-ins for the controller's endpoints. */
    class Endpoints {
        @Guarded(Guard.CREATE_ROOM)
        fun create() = Unit

        @Guarded(Guard.JOIN_ROOM)
        fun join() = Unit

        @Guarded(Guard.LOOKUP_ROOM)
        fun lookup() = Unit

        fun plain() = Unit
    }

    /** Runs one request through the guard; [status] is what the endpoint would answer. [endpoint] null = not a controller. */
    private fun call(endpoint: String?, client: String, method: String = "GET", origin: String? = null, status: Int = 200): MockHttpServletResponse {
        val request = MockHttpServletRequest(method, "/api/x").apply {
            addHeader(ClientIp.HEADER, client)
            origin?.let { addHeader("Origin", it) }
        }
        val response = MockHttpServletResponse()
        val handler: Any = endpoint?.let { HandlerMethod(Endpoints(), Endpoints::class.java.getMethod(it)) } ?: Any()
        if (guard.preHandle(request, response, handler)) {
            response.status = status
            guard.afterCompletion(request, response, handler, null)
        }
        return response
    }

    private fun MockHttpServletResponse.outcome() = status to (if (status >= 400) contentAsString else "")

    @Test
    fun `state-changing requests from a foreign origin are refused`() {
        assertThat(call("create", "192.0.2.1", "POST", origin = "https://evil.test").outcome())
            .isEqualTo(403 to """{"error":"forbidden_origin"}""")
        assertThat(call("plain", "192.0.2.1", "DELETE", origin = "https://evil.test").status).isEqualTo(403)
        assertThat(call("plain", "192.0.2.1", "POST", origin = "https://ok.test").status).isEqualTo(200)
        assertThat(call("plain", "192.0.2.1", "POST").status).isEqualTo(200) // not a browser
        assertThat(call("plain", "192.0.2.1", "GET", origin = "https://evil.test").status).isEqualTo(200)
    }

    @Test
    fun `room creation has its own limit per client`() {
        assertThat(call("create", "192.0.2.2", "POST").status).isEqualTo(200)
        val refused = call("create", "192.0.2.2", "POST")
        assertThat(refused.outcome()).isEqualTo(429 to """{"error":"rate_limited"}""")
        assertThat(refused.getHeader("Retry-After")).isEqualTo("60")
        assertThat(call("create", "192.0.2.2", "POST").status).isEqualTo(429) // logged once, refused again
        assertThat(call("create", "192.0.2.3", "POST").status).isEqualTo(200)
        clock.advance(minute)
        assertThat(call("create", "192.0.2.2", "POST").status).isEqualTo(200)
    }

    @Test
    fun `codes that don't exist use up failed lookups, then every lookup waits`() {
        val guesser = "192.0.2.4"
        call("create", guesser, "POST", status = 404) // not a lookup: doesn't count
        call("join", guesser, "POST", status = 409) // a room that exists: doesn't count
        call("lookup", guesser, status = 404)
        call("join", guesser, "POST", status = 404)
        val refused = call("lookup", guesser)
        assertThat(refused.status).isEqualTo(429)
        assertThat(refused.getHeader("Retry-After")).isEqualTo("30")
        assertThat(call("join", guesser, "POST").status).isEqualTo(429)
        assertThat(call("lookup", "192.0.2.5").status).isEqualTo(200)
        clock.advance(Duration.ofSeconds(30))
        assertThat(call("lookup", guesser).status).isEqualTo(200)
    }

    @Test
    fun `joining has its own limit per client`() {
        repeat(2) { assertThat(call("join", "192.0.2.6", "POST", status = 201).status).isEqualTo(201) }
        assertThat(call("join", "192.0.2.6", "POST").status).isEqualTo(429)
    }

    @Test
    fun `every API request counts toward the general limit`() {
        repeat(5) { call("plain", "192.0.2.7") }
        repeat(5) { call(null, "192.0.2.7") }
        assertThat(call(null, "192.0.2.7").status).isEqualTo(429)
        assertThat(call("plain", "192.0.2.7").getHeader("Retry-After")).isEqualTo("6")
    }
}
