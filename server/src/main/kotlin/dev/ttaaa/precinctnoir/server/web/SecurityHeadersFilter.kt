package dev.ttaaa.precinctnoir.server.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Baseline browser hardening headers on every response.
 *
 * The CSP allows only same-origin resources. Fonts are self-hosted and there are no inline
 * scripts or styles. `connect-src 'self'` also covers same-origin `wss:`. M3 adds Cloudflare
 * Turnstile's origin for the room-creation challenge.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class SecurityHeadersFilter : OncePerRequestFilter() {

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        SECURITY_HEADERS.forEach(response::setHeader)
        chain.doFilter(request, response)
    }
}

private val SECURITY_HEADERS = mapOf(
    "Content-Security-Policy" to listOf(
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ).joinToString("; "),
    "X-Content-Type-Options" to "nosniff",
    "X-Frame-Options" to "DENY",
    "Referrer-Policy" to "no-referrer",
    "Permissions-Policy" to "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy" to "same-origin",
    "Strict-Transport-Security" to "max-age=31536000",
)
