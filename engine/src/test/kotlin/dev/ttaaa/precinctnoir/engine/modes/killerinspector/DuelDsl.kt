package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.api.ApplyResult
import dev.ttaaa.precinctnoir.engine.core.api.Command
import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.board.ShiftRecord
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret
import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.Agenda
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.rng.RngState
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.BoardAscii

typealias DuelState = GameState<ShadowDuelModel, ShadowDuelStep>
typealias DuelResult = ApplyResult.Accepted<DuelState, ShadowDuelEvent>

/** In hand-built positions seat 0 is the Killer and seat 1 the Inspector. */
val KILLER = Seat(0)
val INSPECTOR = Seat(1)

/** A plain 5×5 city: suspect ids 0..24 in reading order, all alive. */
const val CITY = """
     0  1  2  3  4
     5  6  7  8  9
    10 11 12 13 14
    15 16 17 18 19
    20 21 22 23 24
"""

fun s(id: Int) = SuspectId(id)

fun ids(vararg values: Int) = values.map(::SuspectId)

/**
 * A Shadow Duel position, built by hand, waiting on [toMove]'s decision.
 *
 * Board notation is [BoardAscii]. Defaults describe an ordinary mid-game Killer turn.
 */
fun duel(
    board: String = CITY,
    killer: Int,
    inspector: Int?,
    hand: List<Int> = emptyList(),
    deck: List<Int> = emptyList(),
    discard: List<Int> = emptyList(),
    removed: List<Int> = emptyList(),
    kills: Int = 1,
    turn: Int = 3,
    toMove: Seat = KILLER,
    prompt: String = ShadowDuel.Prompts.TURN,
    kind: PendingKind = PendingKind.TURN,
    lastShift: ShiftRecord? = null,
    interrogateDeadOnBoard: Boolean = true,
): DuelState = GameState(
    actionSeq = 10,
    rng = RngState(7),
    agenda = Agenda(pending = Pending(5, toMove, kind, prompt), nextDecisionId = 6),
    model = ShadowDuelModel(
        config = ShadowDuelConfig(interrogateDeadOnBoard),
        killer = KILLER,
        board = BoardAscii.parse(board, removed),
        deck = Deck(deck.map(::SuspectId)),
        discard = discard.map(::SuspectId),
        secrets = listOf(PlayerSecret(SuspectId(killer)), PlayerSecret(inspector?.let(::SuspectId), hand.map(::SuspectId))),
        kills = kills,
        turn = turn,
        lastShift = lastShift,
    ),
)

val DuelState.actor: Seat get() = checkNotNull(agenda.pending).actor

fun DuelState.options(seat: Seat = actor): List<Opt> = ShadowDuel.legalActions(this, Viewer.Player(seat))

inline fun <reified O : Opt> DuelState.option(action: String): O = options().filterIsInstance<O>().single { it.action == action }

fun DuelState.actions(seat: Seat = actor): List<String> = options(seat).map(Opt::action)

fun DuelState.attempt(choice: Choice, seat: Seat = actor, decisionId: Int = checkNotNull(agenda.pending).id) =
    ShadowDuel.apply(this, Command(seat, decisionId, choice))

/** Applies [choice] for the pending actor; it must be accepted. */
fun DuelState.act(choice: Choice): DuelResult {
    val result = attempt(choice)
    check(result is ApplyResult.Accepted) { "expected $choice to be accepted, got $result" }
    return result
}

fun DuelState.rejection(choice: Choice, seat: Seat = actor, decisionId: Int = checkNotNull(agenda.pending).id): Rejection {
    val result = attempt(choice, seat, decisionId)
    check(result is ApplyResult.Rejected) { "expected $choice to be rejected, got $result" }
    return result.reason
}

val DuelResult.public: List<ShadowDuelEvent> get() = events.filter { it.audience == Audience.Public }.map { it.event }

fun DuelResult.privateTo(seat: Seat): List<ShadowDuelEvent> =
    events.filter { it.audience == Audience.ToPlayer(seat) }.map { it.event }

val DuelResult.model: ShadowDuelModel get() = state.model
