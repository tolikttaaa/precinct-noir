package dev.ttaaa.precinctnoir.server.ws

import dev.ttaaa.precinctnoir.server.config.AppProperties
import dev.ttaaa.precinctnoir.server.security.SocketGuard
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean

@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val props: AppProperties,
    private val game: GameWebSocketHandler,
    private val guard: SocketGuard,
) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        val origins = props.allowedOrigins.toTypedArray()
        // The guard caps open sockets per client and overall (docs/SECURITY.md).
        registry.addHandler(guard.guard(game), "/ws").addInterceptors(guard).setAllowedOrigins(*origins)
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

        /** Longer than the ping interval, so live sockets never look idle to the container. */
        const val IDLE_TIMEOUT_MS = 90_000L
    }
}
