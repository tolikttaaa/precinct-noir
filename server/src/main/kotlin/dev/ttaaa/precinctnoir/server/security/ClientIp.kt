package dev.ttaaa.precinctnoir.server.security

import jakarta.servlet.http.HttpServletRequest
import java.net.Inet6Address
import java.net.InetAddress
import java.security.SecureRandom
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Who a request comes from, for rate limits and socket caps.
 *
 * In production every request arrives through Cloudflare → cloudflared → Caddy, so the socket peer is
 * Caddy. Cloudflare sets `CF-Connecting-IP` (replacing any value a client sends), and nothing reaches
 * the container except through that tunnel, so the header can be trusted. Without it (local dev, tests)
 * the peer address is used. IPv6 clients are grouped by /64, the block one household gets, so a client
 * can't dodge limits by rotating addresses within it.
 */
object ClientIp {
    const val HEADER = "CF-Connecting-IP"
    const val UNKNOWN = "unknown"

    fun of(request: HttpServletRequest): String = key(request.getHeader(HEADER)) ?: key(request.remoteAddr) ?: UNKNOWN

    /** The limit key for an IP literal, or `null` if [raw] isn't one. Never does a DNS lookup. */
    fun key(raw: String?): String? {
        val address = try {
            InetAddress.ofLiteral(raw?.trim() ?: return null)
        } catch (e: IllegalArgumentException) {
            return null
        }
        if (address !is Inet6Address) return address.hostAddress
        val prefix = address.address
        return (0..<4).joinToString(":", postfix = "::/64") { HEX.formatHex(prefix, it * 2, it * 2 + 2) }
    }

    /**
     * A short pseudonym for logs: the same client gets the same value until the server restarts, but the
     * address itself can't be recovered from it (keyed with a secret that never leaves memory).
     */
    fun pseudonym(key: String): String {
        val mac = Mac.getInstance(HMAC)
        mac.init(SecretKeySpec(LOG_KEY, HMAC))
        return HEX.formatHex(mac.doFinal(key.toByteArray())).take(PSEUDONYM_LENGTH)
    }

    private const val HMAC = "HmacSHA256"
    private const val PSEUDONYM_LENGTH = 12
    private val HEX = HexFormat.of()
    private val LOG_KEY = ByteArray(32).also(SecureRandom()::nextBytes)
}
