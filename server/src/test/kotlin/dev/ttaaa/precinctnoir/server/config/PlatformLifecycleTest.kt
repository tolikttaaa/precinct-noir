package dev.ttaaa.precinctnoir.server.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class PlatformLifecycleTest {

    @Test
    fun `runs every job on its period, survives a failing one, and stops cleanly`() {
        val scheduler = Executors.newSingleThreadScheduledExecutor()
        val failures = AtomicInteger()
        val ticks = CountDownLatch(3)
        var stopped = false
        val lifecycle = PlatformLifecycle(
            scheduler,
            listOf(
                Periodic("flaky", Duration.ofMillis(5)) { failures.incrementAndGet(); throw IllegalStateException("boom") },
                Periodic("steady", Duration.ofMillis(5)) { ticks.countDown() },
            ),
            onStop = { stopped = true },
        )
        try {
            assertThat(lifecycle.isRunning).isFalse()
            lifecycle.start()
            assertThat(lifecycle.isRunning).isTrue()
            assertThat(ticks.await(5, TimeUnit.SECONDS)).isTrue()
            assertThat(failures.get()).isGreaterThanOrEqualTo(2) // still scheduled after throwing
            lifecycle.stop()
            assertThat(lifecycle.isRunning).isFalse()
            assertThat(stopped).isTrue()
        } finally {
            scheduler.shutdownNow()
        }
    }
}
