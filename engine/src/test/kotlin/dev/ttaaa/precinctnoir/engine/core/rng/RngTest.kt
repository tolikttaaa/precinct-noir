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

    test("nextInt rejects a non-positive bound") {
        shouldThrow<IllegalArgumentException> { Rng.seeded(1).nextInt(0) }
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
