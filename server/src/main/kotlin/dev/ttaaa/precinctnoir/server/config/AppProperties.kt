package dev.ttaaa.precinctnoir.server.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Application settings under the `app.` prefix.
 *
 * @property allowedOrigins browser origins allowed to open WebSockets. Blocks cross-site WebSocket hijacking.
 */
@ConfigurationProperties("app")
data class AppProperties(
    val allowedOrigins: List<String> = listOf("https://precinctnoir.ttaaa.dev"),
)
