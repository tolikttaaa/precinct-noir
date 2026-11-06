package dev.ttaaa.precinctnoir.engine.core.rules

import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId

/** Placing an evidence card on its suspect as *Exonerated* (Shadow Duel, The Hit List, Feds vs. Mob). */
object EvidencePlacement {
    /**
     * @property placed the card now lies on its living suspect; otherwise it belongs in the discard pile.
     * @property interrogate whether "who is next to it?" gets asked. A suspect removed by a collapse is never
     *   asked about. A dead one still on the board is asked about only with [interrogateDeadOnBoard] (`KI-2`).
     */
    data class Result(val board: Board, val placed: Boolean, val interrogate: Boolean)

    fun place(board: Board, card: SuspectId, interrogateDeadOnBoard: Boolean): Result {
        val tile = board.tile(card)
        val placed = tile?.alive == true
        return Result(
            board = if (placed) board.exonerate(card) else board,
            placed = placed,
            interrogate = placed || (tile != null && interrogateDeadOnBoard),
        )
    }
}

/** Drawing a replacement identity, skipping suspects that are no longer alive. */
object IdentityDraw {
    /** @property identity `null` if the deck ran out first. @property skipped cards passed over, in draw order. */
    data class Result(val identity: SuspectId?, val skipped: List<SuspectId>, val deck: Deck)

    fun drawLiving(deck: Deck, board: Board): Result {
        val index = deck.cards.indexOfFirst(board::isAlive)
        return if (index < 0) {
            Result(null, deck.cards, Deck())
        } else {
            Result(deck.cards[index], deck.cards.take(index), Deck(deck.cards.drop(index + 1)))
        }
    }
}

/** Questions the server answers truthfully for hidden players. */
object Queries {
    /** Is the suspect [identity] in `N(suspect)`? A suspect is never its own neighbour. */
    fun isNextTo(board: Board, identity: SuspectId, suspect: SuspectId): Boolean = identity in board.neighbors(suspect)

    /** Seats whose identity is in `N(suspect)`, in seat order ("raise your hand"). */
    fun seatsNextTo(board: Board, identities: List<Pair<Seat, SuspectId?>>, suspect: SuspectId): List<Seat> {
        val around = board.neighbors(suspect).toSet()
        return identities.filter { (_, id) -> id != null && id in around }.map { it.first }.sortedBy(Seat::index)
    }
}
