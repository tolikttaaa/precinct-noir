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
            WsSettings(Duration.ofSeconds(5), Duration.ofSeconds(25), Duration.ofSeconds(60), Duration.ofSeconds(5), 512 * 1024, 20),
        )
    }
}
