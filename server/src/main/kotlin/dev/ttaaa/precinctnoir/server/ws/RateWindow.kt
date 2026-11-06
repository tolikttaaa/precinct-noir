package dev.ttaaa.precinctnoir.server.ws

/**
 * Fixed one-second window counter: at most [limit] messages per window. One per socket, used only from
 * that socket's handler thread. (M3b replaces it with a token bucket.)
 */
class RateWindow(private val limit: Int) {
    private var windowStart = Long.MIN_VALUE
    private var count = 0

    fun tryAcquire(nowNanos: Long): Boolean {
        if (windowStart == Long.MIN_VALUE || nowNanos - windowStart >= ONE_SECOND_NANOS) {
            windowStart = nowNanos
            count = 0
        }
        return ++count <= limit
    }

    private companion object {
        const val ONE_SECOND_NANOS = 1_000_000_000L
    }
}
