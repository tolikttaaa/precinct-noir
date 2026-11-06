package dev.ttaaa.precinctnoir.server.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.SecureRandom
import java.util.Base64

/**
 * Baseline browser hardening headers on every response.
 *
 * The CSP allows only same-origin resources, plus Cloudflare Turnstile (`challenges.cloudflare.com`) for
 * the room-creation check. Fonts are self-hosted and our pages have no inline scripts or styles.
 * `connect-src 'self'` also covers same-origin `wss:`.
 *
 * Each response gets a fresh script nonce. Our pages don't use it; it is there for Cloudflare's bot
 * detection, which injects an inline script into HTML and copies the nonce it finds in this header onto
 * it. Without the nonce the browser blocks that script. HTML is served `no-store` (see [SpaWebConfig]),
 * so a cached page can never meet a different nonce.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class SecurityHeadersFilter : OncePerRequestFilter() {
    private val random = SecureRandom()

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes).let(Base64.getEncoder()::encodeToString)
        request.setAttribute(NONCE_ATTRIBUTE, nonce)
        response.setHeader("Content-Security-Policy", contentSecurityPolicy(nonce))
        STATIC_HEADERS.forEach(response::setHeader)
        chain.doFilter(request, response)
    }

    companion object {
        /** Request attribute holding this response's CSP nonce. */
        const val NONCE_ATTRIBUTE = "precinctnoir.cspNonce"
        private const val NONCE_BYTES = 16
        private const val TURNSTILE = "https://challenges.cloudflare.com"

        fun contentSecurityPolicy(nonce: String): String = listOf(
            "default-src 'self'",
            "script-src 'self' 'nonce-$nonce' $TURNSTILE",
            "style-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-src $TURNSTILE",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ).joinToString("; ")
    }
}

private val STATIC_HEADERS = mapOf(
    "X-Content-Type-Options" to "nosniff",
    "X-Frame-Options" to "DENY",
    "Referrer-Policy" to "no-referrer",
    "Permissions-Policy" to "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy" to "same-origin",
    "Strict-Transport-Security" to "max-age=31536000",
)
