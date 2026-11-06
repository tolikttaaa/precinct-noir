package dev.ttaaa.precinctnoir.engine.core.api

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.events.EventRecord
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.persist.Migrations
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** A game of some mode, opaque to the server. */
class AnyGame internal constructor(val modeId: String, internal val state: GameState<*, *>)

data class AnyEvent(val actionSeq: Long, val n: Int, val audience: Audience, val event: JsonElement)

sealed interface AnyResult {
    data class Accepted(val game: AnyGame, val events: List<AnyEvent>) : AnyResult

    data class Rejected(val reason: Rejection) : AnyResult
}

data class GameStatus(val actionSeq: Long, val pending: Pending?, val outcome: Outcome?)

/** One viewer's projection (mode-specific JSON) and the legal options it allows. */
data class AnyView(val view: JsonElement, val legal: List<Opt>)

/** The JSON-in/JSON-out boundary the server talks to; it never sees mode types. */
interface AnyMode {
    val id: String
    val schemaVersion: Int
    val players: IntRange
    val configSpec: ConfigSpec

    /** Throws [IllegalArgumentException] for a bad player count or config. */
    fun setup(players: Int, config: JsonObject, seed: Long): AnyResult.Accepted

    /** Malformed JSON is rejected with [Rejection.MALFORMED]; it never throws. */
    fun apply(game: AnyGame, command: JsonElement): AnyResult

    fun view(game: AnyGame, viewer: Viewer): AnyView

    fun isVisible(game: AnyGame, audience: Audience, viewer: Viewer): Boolean

    fun status(game: AnyGame): GameStatus

    fun encode(game: AnyGame): JsonObject

    /** Restores a snapshot written at [schemaVersion], migrating it first if needed. */
    fun decode(json: JsonObject, schemaVersion: Int): AnyGame

    fun nudge(game: AnyGame): JsonElement?

    /** Server-only config to merge into the next game when the same players play again. */
    fun rematchConfig(game: AnyGame): JsonObject
}

class ErasedMode<M : Any, St : Any, E : Any, V : Any>(private val mode: GameMode<M, St, E, V>) : AnyMode {
    private val stateSerializer = GameState.serializer(mode.serializers.model, mode.serializers.step)
    override val id: String get() = mode.id
    override val schemaVersion: Int get() = mode.schemaVersion
    override val players: IntRange get() = mode.players
    override val configSpec: ConfigSpec get() = mode.configSpec

    override fun setup(players: Int, config: JsonObject, seed: Long): AnyResult.Accepted =
        accepted(mode.setup(players, config, seed))

    override fun apply(game: AnyGame, command: JsonElement): AnyResult {
        val parsed = try {
            EngineJson.decodeFromJsonElement(Command.serializer(), command)
        } catch (e: IllegalArgumentException) { // includes SerializationException
            return AnyResult.Rejected(Rejection.MALFORMED)
        }
        return when (val result = mode.apply(typed(game), parsed)) {
            is ApplyResult.Accepted -> accepted(result)
            is ApplyResult.Rejected -> AnyResult.Rejected(result.reason)
        }
    }

    override fun view(game: AnyGame, viewer: Viewer): AnyView {
        val view = mode.project(typed(game), viewer)
        return AnyView(EngineJson.encodeToJsonElement(mode.serializers.view, view), mode.legalFor(view))
    }

    override fun isVisible(game: AnyGame, audience: Audience, viewer: Viewer): Boolean {
        val state = typed(game)
        return audience.visibleTo(viewer) { mode.teamOf(state, it) }
    }

    override fun status(game: AnyGame): GameStatus =
        typed(game).let { GameStatus(it.actionSeq, it.agenda.pending, it.outcome) }

    override fun encode(game: AnyGame): JsonObject = EngineJson.encodeToJsonElement(stateSerializer, typed(game)).jsonObject

    override fun decode(json: JsonObject, schemaVersion: Int): AnyGame {
        val current = Migrations.upgrade(json, schemaVersion, mode.schemaVersion, mode.migrations)
        return AnyGame(id, EngineJson.decodeFromJsonElement(stateSerializer, current))
    }

    override fun nudge(game: AnyGame): JsonElement? =
        mode.onTimer(typed(game))?.let { EngineJson.encodeToJsonElement(mode.serializers.event, it) }

    override fun rematchConfig(game: AnyGame): JsonObject = mode.rematchConfig(typed(game))

    private fun accepted(result: ApplyResult.Accepted<GameState<M, St>, E>) =
        AnyResult.Accepted(AnyGame(id, result.state), result.events.map(::erase))

    private fun erase(record: EventRecord<E>) =
        AnyEvent(record.actionSeq, record.n, record.audience, EngineJson.encodeToJsonElement(mode.serializers.event, record.event))

    @Suppress("UNCHECKED_CAST")
    private fun typed(game: AnyGame): GameState<M, St> {
        require(game.modeId == id) { "a ${game.modeId} game was passed to $id" }
        return game.state as GameState<M, St>
    }
}
