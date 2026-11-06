package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.config.TurnstileSettings
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.io.IOException
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

enum class Verdict { PASSED, FAILED, UNAVAILABLE }

/** Decides whether a request came from a person. */
fun interface HumanCheck {
    fun verify(token: String): Verdict
}

/**
 * Cloudflare Turnstile's server-side check (siteverify). Fail-closed: with no secret configured, or when
 * Cloudflare can't be reached or answers nonsense, the verdict is [Verdict.UNAVAILABLE] and the caller refuses.
 */
class Turnstile(
    private val settings: TurnstileSettings,
    private val http: HttpClient = HttpClient.newBuilder().connectTimeout(settings.timeout).build(),
) : HumanCheck {
    private val log = LoggerFactory.getLogger(Turnstile::class.java)

    init {
        if (settings.secretKey.isBlank()) log.warn("Turnstile secret key is not set: room creation is refused until it is")
    }

    override fun verify(token: String): Verdict {
        if (settings.secretKey.isBlank()) return Verdict.UNAVAILABLE
        if (token.isBlank() || token.length > MAX_TOKEN_LENGTH) return Verdict.FAILED
        val form = "secret=${encode(settings.secretKey)}&response=${encode(token)}"
        val request = HttpRequest.newBuilder(settings.verifyUrl)
            .timeout(settings.timeout)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build()
        val response = try {
            http.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: IOException) { // includes timeouts
            log.warn("Turnstile verification failed: {}", e.javaClass.simpleName)
            return Verdict.UNAVAILABLE
        }
        val result = try {
            SiteVerifyJson.decodeFromString(SiteVerify.serializer(), response.body()).takeIf { response.statusCode() == OK }
        } catch (e: IllegalArgumentException) {
            null
        }
        return when {
            result == null -> Verdict.UNAVAILABLE.also { log.warn("Turnstile answered HTTP {} with an unreadable body", response.statusCode()) }
            !result.success -> Verdict.FAILED.also { log.info("Turnstile rejected a token: {}", result.errorCodes) }
            settings.expectedHostname.isNotBlank() && result.hostname != settings.expectedHostname -> Verdict.FAILED
            else -> Verdict.PASSED
        }
    }

    @Serializable
    private class SiteVerify(
        val success: Boolean,
        val hostname: String? = null,
        @SerialName("error-codes") val errorCodes: List<String> = emptyList(),
    )

    private companion object {
        /** Turnstile tokens are at most 2048 characters. */
        const val MAX_TOKEN_LENGTH = 2048
        const val OK = 200
        val SiteVerifyJson = Json { ignoreUnknownKeys = true }

        fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8)
    }
}
