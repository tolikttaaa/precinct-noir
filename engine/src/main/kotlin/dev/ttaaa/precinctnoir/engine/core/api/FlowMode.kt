package dev.ttaaa.precinctnoir.engine.core.api

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.events.EventRecord
import dev.ttaaa.precinctnoir.engine.core.flow.Agenda
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import kotlinx.serialization.json.JsonObject

/**
 * The working copy of one command (or of setup). Modes change [model], schedule steps, emit events,
 * and end by either waiting for a decision ([await]) or finishing the game ([finish]).
 */
class Tx<M : Any, St : Any, E : Any> internal constructor(
    model: M,
    val rng: Rng,
    val actionSeq: Long,
    agenda: Agenda<St>,
) {
    var model: M = model

    var pending: Pending? = null
        private set

    var outcome: Outcome? = null
        private set

    private val stack = agenda.stack.toMutableList()
    private var nextDecisionId = agenda.nextDecisionId
    private val recorded = mutableListOf<EventRecord<E>>()

    val events: List<EventRecord<E>> get() = recorded

    /** Schedules a step to run next (LIFO). */
    fun push(step: St) {
        stack += step
    }

    /** Schedules [steps] so that the first one runs first. */
    fun pushAll(steps: List<St>) {
        steps.asReversed().forEach(::push)
    }

    fun await(actor: Seat, kind: PendingKind, prompt: String) {
        check(pending == null && outcome == null) { "only one decision can be pending" }
        pending = Pending(nextDecisionId++, actor, kind, prompt)
    }

    /** Ends the game. Any steps still scheduled are dropped. */
    fun finish(result: Outcome) {
        check(pending == null && outcome == null) { "the game can end only once, with nothing pending" }
        outcome = result
        stack.clear()
    }

    fun emit(audience: Audience, event: E) {
        recorded += EventRecord(actionSeq, recorded.size, audience, event)
    }

    fun public(event: E): Unit = emit(Audience.Public, event)

    fun toPlayer(seat: Seat, event: E): Unit = emit(Audience.ToPlayer(seat), event)

    internal fun pop(): St? = stack.removeLastOrNull()

    internal fun build(): GameState<M, St> =
        GameState(actionSeq, rng.state(), Agenda(stack.toList(), pending, nextDecisionId), outcome, model)
}

/**
 * Generic driver for agenda-based modes: validates commands, resolves them, then runs scheduled
 * steps until the next decision or the end of the game.
 */
abstract class FlowMode<M : Any, St : Any, E : Any, V : Any> : GameMode<M, St, E, V> {

    /** Builds the dealt model. All randomness must come from [rng]. */
    protected abstract fun begin(players: Int, config: JsonObject, rng: Rng): M

    protected abstract fun firstSteps(model: M): List<St>

    protected abstract fun run(tx: Tx<M, St, E>, step: St)

    /** Applies a [choice] already validated against the actor's legal options. */
    protected abstract fun resolve(tx: Tx<M, St, E>, pending: Pending, choice: Choice)

    protected abstract fun nudged(seat: Seat): E

    final override fun setup(players: Int, config: JsonObject, seed: Long): ApplyResult.Accepted<GameState<M, St>, E> {
        require(players in this.players) { "$id needs ${this.players} players, got $players" }
        val rng = Rng.seeded(seed)
        val model = begin(players, config, rng)
        val tx = Tx<M, St, E>(model, rng, actionSeq = 0, Agenda())
        tx.pushAll(firstSteps(model))
        drain(tx)
        return ApplyResult.Accepted(tx.build(), tx.events)
    }

    final override fun apply(state: GameState<M, St>, command: Command): ApplyResult<GameState<M, St>, E> {
        val pending = state.agenda.pending ?: return ApplyResult.Rejected(Rejection.GAME_OVER)
        if (command.seat != pending.actor) return ApplyResult.Rejected(Rejection.NOT_YOUR_DECISION)
        if (command.decisionId != pending.id) return ApplyResult.Rejected(Rejection.STALE_DECISION)
        val legal = legalActions(state, Viewer.Player(pending.actor))
        if (legal.none { it.accepts(command.choice) }) return ApplyResult.Rejected(Rejection.ILLEGAL_INPUT)

        val tx = Tx<M, St, E>(state.model, Rng.restore(state.rng), state.actionSeq + 1, state.agenda.copy(pending = null))
        resolve(tx, pending, command.choice)
        drain(tx)
        return ApplyResult.Accepted(tx.build(), tx.events)
    }

    final override fun onTimer(state: GameState<M, St>): E? = state.agenda.pending?.let { nudged(it.actor) }

    private fun drain(tx: Tx<M, St, E>) {
        while (tx.pending == null && tx.outcome == null) {
            run(tx, checkNotNull(tx.pop()) { "$id stopped without a decision or an outcome" })
        }
    }
}
