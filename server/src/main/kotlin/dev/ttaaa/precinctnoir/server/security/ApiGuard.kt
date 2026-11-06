package dev.ttaaa.precinctnoir.server.security

import com.github.benmanes.caffeine.cache.Caffeine
import dev.ttaaa.precinctnoir.server.config.AbuseLimits
import dev.ttaaa.precinctnoir.server.protocol.ApiError
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import io.github.bucket4j.TimeMeter
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.HandlerInterceptor
import java.time.Duration

/** Which extra limit an API endpoint is under (see [ApiGuard]). */
enum class Guard { CREATE_ROOM, JOIN_ROOM, LOOKUP_ROOM }

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class Guarded(val value: Guard)

/**
 * Guards `/api/` before any controller runs. It is a Spring MVC interceptor rather than a servlet filter so
 * it judges the endpoint Spring actually matched, whatever the raw URL looks like.
 *
 * - State-changing requests from a foreign `Origin` are refused (403 `forbidden_origin`); requests without
 *   an `Origin` (not from a browser) pass.
 * - Every request spends from the client's general API bucket, and [Guarded] endpoints from their own.
 * - Looking up a room that doesn't exist spends a "failed lookup"; with none left, every lookup waits, so
 *   room codes can't be guessed by brute force.
 *
 * A refusal is 429 `rate_limited` with `Retry-After` in seconds.
 */
class ApiGuard(limits: AbuseLimits, time: TimeMeter, private val allowedOrigins: Set<String>) : HandlerInterceptor {
    private val log = LoggerFactory.getLogger(ApiGuard::class.java)
    private val api = RateLimiter(limits.api, time)
    private val createRoom = RateLimiter(limits.createRoom, time)
    private val joinRoom = RateLimiter(limits.joinRoom, time)
    private val failedLookups = RateLimiter(limits.failedLookups, time)

    /** Remembers whom we logged recently, so a flood doesn't flood the log too. */
    private val recentlyLogged = Caffeine.newBuilder().maximumSize(LOGGED_KEYS).expireAfterWrite(LOG_EVERY).build<String, Boolean>()

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (request.method !in SAFE_METHODS) {
            val origin = request.getHeader(HttpHeaders.ORIGIN)
            if (origin != null && origin !in allowedOrigins) return refuse(response, FORBIDDEN, "forbidden_origin")
        }
        val client = ClientIp.of(request)
        val wait = api.acquire(client) ?: when (guardOf(handler)) {
            Guard.CREATE_ROOM -> createRoom.acquire(client)
            Guard.JOIN_ROOM -> failedLookups.peek(client) ?: joinRoom.acquire(client)
            Guard.LOOKUP_ROOM -> failedLookups.peek(client)
            null -> null
        } ?: return true
        if (recentlyLogged.asMap().putIfAbsent(client, true) == null) {
            log.info("Rate limited client {} on {} {}", ClientIp.pseudonym(client), request.method, guardOf(handler) ?: "api")
        }
        response.setHeader(HttpHeaders.RETRY_AFTER, wait.toSecondsRoundedUp().toString())
        return refuse(response, TOO_MANY_REQUESTS, "rate_limited")
    }

    override fun afterCompletion(request: HttpServletRequest, response: HttpServletResponse, handler: Any, ex: Exception?) {
        val guard = guardOf(handler)
        if ((guard == Guard.JOIN_ROOM || guard == Guard.LOOKUP_ROOM) && response.status == NOT_FOUND) {
            failedLookups.acquire(ClientIp.of(request))
        }
    }

    private fun guardOf(handler: Any): Guard? = (handler as? HandlerMethod)?.getMethodAnnotation(Guarded::class.java)?.value

    private fun refuse(response: HttpServletResponse, status: Int, code: String): Boolean {
        response.status = status
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.writer.write(ProtocolJson.encodeToString(ApiError.serializer(), ApiError(code)))
        return false
    }

    private fun Duration.toSecondsRoundedUp(): Long = maxOf(1, toMillis().let { (it + MILLIS - 1) / MILLIS })

    private companion object {
        val SAFE_METHODS = setOf("GET", "HEAD", "OPTIONS")
        const val FORBIDDEN = 403
        const val NOT_FOUND = 404
        const val TOO_MANY_REQUESTS = 429
        const val MILLIS = 1000L
        const val LOGGED_KEYS = 10_000L
        val LOG_EVERY: Duration = Duration.ofMinutes(1)
    }
}
