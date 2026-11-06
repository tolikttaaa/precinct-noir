package dev.ttaaa.precinctnoir.engine.core.rng

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.ints.shouldBeInRange
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

class RngTest : FunSpec({

    test("matches the SplitMix64 reference sequence") {
        // Reference values computed independently (Python) for seeds 0 and 42.
        val zero = Rng.seeded(0)
        List(3) { zero.nextLong().toULong() } shouldBe
            listOf(0xE220A8397B1DCDAFuL, 0x6E789E6AA1B965F4uL, 0x06C45D188009454FuL)
        val fortyTwo = Rng.seeded(42)
        List(3) { fortyTwo.nextLong() } shouldBe
            listOf(-4767286540954276203L, 2949826092126892291L, 5139283748462763858L)
    }

    test("same seed gives the same sequence") {
        checkAll(Arb.long()) { seed ->
            val a = Rng.seeded(seed)
            val b = Rng.seeded(seed)
            List(16) { a.nextLong() } shouldBe List(16) { b.nextLong() }
        }
    }

    test("restoring a saved state continues the exact sequence") {
        checkAll(Arb.long(), Arb.int(0..50)) { seed, skip ->
            val original = Rng.seeded(seed)
            repeat(skip) { original.nextLong() }
            val restored = Rng.restore(original.state())
            List(8) { restored.nextLong() } shouldBe List(8) { original.nextLong() }
        }
    }

    test("nextInt stays within [0, bound)") {
        checkAll(Arb.long(), Arb.int(1..Int.MAX_VALUE)) { seed, bound ->
            Rng.seeded(seed).nextInt(bound) shouldBeInRange 0..<bound
        }
    }

    test("nextInt redraws instead of using the biased tail") {
        // Craft a state whose next raw output is all ones: r = Long.MAX_VALUE lies in the incomplete
        // top bucket for bound Int.MAX_VALUE, so the first draw must be rejected and a second one used.
        val state = RngState(unmix(-1L) - GAMMA)
        Rng.restore(state).nextLong() shouldBe -1L

        val reference = Rng.restore(state).apply { nextLong() }
        val expected = ((reference.nextLong() ushr 1) % Int.MAX_VALUE).toInt()

        val rng = Rng.restore(state)
        rng.nextInt(Int.MAX_VALUE) shouldBe expected
        rng.state() shouldBe reference.state()
    }

    test("nextInt rejects a non-positive bound") {
        shouldThrow<IllegalArgumentException> { Rng.seeded(1).nextInt(0) }
    }

    test("RngState round-trips through JSON and rejects incomplete input") {
        val state = Rng.seeded(7).apply { nextLong() }.state()
        Json.decodeFromString<RngState>(Json.encodeToString(state)) shouldBe state
        shouldThrow<SerializationException> { Json.decodeFromString<RngState>("{}") }
    }

    test("shuffled is a deterministic permutation and leaves the input untouched") {
        checkAll(Arb.long(), Arb.list(Arb.int(), 0..60)) { seed, items ->
            val snapshot = items.toList()
            val shuffled = Rng.seeded(seed).shuffled(items)
            shuffled shouldContainExactlyInAnyOrder items
            Rng.seeded(seed).shuffled(items) shouldBe shuffled
            items shouldBe snapshot
        }
    }
})

private val GAMMA = 0x9E3779B97F4A7C15uL.toLong()
private val MIX_1 = 0xBF58476D1CE4E5B9uL.toLong()
private val MIX_2 = 0x94D049BB133111EBuL.toLong()

/** Multiplicative inverse modulo 2^64 of an odd number (Newton's iteration doubles correct bits). */
private fun inverse(m: Long): Long {
    var x = m
    repeat(5) { x *= 2 - m * x }
    return x
}

/** Inverts `x xor (x ushr shift)`. */
private fun unXorShift(y: Long, shift: Int): Long {
    var x = y
    repeat(64 / shift + 1) { x = y xor (x ushr shift) }
    return x
}

/** Inverts SplitMix64's output mixer, so tests can choose the next raw output. */
private fun unmix(output: Long): Long {
    var z = unXorShift(output, 31)
    z *= inverse(MIX_2)
    z = unXorShift(z, 27)
    z *= inverse(MIX_1)
    return unXorShift(z, 30)
}
