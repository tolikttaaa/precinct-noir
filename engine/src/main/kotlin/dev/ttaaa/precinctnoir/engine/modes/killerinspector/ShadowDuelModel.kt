package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.board.ShiftRecord
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.view.BoardView
import dev.ttaaa.precinctnoir.engine.core.view.PendingView
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * @property interrogateDeadOnBoard lobby switch for `KI-2` (on by default).
 * @property killerSeat set by the server, not the lobby: `null` picks the Killer at random, and a rematch
 *   passes the previous Inspector's seat so roles swap.
 */
@Serializable
data class ShadowDuelConfig(
    val interrogateDeadOnBoard: Boolean = true,
    val killerSeat: Int? = null,
)

@Serializable
enum class Role {
    @SerialName("killer")
    KILLER,

    @SerialName("inspector")
    INSPECTOR,
}

/**
 * Everything about a Shadow Duel game except the generic flow envelope.
 *
 * @property secrets indexed by seat: the Killer holds an identity only, the Inspector an identity
 *   (after their first turn) and a hand of 3.
 * @property outOfPlay exoneration cards whose suspect was removed by a collapse (`KI-8`).
 * @property turn counts every player's turns, starting at 1 with the Killer's opening kill.
 */
@Serializable
data class ShadowDuelModel(
    val config: ShadowDuelConfig,
    val killer: Seat,
    val board: Board,
    val deck: Deck,
    val discard: List<SuspectId> = emptyList(),
    val outOfPlay: List<SuspectId> = emptyList(),
    val secrets: List<PlayerSecret>,
    val kills: Int = 0,
    val turn: Int = 1,
    val lastShift: ShiftRecord? = null,
) {
    init {
        require(secrets.size == 2 && killer.index in 0..1) { "Shadow Duel has exactly two seats" }
    }

    val inspector: Seat get() = Seat(1 - killer.index)

    val seats: List<Seat> get() = listOf(Seat(0), Seat(1))

    val killerIdentity: SuspectId get() = checkNotNull(secret(killer).identity) { "the Killer always has an identity" }

    val inspectorIdentity: SuspectId? get() = secret(inspector).identity

    fun roleOf(seat: Seat): Role = if (seat == killer) Role.KILLER else Role.INSPECTOR

    fun secret(seat: Seat): PlayerSecret = secrets[seat.index]
}

@Serializable
sealed interface ShadowDuelStep {
    /** Announces the game and tells the Killer who they are. */
    @Serializable
    @SerialName("start")
    data object Start : ShadowDuelStep

    @Serializable
    @SerialName("begin_turn")
    data class BeginTurn(val seat: Seat) : ShadowDuelStep

    @Serializable
    @SerialName("end_turn")
    data class EndTurn(val seat: Seat) : ShadowDuelStep
}

/** Case-log events. Private ones go to one player only; public ones never depend on hidden values. */
@Serializable
sealed interface ShadowDuelEvent {
    @Serializable
    @SerialName("game_started")
    data class GameStarted(val killer: Seat, val inspector: Seat) : ShadowDuelEvent

    @Serializable
    @SerialName("turn_started")
    data class TurnStarted(val seat: Seat, val turn: Int) : ShadowDuelEvent

    /** Private: your (new) identity. */
    @Serializable
    @SerialName("your_identity")
    data class YourIdentity(val card: SuspectId) : ShadowDuelEvent

    @Serializable
    @SerialName("cards_drawn")
    data class CardsDrawn(val seat: Seat, val count: Int) : ShadowDuelEvent

    /** Private: the cards you just drew. */
    @Serializable
    @SerialName("you_drew")
    data class YouDrew(val cards: List<SuspectId>) : ShadowDuelEvent

    @Serializable
    @SerialName("identity_chosen")
    data class IdentityChosen(val seat: Seat) : ShadowDuelEvent

    @Serializable
    @SerialName("shifted")
    data class Shifted(val seat: Seat, val line: Line, val by: Int) : ShadowDuelEvent

    @Serializable
    @SerialName("collapsed")
    data class Collapsed(val seat: Seat, val direction: CollapseDirection, val removed: List<SuspectId>) : ShadowDuelEvent

    /** [inspectorAdjacent] is answered only when the victim was exonerated (`KI-7`), otherwise `null`. */
    @Serializable
    @SerialName("killed")
    data class Killed(val seat: Seat, val victim: SuspectId, val kills: Int, val inspectorAdjacent: Boolean? = null) :
        ShadowDuelEvent

    /** Success shows the Killer's old identity as [exonerated]; failure shows the [discarded] card. */
    @Serializable
    @SerialName("disguised")
    data class Disguised(val seat: Seat, val exonerated: SuspectId? = null, val discarded: SuspectId? = null) :
        ShadowDuelEvent

    @Serializable
    @SerialName("accused")
    data class Accused(val seat: Seat, val target: SuspectId, val correct: Boolean) : ShadowDuelEvent

    /** [killerAdjacent] is `null` when nobody is asked (the suspect left the board, or `KI-2` is off). */
    @Serializable
    @SerialName("exonerated")
    data class Exonerated(val seat: Seat, val card: SuspectId, val placed: Boolean, val killerAdjacent: Boolean? = null) :
        ShadowDuelEvent

    @Serializable
    @SerialName("game_over")
    data class GameOver(val outcome: Outcome, val reveal: Reveal) : ShadowDuelEvent

    @Serializable
    @SerialName("nudged")
    data class Nudged(val seat: Seat) : ShadowDuelEvent
}

@Serializable
data class SeatView(val seat: Seat, val role: Role, val handCount: Int)

/** The viewer's own secrets. */
@Serializable
data class MeView(val seat: Seat, val role: Role, val identity: SuspectId?, val hand: List<SuspectId>)

@Serializable
data class SeatReveal(val seat: Seat, val role: Role, val identity: SuspectId?, val hand: List<SuspectId>)

/** Everything, shown once the game is over. */
@Serializable
data class Reveal(val seats: List<SeatReveal>)

/** One viewer's projection. The deck order and RNG state are never included. */
@Serializable
data class ShadowDuelView(
    val board: BoardView,
    val deckCount: Int,
    val discard: List<SuspectId>,
    val outOfPlay: List<SuspectId>,
    val seats: List<SeatView>,
    val kills: Int,
    val killsToWin: Int,
    val turn: Int,
    val lastShift: ShiftRecord?,
    val interrogateDeadOnBoard: Boolean,
    val pending: PendingView?,
    val outcome: Outcome?,
    val me: MeView?,
    val reveal: Reveal?,
)
