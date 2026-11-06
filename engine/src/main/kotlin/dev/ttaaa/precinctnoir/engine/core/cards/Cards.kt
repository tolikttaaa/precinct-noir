package dev.ttaaa.precinctnoir.engine.core.cards

import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import kotlinx.serialization.Serializable

/** The face-down evidence deck. The top card is `cards.first()`. Only the server knows the order. */
@Serializable
data class Deck(val cards: List<SuspectId> = emptyList()) {
    init {
        require(cards.size == cards.toSet().size) { "a card appears twice in the deck: $cards" }
    }

    val size: Int get() = cards.size

    fun isEmpty(): Boolean = cards.isEmpty()

    fun draw(): Pair<SuspectId, Deck> {
        require(cards.isNotEmpty()) { "cannot draw from an empty deck" }
        return cards.first() to Deck(cards.drop(1))
    }

    fun drawN(n: Int): Pair<List<SuspectId>, Deck> {
        require(n in 0..cards.size) { "cannot draw $n from ${cards.size} cards" }
        return cards.take(n) to Deck(cards.drop(n))
    }

    fun putBottom(card: SuspectId): Deck = Deck(cards + card)

    /** Adds [extra] and shuffles the whole deck. */
    fun shuffleIn(extra: List<SuspectId>, rng: Rng): Deck = Deck(rng.shuffled(cards + extra))
}

/** What a player holds face-down. */
@Serializable
data class PlayerSecret(val identity: SuspectId? = null, val hand: List<SuspectId> = emptyList())

/** Replaces the secret at [seat]. */
fun List<PlayerSecret>.replace(seat: Seat, secret: PlayerSecret): List<PlayerSecret> =
    toMutableList().also { it[seat.index] = secret }
