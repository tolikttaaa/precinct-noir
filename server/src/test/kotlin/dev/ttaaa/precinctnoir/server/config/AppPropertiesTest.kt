package dev.ttaaa.precinctnoir.server.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class AppPropertiesTest {

    @Test
    fun `only the production origin may open WebSockets by default`() {
        assertThat(AppProperties().allowedOrigins).containsExactly("https://precinctnoir.ttaaa.dev")
    }
}
