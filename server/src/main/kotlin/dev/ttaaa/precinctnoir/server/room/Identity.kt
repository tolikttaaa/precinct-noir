package dev.ttaaa.precinctnoir.server.room

import java.security.MessageDigest
import java.security.SecureRandom
import java.text.Normalizer
import java.util.Base64
import java.util.Locale

/** Source of unpredictable values: room codes, tokens and game seeds. Swappable for tests. */
interface Randomness {
    fun nextInt(bound: Int): Int

    fun nextLong(): Long

    fun nextBytes(count: Int): ByteArray
}

class SecureRandomness : Randomness {
    private val random = SecureRandom()

    override fun nextInt(bound: Int): Int = random.nextInt(bound)

    override fun nextLong(): Long = random.nextLong()

    override fun nextBytes(count: Int): ByteArray = ByteArray(count).also(random::nextBytes)
}

/**
 * Four-letter room codes from consonants only: without vowels they can't spell words, and there's
 * no I/O to confuse with 1/0. A short blocklist catches the consonant-only abbreviations that remain.
 */
object RoomCodes {
    const val ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"
    const val LENGTH = 4
    private val BLOCKED = listOf("FCK", "FKN", "KKK", "NGR", "NGG", "CNT", "DCK", "SHT", "TWT", "WTF", "STFU", "BLD", "PZD")

    fun generate(random: Randomness): String {
        while (true) {
            val code = String(CharArray(LENGTH) { ALPHABET[random.nextInt(ALPHABET.length)] })
            if (!isBlocked(code)) return code
        }
    }

    fun isBlocked(code: String): Boolean = BLOCKED.any { it in code }

    /** Uppercases user input; `null` if it can't be a room code. */
    fun normalize(input: String): String? =
        input.trim().uppercase(Locale.ROOT).takeIf { it.length == LENGTH && it.all { c -> c in ALPHABET } }
}

/** 128-bit bearer tokens for the TV and each player. Only their SHA-256 is ever stored. */
object Tokens {
    private const val BYTES = 16

    fun create(random: Randomness): String = Base64.getUrlEncoder().withoutPadding().encodeToString(random.nextBytes(BYTES))

    fun hash(token: String): String =
        MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }

    /** Constant-time comparison against a stored hash. */
    fun matches(token: String, hash: String): Boolean = MessageDigest.isEqual(hash(token).toByteArray(), hash.toByteArray())
}

/** Display names: NFC, no control or invisible formatting characters (bidi overrides included), 1–16 characters. */
object Names {
    const val MAX_LENGTH = 16
    private val INVISIBLE = setOf(
        Character.CONTROL, Character.FORMAT, Character.UNASSIGNED, Character.PRIVATE_USE, Character.SURROGATE,
        Character.LINE_SEPARATOR, Character.PARAGRAPH_SEPARATOR,
    ).map(Byte::toInt).toSet()
    private val SPACES = Regex("\\s+")

    fun normalize(raw: String): String? {
        val visible = buildString {
            Normalizer.normalize(raw, Normalizer.Form.NFC).codePoints()
                .filter { Character.getType(it) !in INVISIBLE }
                .forEach(::appendCodePoint)
        }
        val name = visible.replace(SPACES, " ").trim()
        return name.takeIf { it.codePointCount(0, it.length) in 1..MAX_LENGTH }
    }

    fun same(a: String, b: String): Boolean = a.lowercase(Locale.ROOT) == b.lowercase(Locale.ROOT)
}
