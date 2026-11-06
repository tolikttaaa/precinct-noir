package dev.ttaaa.precinctnoir.server.room

import dev.ttaaa.precinctnoir.server.testing.SeededRandomness
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class IdentityTest {

    @Test
    fun `room codes use four consonants and skip blocked letter runs`() {
        val random = SeededRandomness(1)
        val codes = List(2_000) { RoomCodes.generate(random) }
        assertThat(codes).allMatch { it.matches(Regex("[${RoomCodes.ALPHABET}]{4}")) && !RoomCodes.isBlocked(it) }
        assertThat(codes.toSet().size).isGreaterThan(1_900)
        assertThat(RoomCodes.isBlocked("XKKK")).isTrue()
        assertThat(RoomCodes.isBlocked("BCDF")).isFalse()
        // A source that first produces K,K,K,K then B,C,D,F: the blocked code is skipped.
        val rigged = object : Randomness by random {
            private val picks = ArrayDeque("KKKKBCDF".map(RoomCodes.ALPHABET::indexOf))

            override fun nextInt(bound: Int): Int = picks.removeFirst()
        }
        assertThat(RoomCodes.generate(rigged)).isEqualTo("BCDF")
    }

    @Test
    fun `codes typed by people are normalized, junk is not a code`() {
        assertThat(RoomCodes.normalize(" bcdf ")).isEqualTo("BCDF")
        assertThat(listOf("BCD", "BCDFG", "BC1F", "ABCD", "")).allMatch { RoomCodes.normalize(it) == null }
    }

    @Test
    fun `tokens are 128-bit base64url and only their hash is compared`() {
        val random = SeededRandomness(2)
        val token = Tokens.create(random)
        assertThat(token).matches("[A-Za-z0-9_-]{22}")
        assertThat(Tokens.create(random)).isNotEqualTo(token)
        val hash = Tokens.hash(token)
        assertThat(hash).matches("[0-9a-f]{64}")
        assertThat(Tokens.matches(token, hash)).isTrue()
        assertThat(Tokens.matches(token + "x", hash)).isFalse()
        assertThat(SecureRandomness().let { listOf(it.nextBytes(16).size, it.nextInt(5) in 0..4) }).containsExactly(16, true)
        assertThat(SecureRandomness().nextLong()).isNotNull()
    }

    @Test
    fun `names are NFC, visible, single-spaced and 1 to 16 characters`() {
        assertThat(Names.normalize("  Ann   Lee ")).isEqualTo("Ann Lee")
        assertThat(Names.normalize("Zoé")).isEqualTo("Zoé") // composed
        assertThat(Names.normalize("Ev‮il​\u0000")).isEqualTo("Evil") // bidi override, zero-width, control
        assertThat(Names.normalize("Ада")).isEqualTo("Ада")
        assertThat(Names.normalize("🕵".repeat(16))).isNotNull() // 16 emoji = 16 characters
        assertThat(Names.normalize("x".repeat(17))).isNull()
        assertThat(Names.normalize(" ‮ ")).isNull()
        assertThat(Names.same("ANN", "ann")).isTrue()
        assertThat(Names.same("Ann", "Anne")).isFalse()
    }
}
