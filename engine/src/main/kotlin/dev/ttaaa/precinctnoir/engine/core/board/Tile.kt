package dev.ttaaa.precinctnoir.engine.core.board

import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Tokens a suspect can carry; at most one of each kind. */
@Serializable
enum class TokenKind {
    @SerialName("treasure")
    TREASURE,

    @SerialName("protection")
    PROTECTION,

    @SerialName("threat")
    THREAT,

    @SerialName("bomb")
    BOMB,
}

/** A uniformed officer marker (Cat Burglar, Casino Heist). */
@Serializable
data class Officer(val stunned: Boolean = false)

/**
 * One suspect in the city with everything that travels with it when the city moves.
 *
 * Every field is public information.
 *
 * @property exonerated the suspect's own evidence card lies face-up on it. It stays on the body after a kill.
 * @property arrested Feds vs. Mob: the suspect stays alive and can't be killed or collapsed.
 * @property tokens kept sorted and distinct, so equal tiles serialize identically.
 */
@Serializable
data class Tile(
    val id: SuspectId,
    val alive: Boolean = true,
    val exonerated: Boolean = false,
    val arrested: Boolean = false,
    val officer: Officer? = null,
    val tokens: List<TokenKind> = emptyList(),
) {
    init {
        require(tokens == tokens.distinct().sorted()) { "tokens must be sorted and distinct: $tokens" }
        require(alive || (tokens.isEmpty() && officer == null && !arrested)) {
            "a dead suspect carries no tokens, officer or arrest: $this"
        }
    }

    fun has(kind: TokenKind): Boolean = kind in tokens

    fun withToken(kind: TokenKind): Tile {
        require(alive) { "tokens go on living suspects only: $id" }
        require(kind !in tokens) { "$id already holds $kind" }
        return copy(tokens = (tokens + kind).sorted())
    }

    fun withoutToken(kind: TokenKind): Tile {
        require(kind in tokens) { "$id holds no $kind" }
        return copy(tokens = tokens - kind)
    }

    /** Dies: tokens and the officer marker go, an exoneration stays on the body. */
    fun killed(): Tile {
        require(alive) { "$id is already dead" }
        require(!arrested) { "arrested suspects can't be killed: $id" }
        return copy(alive = false, tokens = emptyList(), officer = null)
    }
}
