package dev.ttaaa.precinctnoir.engine.testing

import dev.ttaaa.precinctnoir.engine.core.api.ApplyResult
import dev.ttaaa.precinctnoir.engine.core.api.Command
import dev.ttaaa.precinctnoir.engine.core.api.GameMode
import dev.ttaaa.precinctnoir.engine.core.events.EventRecord
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseChoice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseOpt
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.legal.PairChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PairOpt
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SquareChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SquareOpt
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetOpt
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveOpt
import dev.ttaaa.precinctnoir.engine.core.legal.VaultChoice
import dev.ttaaa.precinctnoir.engine.core.legal.VaultOpt
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.JsonObject

/** True if at least one choice satisfies this option (an offered option must never be a dead end). */
fun Opt.isSatisfiable(): Boolean = when (this) {
    is SimpleOpt -> true
    is ShiftOpt -> moves.isNotEmpty()
    is CollapseOpt -> options.isNotEmpty() && options.all { o -> o.lines.all(List<SuspectId>::isNotEmpty) }
    is TargetOpt -> targets.isNotEmpty()
    is PairOpt -> pairs.isNotEmpty()
    is PickOpt -> cards.size >= min
    is TokenMoveOpt -> moves.isNotEmpty()
    is SquareOpt -> corners.isNotEmpty()
    is VaultOpt -> vaults.isNotEmpty()
}

/** A uniformly random choice this option accepts. */
fun Opt.sample(rng: Rng): Choice {
    fun <T> List<T>.oneOf(): T = this[rng.nextInt(size)]
    return when (this) {
        is SimpleOpt -> SimpleChoice(action)
        is ShiftOpt -> moves.oneOf().let { ShiftChoice(action, it.line, it.by) }
        is CollapseOpt -> options.oneOf().let { o -> CollapseChoice(action, o.direction, o.lines.map { it.oneOf() }) }
        is TargetOpt -> TargetChoice(action, targets.oneOf())
        is PairOpt -> pairs.oneOf().let { if (rng.nextInt(2) == 0) PairChoice(action, it.a, it.b) else PairChoice(action, it.b, it.a) }
        is PickOpt -> {
            val upper = minOf(max, cards.size)
            PickChoice(action, rng.shuffled(cards).take(min + rng.nextInt(upper - min + 1)))
        }
        is TokenMoveOpt -> moves.oneOf().let { TokenMoveChoice(action, it.kind, it.from, it.to) }
        is SquareOpt -> SquareChoice(action, corners.oneOf())
        is VaultOpt -> VaultChoice(action, vaults.oneOf())
    }
}

data class PlayoutStep<M, St, E>(
    val before: GameState<M, St>,
    val command: Command,
    val after: GameState<M, St>,
    val events: List<EventRecord<E>>,
)

data class PlayoutResult<M, St, E>(
    val setup: ApplyResult.Accepted<GameState<M, St>, E>,
    val commands: List<Command>,
    val final: GameState<M, St>,
)

/**
 * Plays random legal moves from a fresh game until it ends or [maxSteps] commands were applied.
 * The game's own randomness comes from [seed]; the players' choices from [chooserSeed].
 */
fun <M : Any, St : Any, E : Any, V : Any> GameMode<M, St, E, V>.playout(
    players: Int,
    config: JsonObject,
    seed: Long,
    maxSteps: Int,
    chooserSeed: Long = seed.inv(),
    onStep: (PlayoutStep<M, St, E>) -> Unit = {},
): PlayoutResult<M, St, E> {
    val setup = setup(players, config, seed)
    val chooser = Rng.seeded(chooserSeed)
    val commands = mutableListOf<Command>()
    var state = setup.state
    while (commands.size < maxSteps) {
        val pending = state.agenda.pending ?: break
        val options = legalActions(state, Viewer.Player(pending.actor))
        val command = Command(pending.actor, pending.id, options[chooser.nextInt(options.size)].sample(chooser))
        val result = apply(state, command)
        check(result is ApplyResult.Accepted) { "a sampled legal choice was rejected: $command -> $result" }
        onStep(PlayoutStep(state, command, result.state, result.events))
        commands += command
        state = result.state
    }
    return PlayoutResult(setup, commands, state)
}

/** Re-applies [commands] to a fresh game; every one must be accepted. */
fun <M : Any, St : Any, E : Any, V : Any> GameMode<M, St, E, V>.replay(
    players: Int,
    config: JsonObject,
    seed: Long,
    commands: List<Command>,
): GameState<M, St> = commands.fold(setup(players, config, seed).state) { state, command ->
    val result = apply(state, command)
    check(result is ApplyResult.Accepted) { "replay rejected $command: $result" }
    result.state
}

/** Checks that every card of the game sits in exactly one place. */
object CardLedger {
    fun assertEachCardOnce(all: Collection<SuspectId>, places: Map<String, Collection<SuspectId>>) {
        val seen = places.flatMap { (place, cards) -> cards.map { it to place } }
        val duplicates = seen.groupBy({ it.first }, { it.second }).filterValues { it.size > 1 }
        duplicates shouldBe emptyMap()
        seen.map { it.first }.toSet() shouldBe all.toSet()
    }
}
