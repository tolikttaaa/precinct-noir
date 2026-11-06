package dev.ttaaa.precinctnoir.server.web

import org.springframework.context.annotation.Configuration
import org.springframework.core.io.Resource
import org.springframework.http.CacheControl
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import org.springframework.web.servlet.resource.PathResourceResolver
import java.time.Duration

/**
 * Serves the React single-page app from `classpath:/static`.
 *
 * Content-hashed build assets under `/assets` are cached for a year. Everything else, `index.html`
 * above all, is `no-store`: every page load gets a fresh CSP nonce (see [SecurityHeadersFilter]), and a
 * cached page would carry an old one. Unknown client-side routes (e.g. `/play/ABCD`) fall back to `index.html`.
 * Backend paths and missing files are never rewritten, so they still 404.
 */
@Configuration
class SpaWebConfig : WebMvcConfigurer {

    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        registry.addResourceHandler("/assets/**")
            .addResourceLocations("$STATIC/assets/")
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())

        registry.addResourceHandler("/**")
            .addResourceLocations("$STATIC/")
            .setCacheControl(CacheControl.noStore())
            .resourceChain(true)
            .addResolver(SpaFallbackResolver())
    }

    /** Resolves real files first, then falls back to `index.html` for client-side routes. */
    internal class SpaFallbackResolver : PathResourceResolver() {
        public override fun getResource(resourcePath: String, location: Resource): Resource? {
            val requested = location.createRelative(resourcePath)
            if (requested.exists() && requested.isReadable) return requested
            if (isBackendPath(resourcePath) || looksLikeFile(resourcePath)) return null
            return location.createRelative("index.html").takeIf { it.exists() && it.isReadable }
        }

        private fun isBackendPath(path: String) =
            BACKEND_PREFIXES.any { path == it || path.startsWith("$it/") }

        private fun looksLikeFile(path: String) = path.substringAfterLast('/').contains('.')
    }

    private companion object {
        const val STATIC = "classpath:/static"
        val BACKEND_PREFIXES = listOf("api", "ws", "actuator")
    }
}
