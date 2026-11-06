package dev.ttaaa.precinctnoir.server.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

class AppPropertiesTest {

    @Test
    fun `only the production origin may open WebSockets by default`() {
        assertThat(AppProperties().allowedOrigins).containsExactly("https://precinctnoir.ttaaa.dev")
    }

    @Test
    fun `room and socket limits default to the documented values`() {
        assertThat(AppProperties().rooms).isEqualTo(
            RoomLimits(300, 9, Duration.ofMinutes(30), Duration.ofHours(2), Duration.ofMinutes(15), Duration.ofSeconds(5)),
        )
        assertThat(AppProperties().ws).isEqualTo(
            WsSettings(Duration.ofSeconds(5), Duration.ofSeconds(25), Duration.ofSeconds(60), Duration.ofSeconds(5), 512 * 1024, 10, 20),
        )
    }

    @Test
    fun `abuse limits default to the documented values, and Turnstile fails closed without keys`() {
        val tenMinutes = Duration.ofMinutes(10)
        val minute = Duration.ofMinutes(1)
        assertThat(AppProperties().limits).isEqualTo(
            AbuseLimits(Rate(5, tenMinutes), Rate(40, tenMinutes), Rate(10, minute), Rate(120, minute), 30, 3000),
        )
        with(AppProperties().turnstile) {
            assertThat(listOf(siteKey, secretKey, expectedHostname)).containsOnly("")
            assertThat(verifyUrl).hasToString("https://challenges.cloudflare.com/turnstile/v0/siteverify")
            assertThat(timeout).isEqualTo(Duration.ofSeconds(5))
        }
    }
}
