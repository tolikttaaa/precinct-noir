package dev.ttaaa.precinctnoir.server.ws

import dev.ttaaa.precinctnoir.server.config.AppProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean

@Configuration
@EnableWebSocket
class WebSocketConfig(private val props: AppProperties) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        // M1 diagnostic endpoint: proves WebSockets survive Cloudflare → tunnel → Caddy → app.
        // M3 replaces it with the authenticated game gateway.
        registry.addHandler(EchoWebSocketHandler(), "/ws/echo")
            .setAllowedOrigins(*props.allowedOrigins.toTypedArray())
    }

    /** Container-level limits: oversized frames are rejected (close 1009) before reaching handlers. */
    @Bean
    fun webSocketContainer() = ServletServerContainerFactoryBean().apply {
        setMaxTextMessageBufferSize(MAX_TEXT_MESSAGE_BYTES)
        setMaxBinaryMessageBufferSize(MAX_BINARY_MESSAGE_BYTES)
        setMaxSessionIdleTimeout(IDLE_TIMEOUT_MS)
    }

    companion object {
        const val MAX_TEXT_MESSAGE_BYTES = 4 * 1024
        const val MAX_BINARY_MESSAGE_BYTES = 1024
        const val IDLE_TIMEOUT_MS = 60_000L
    }
}
