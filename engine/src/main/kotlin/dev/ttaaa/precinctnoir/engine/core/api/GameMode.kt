package dev.ttaaa.precinctnoir.engine.core.api

import dev.ttaaa.precinctnoir.engine.core.events.EventRecord
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.persist.Migration
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** A player's answer to decision [decisionId]. The server fills in [seat] from the authenticated session. */
@Serializable
data class Command(val seat: Seat, val decisionId: Int, val choice: Choice)

/** Deliberately opaque reasons a command was refused. */
@Serializable
enum class Rejection {
    @SerialName("game_over")
    GAME_OVER,

    @SerialName("not_your_decision")
    NOT_YOUR_DECISION,

    @SerialName("stale_decision")
    STALE_DECISION,

    @SerialName("illegal_input")
    ILLEGAL_INPUT,

    @SerialName("malformed")
    MALFORMED,
}

sealed interface ApplyResult<S, E> {
    data class Accepted<S, E>(val state: S, val events: List<EventRecord<E>>) : ApplyResult<S, E>

    data class Rejected<S, E>(val reason: Rejection) : ApplyResult<S, E>
}

/** A lobby variant switch. */
@Serializable
sealed interface ConfigOption {
    val key: String

    @Serializable
    @SerialName("toggle")
    data class Toggle(override val key: String, val default: Boolean) : ConfigOption

    @Serializable
    @SerialName("range")
    data class Range(override val key: String, val min: Int, val max: Int, val default: Int) : ConfigOption {
        init {
            require(default in min..max) { "default $default is outside $min..$max" }
        }
    }
}

@Serializable
data class ConfigSpec(val options: List<ConfigOption> = emptyList())

class ModeSerializers<M, St, E, V>(
    val model: KSerializer<M>,
    val step: KSerializer<St>,
    val event: KSerializer<E>,
    val view: KSerializer<V>,
)

/**
 * One game mode: pure, deterministic and server-authoritative.
 *
 * @param M the mode's model (board, deck, secrets, counters)
 * @param St the mode's agenda steps
 * @param E the mode's events
 * @param V the per-viewer projection
 */
interface GameMode<M : Any, St : Any, E : Any, V : Any> {
    /** Stable id used in snapshots and the API, e.g. `killer_inspector`. */
    val id: String

    /** Version of the model's JSON shape. Bump it with a [Migration] whenever the shape changes. */
    val schemaVersion: Int

    val players: IntRange

    /** Lobby switches. The config object may also carry server-set keys that aren't listed here. */
    val configSpec: ConfigSpec

    val serializers: ModeSerializers<M, St, E, V>

    val migrations: List<Migration>

    /**
     * Deals a new game. Throws [IllegalArgumentException] for an unsupported player count or an invalid
     * [config]; nothing a player sends reaches this.
     */
    fun setup(players: Int, config: JsonObject, seed: Long): ApplyResult.Accepted<GameState<M, St>, E>

    /** What [viewer] may see. Built from whitelisted fields only. */
    fun project(state: GameState<M, St>, viewer: Viewer): V

    /** Legal options for the viewer of [view]: empty unless they are the pending decision's actor. */
    fun legalFor(view: V): List<Opt>

    /** Always derived from the projection, so menus can never depend on what the viewer can't see. */
    fun legalActions(state: GameState<M, St>, viewer: Viewer): List<Opt> = legalFor(project(state, viewer))

    fun apply(state: GameState<M, St>, command: Command): ApplyResult<GameState<M, St>, E>

    /** A turn-timer nudge for the pending actor. Never changes state. */
    fun onTimer(state: GameState<M, St>): E?

    /**
     * Server-only config for the next game when the same players, in the same seats, play again
     * (e.g. Shadow Duel swaps roles). Merged over the lobby config.
     */
    fun rematchConfig(state: GameState<M, St>): JsonObject = JsonObject(emptyMap())

    /** Team of [seat] for team-audience events; `null` in modes without teams. */
    fun teamOf(state: GameState<M, St>, seat: Seat): Int? = null
}
