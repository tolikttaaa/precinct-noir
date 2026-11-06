package dev.ttaaa.precinctnoir.engine.testing

import dev.ttaaa.precinctnoir.engine.core.api.ConfigOption
import dev.ttaaa.precinctnoir.engine.core.api.ConfigSpec
import dev.ttaaa.precinctnoir.engine.core.api.FlowMode
import dev.ttaaa.precinctnoir.engine.core.api.ModeSerializers
import dev.ttaaa.precinctnoir.engine.core.api.Tx

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleOpt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.persist.Migration
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.PendingView
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * A tiny test game: players take turns adding one until [target]; seats are in teams by parity.
 * Exercises the generic flow in engine and server tests.
 */
@Serializable
data class CounterModel(val players: Int, val target: Int, val count: Int = 0, val broken: Boolean = false)

@Serializable
data class CounterConfig(val target: Int = 3, val broken: Boolean = false)

@Serializable
sealed interface CounterStep {
    @Serializable
    @SerialName("ask")
    data class Ask(val seat: Seat) : CounterStep

    @Serializable
    @SerialName("noop")
    data object Noop : CounterStep
}

@Serializable
sealed interface CounterEvent {
    @Serializable
    @SerialName("counted")
    data class Counted(val seat: Seat, val count: Int) : CounterEvent

    @Serializable
    @SerialName("team_note")
    data class TeamNote(val team: Int) : CounterEvent

    @Serializable
    @SerialName("nudged")
    data class Nudged(val seat: Seat) : CounterEvent
}

@Serializable
data class CounterView(val count: Int, val pending: PendingView?, val me: Seat?)

object CounterMode : FlowMode<CounterModel, CounterStep, CounterEvent, CounterView>() {
    override val id = "counter"
    override val schemaVersion = 2
    override val players = 1..3
    override val configSpec = ConfigSpec(listOf(ConfigOption.Range("target", 1, 9, 3), ConfigOption.Toggle("broken", false)))
    override val serializers =
        ModeSerializers(CounterModel.serializer(), CounterStep.serializer(), CounterEvent.serializer(), CounterView.serializer())

    /** Schema 1 called the counter `n`. */
    override val migrations = listOf(
        Migration(1) { json ->
            val model = json.getValue("model").jsonObject
            JsonObject(json + ("model" to JsonObject(model - "n" + ("count" to model.getValue("n")))))
        },
    )

    override fun begin(players: Int, config: JsonObject, rng: Rng): CounterModel {
        val settings = EngineJson.decodeFromJsonElement(CounterConfig.serializer(), config)
        return CounterModel(players, settings.target, broken = settings.broken)
    }

    override fun firstSteps(model: CounterModel): List<CounterStep> =
        if (model.broken) listOf(CounterStep.Noop) else listOf(CounterStep.Noop, CounterStep.Ask(Seat(0)))

    override fun run(tx: Tx<CounterModel, CounterStep, CounterEvent>, step: CounterStep) {
        when (step) {
            CounterStep.Noop -> Unit
            is CounterStep.Ask -> tx.await(step.seat, PendingKind.TURN, "count")
        }
    }

    override fun resolve(tx: Tx<CounterModel, CounterStep, CounterEvent>, pending: Pending, choice: Choice) {
        val count = tx.model.count + 1
        tx.model = tx.model.copy(count = count)
        tx.public(CounterEvent.Counted(pending.actor, count))
        tx.emit(Audience.ToTeam(pending.actor.index % 2), CounterEvent.TeamNote(pending.actor.index % 2))
        if (count >= tx.model.target) {
            tx.finish(Outcome(listOf(pending.actor), "reached"))
        } else {
            tx.pushAll(listOf(CounterStep.Noop, CounterStep.Ask(Seat((pending.actor.index + 1) % tx.model.players))))
        }
    }

    override fun nudged(seat: Seat): CounterEvent = CounterEvent.Nudged(seat)

    override fun project(state: GameState<CounterModel, CounterStep>, viewer: Viewer): CounterView =
        CounterView(state.model.count, state.agenda.pending?.let(PendingView::of), (viewer as? Viewer.Player)?.seat)

    override fun legalFor(view: CounterView): List<Opt> =
        if (view.me != null && view.pending?.actor == view.me) listOf(SimpleOpt("inc")) else emptyList()

    override fun teamOf(state: GameState<CounterModel, CounterStep>, seat: Seat): Int = seat.index % 2
}
