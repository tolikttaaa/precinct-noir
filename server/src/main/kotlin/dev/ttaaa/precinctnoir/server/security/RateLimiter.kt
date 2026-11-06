package dev.ttaaa.precinctnoir.server.security

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import dev.ttaaa.precinctnoir.server.config.Rate
import io.github.bucket4j.Bucket
import io.github.bucket4j.TimeMeter
import java.time.Clock
import java.time.Duration

/**
 * One token bucket per key (a client), [Rate.requests] per [Rate.per]. Buckets live in a bounded cache
 * and are forgotten after a full idle period, when they would be full again anyway.
 */
class RateLimiter(private val rate: Rate, private val time: TimeMeter, maxKeys: Long = MAX_KEYS) {
    private val buckets: Cache<String, Bucket> = Caffeine.newBuilder().maximumSize(maxKeys).expireAfterAccess(rate.per).build()

    /** Takes a token. Returns `null` if allowed, otherwise how long until the next token. */
    fun acquire(key: String): Duration? {
        val probe = bucket(key).tryConsumeAndReturnRemaining(1)
        return if (probe.isConsumed) null else Duration.ofNanos(probe.nanosToWaitForRefill)
    }

    /** Like [acquire], but only looks. */
    fun peek(key: String): Duration? {
        val probe = bucket(key).estimateAbilityToConsume(1)
        return if (probe.canBeConsumed()) null else Duration.ofNanos(probe.nanosToWaitForRefill)
    }

    private fun bucket(key: String): Bucket = buckets.get(key) { tokenBucket(rate.requests, rate.requests, rate.per, time) }

    private companion object {
        const val MAX_KEYS = 100_000L
    }
}

/** A bucket holding up to [capacity] tokens that regains [refill] tokens every [period], smoothly. */
fun tokenBucket(capacity: Long, refill: Long, period: Duration, time: TimeMeter): Bucket =
    Bucket.builder()
        .addLimit { it.capacity(capacity).refillGreedy(refill, period) }
        .withCustomTimePrecision(time)
        .build()

/** Bucket4j time from a [Clock], so tests can move time by hand. */
class ClockTimeMeter(private val clock: Clock) : TimeMeter {
    override fun currentTimeNanos(): Long = clock.millis() * NANOS_PER_MILLI

    override fun isWallClockBased(): Boolean = true

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000L
    }
}
