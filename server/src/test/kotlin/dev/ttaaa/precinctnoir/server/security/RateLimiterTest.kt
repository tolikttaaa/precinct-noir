package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.config.Rate
import dev.ttaaa.precinctnoir.server.testing.MutableClock
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

class RateLimiterTest {
    private val clock = MutableClock()
    private val time = ClockTimeMeter(clock)

    @Test
    fun `each client has its own bucket, refilled smoothly over the period`() {
        val limiter = RateLimiter(Rate(2, Duration.ofMinutes(1)), time)
        assertThat(limiter.acquire("a")).isNull()
        assertThat(limiter.peek("a")).isNull()
        assertThat(limiter.acquire("a")).isNull()
        assertThat(limiter.peek("a")).isEqualTo(Duration.ofSeconds(30)) // one token per 30 s
        assertThat(limiter.acquire("a")).isEqualTo(Duration.ofSeconds(30))
        assertThat(limiter.acquire("b")).isNull()

        clock.advance(Duration.ofSeconds(20))
        assertThat(limiter.acquire("a")).isEqualTo(Duration.ofSeconds(10))
        clock.advance(Duration.ofSeconds(10))
        assertThat(limiter.acquire("a")).isNull()
        assertThat(limiter.acquire("a")).isNotNull()
    }

    @Test
    fun `message buckets allow a burst, then a steady rate`() {
        val bucket = tokenBucket(3, 1, Duration.ofSeconds(1), time)
        assertThat((1..4).map { bucket.tryConsume(1) }).containsExactly(true, true, true, false)
        clock.advance(Duration.ofSeconds(1))
        assertThat((1..2).map { bucket.tryConsume(1) }).containsExactly(true, false)
        assertThat(time.isWallClockBased).isTrue()
    }
}
