package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.config.TurnstileSettings
import dev.ttaaa.precinctnoir.server.testing.TurnstileStub
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.net.URI
import java.time.Duration

class TurnstileTest {

    private fun turnstile(secret: String = "s3cr&t=1", hostname: String = TurnstileStub.HOSTNAME, url: URI = TurnstileStub.url) =
        Turnstile(TurnstileSettings(secretKey = secret, verifyUrl = url, expectedHostname = hostname, timeout = Duration.ofMillis(500)))

    @Test
    fun `a token Cloudflare accepts for our hostname passes`() {
        assertThat(turnstile().verify(TurnstileStub.PASS)).isEqualTo(Verdict.PASSED)
        assertThat(TurnstileStub.lastForm).isEqualTo(mapOf("secret" to "s3cr&t=1", "response" to TurnstileStub.PASS))
    }

    @Test
    fun `rejected tokens and tokens from another hostname fail`() {
        assertThat(turnstile().verify("forged")).isEqualTo(Verdict.FAILED)
        assertThat(turnstile().verify(TurnstileStub.WRONG_HOST)).isEqualTo(Verdict.FAILED)
        assertThat(turnstile(hostname = "").verify(TurnstileStub.WRONG_HOST)).isEqualTo(Verdict.PASSED) // dev: check off
    }

    @Test
    fun `empty or oversized tokens fail without asking Cloudflare`() {
        TurnstileStub.verifyNothingSentFor {
            assertThat(turnstile().verify(" ")).isEqualTo(Verdict.FAILED)
            assertThat(turnstile().verify("x".repeat(2049))).isEqualTo(Verdict.FAILED)
        }
    }

    @Test
    fun `no secret, no answer or a bad answer means unavailable, so the caller refuses`() {
        assertThat(turnstile(secret = "").verify(TurnstileStub.PASS)).isEqualTo(Verdict.UNAVAILABLE)
        assertThat(turnstile().verify(TurnstileStub.BROKEN)).isEqualTo(Verdict.UNAVAILABLE)
        assertThat(turnstile().verify(TurnstileStub.GARBAGE)).isEqualTo(Verdict.UNAVAILABLE)
        assertThat(turnstile().verify(TurnstileStub.SLOW)).isEqualTo(Verdict.UNAVAILABLE)
        assertThat(turnstile(url = URI("http://127.0.0.1:1/siteverify")).verify(TurnstileStub.PASS)).isEqualTo(Verdict.UNAVAILABLE)
    }
}
