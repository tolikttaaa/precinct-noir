package dev.ttaaa.precinctnoir.engine.core.rng

import kotlinx.serialization.Serializable

/** Persisted RNG position. Part of room snapshots; must never be sent to clients. */
@Serializable
data class RngState(val s: Long)

/**
 * Deterministic SplitMix64 generator. The engine uses only this RNG, never `kotlin.random`
 * or the clock, so a game replays exactly from its seed and command log.
 */
class Rng private constructor(private var s: Long) {

    fun nextLong(): Long {
        s += GOLDEN_GAMMA
        var z = s
        z = (z xor (z ushr 30)) * MIX_1
        z = (z xor (z ushr 27)) * MIX_2
        return z xor (z ushr 31)
    }

    /** Uniform integer in `[0, bound)`, without modulo bias. */
    fun nextInt(bound: Int): Int {
        require(bound > 0) { "bound must be positive, was $bound" }
        val b = bound.toLong()
        while (true) {
            val r = nextLong() ushr 1
            val v = r % b
            if (r - v + (b - 1) >= 0) return v.toInt()
        }
    }

    /** Fisher–Yates shuffle into a new list; the input is not modified. */
    fun <T> shuffled(items: List<T>): List<T> {
        val out = items.toMutableList()
        for (i in out.lastIndex downTo 1) {
            val j = nextInt(i + 1)
            out[i] = out[j].also { out[j] = out[i] }
        }
        return out
    }

    fun state(): RngState = RngState(s)

    companion object {
        private val GOLDEN_GAMMA = 0x9E3779B97F4A7C15uL.toLong()
        private val MIX_1 = 0xBF58476D1CE4E5B9uL.toLong()
        private val MIX_2 = 0x94D049BB133111EBuL.toLong()

        fun seeded(seed: Long): Rng = Rng(seed)

        fun restore(state: RngState): Rng = Rng(state.s)
    }
}
