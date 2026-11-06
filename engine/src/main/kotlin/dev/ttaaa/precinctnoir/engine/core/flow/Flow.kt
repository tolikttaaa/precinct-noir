package dev.ttaaa.precinctnoir.engine.core.flow

import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.rng.RngState
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Why a decision is being asked. Only the turn order cares; the protocol treats them all alike. */
@Serializable
enum class PendingKind {
    /** First-turn picks (e.g. the Inspector choosing an identity). */
    @SerialName("setup")
    SETUP,

    /** A normal turn: exactly one main action. */
    @SerialName("turn")
    TURN,

    /** A follow-up inside the same action (e.g. which card to discard, collapse again?). */
    @SerialName("substep")
    SUBSTEP,

    /** A start-of-turn effect. */
    @SerialName("trigger")
    TRIGGER,

    /** Another player's reaction (e.g. Protect). */
    @SerialName("reaction")
    REACTION,

    /** A free action forced on a player out of turn. */
    @SerialName("forced")
    FORCED,
}

/** The one decision the game waits for. [prompt] is a public i18n key; legal options come from the actor's view. */
@Serializable
data class Pending(val id: Int, val actor: Seat, val kind: PendingKind, val prompt: String)

/** @property reason an i18n key such as `kill_quota`. */
@Serializable
data class Outcome(val winners: List<Seat>, val reason: String)

/** A LIFO stack of mode steps still to run (top = last), plus the decision being waited on. */
@Serializable
data class Agenda<St>(
    val stack: List<St> = emptyList(),
    val pending: Pending? = null,
    val nextDecisionId: Int = 1,
)

/**
 * A whole game at rest: the mode's model plus the generic flow envelope.
 *
 * At rest exactly one of `agenda.pending` and [outcome] is set.
 */
@Serializable
data class GameState<M, St>(
    val actionSeq: Long,
    val rng: RngState,
    val agenda: Agenda<St>,
    val outcome: Outcome? = null,
    val model: M,
) {
    init {
        require((agenda.pending == null) != (outcome == null)) { "a game at rest has either a pending decision or an outcome" }
        require(outcome == null || agenda.stack.isEmpty()) { "a finished game has no steps left" }
    }
}
