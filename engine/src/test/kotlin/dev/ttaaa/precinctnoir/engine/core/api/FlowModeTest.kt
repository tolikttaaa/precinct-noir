package dev.ttaaa.precinctnoir.engine.core.api

import dev.ttaaa.precinctnoir.engine.ModeRegistry
import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.Agenda
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.CounterEvent
import dev.ttaaa.precinctnoir.engine.testing.CounterMode
import dev.ttaaa.precinctnoir.engine.testing.CounterModel
import dev.ttaaa.precinctnoir.engine.testing.CounterStep
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val noConfig = JsonObject(emptyMap())

private fun command(seat: Int, decision: Int, action: String = "inc") = buildJsonObject {
    put("seat", JsonPrimitive(seat))
    put("decisionId", JsonPrimitive(decision))
    put("choice", buildJsonObject { put("t", JsonPrimitive("simple")); put("action", JsonPrimitive(action)) })
}

class FlowModeTest : FunSpec({

    val erased = ErasedMode(CounterMode)

    test("setup drains steps up to the first decision and numbers decisions from 1") {
        val start = CounterMode.setup(2, noConfig, seed = 1)
        start.state.agenda.pending!!.let { it.id shouldBe 1; it.actor shouldBe Seat(0); it.kind shouldBe PendingKind.TURN }
        start.state.actionSeq shouldBe 0
        start.events shouldBe emptyList()
    }

    test("apply validates actor, decision id and legality, then runs until the next decision") {
        val start = CounterMode.setup(2, noConfig, 1).state
        CounterMode.apply(start, Command(Seat(1), 1, SimpleChoice("inc"))) shouldBe ApplyResult.Rejected(Rejection.NOT_YOUR_DECISION)
        CounterMode.apply(start, Command(Seat(0), 2, SimpleChoice("inc"))) shouldBe ApplyResult.Rejected(Rejection.STALE_DECISION)
        CounterMode.apply(start, Command(Seat(0), 1, SimpleChoice("dec"))) shouldBe ApplyResult.Rejected(Rejection.ILLEGAL_INPUT)

        val next = CounterMode.apply(start, Command(Seat(0), 1, SimpleChoice("inc"))) as ApplyResult.Accepted
        next.events.map { it.audience } shouldContainExactly listOf(Audience.Public, Audience.ToTeam(0))
        next.events.map { it.n } shouldContainExactly listOf(0, 1)
        next.events.all { it.actionSeq == 1L }.shouldBeTrue()
    }

    test("the game ends with an outcome, then refuses commands and stops nudging") {
        var state = CounterMode.setup(2, buildJsonObject { put("target", JsonPrimitive(2)) }, 1).state
        CounterMode.onTimer(state) shouldBe CounterEvent.Nudged(Seat(0))
        repeat(2) {
            val pending = state.agenda.pending!!
            state = (CounterMode.apply(state, Command(pending.actor, pending.id, SimpleChoice("inc"))) as ApplyResult.Accepted).state
        }
        state.outcome shouldBe Outcome(listOf(Seat(1)), "reached")
        state.agenda.stack shouldBe emptyList()
        CounterMode.apply(state, Command(Seat(0), 3, SimpleChoice("inc"))) shouldBe ApplyResult.Rejected(Rejection.GAME_OVER)
        CounterMode.onTimer(state).shouldBeNull()
    }

    test("setup refuses wrong player counts, bad config and a mode that stalls") {
        shouldThrow<IllegalArgumentException> { CounterMode.setup(4, noConfig, 1) }
        shouldThrow<IllegalArgumentException> { CounterMode.setup(2, buildJsonObject { put("nope", JsonPrimitive(1)) }, 1) }
        shouldThrow<IllegalStateException> { CounterMode.setup(2, buildJsonObject { put("broken", JsonPrimitive(true)) }, 1) }
    }

    test("Tx allows one pending decision and ends the game once") {
        val tx = Tx<CounterModel, CounterStep, CounterEvent>(CounterModel(1, 1), Rng.seeded(1), 1, Agenda())
        tx.await(Seat(0), PendingKind.TURN, "x")
        shouldThrow<IllegalStateException> { tx.await(Seat(0), PendingKind.TURN, "y") }
        shouldThrow<IllegalStateException> { tx.finish(Outcome(emptyList(), "z")) }
        val done = Tx<CounterModel, CounterStep, CounterEvent>(CounterModel(1, 1), Rng.seeded(1), 1, Agenda(listOf(CounterStep.Noop)))
        done.finish(Outcome(emptyList(), "z"))
        done.build().agenda.stack shouldBe emptyList()
        shouldThrow<IllegalStateException> { done.finish(Outcome(emptyList(), "again")) }
    }

    context("erased boundary") {
        test("JSON commands are decoded strictly; anything malformed is rejected without throwing") {
            val game = erased.setup(2, noConfig, 1).game
            erased.apply(game, command(0, 1)).shouldBeInstanceOf<AnyResult.Accepted>()
            erased.apply(game, command(1, 1)) shouldBe AnyResult.Rejected(Rejection.NOT_YOUR_DECISION)
            listOf(
                JsonPrimitive("hi"),
                JsonArray(emptyList()),
                buildJsonObject { put("seat", JsonPrimitive(0)) },
                buildJsonObject { put("seat", JsonPrimitive(-1)); put("decisionId", JsonPrimitive(1)); put("choice", command(0, 1)["choice"]!!) },
                JsonObject(command(0, 1) + ("extra" to JsonPrimitive(true))),
                JsonObject(command(0, 1) + ("choice" to buildJsonObject { put("t", JsonPrimitive("teleport")) })),
            ).forEach { erased.apply(game, it) shouldBe AnyResult.Rejected(Rejection.MALFORMED) }
        }

        test("views carry the projection plus the viewer's legal options") {
            val game = erased.setup(2, noConfig, 1).game
            val mine = erased.view(game, Viewer.Player(Seat(0)))
            mine.view.jsonObject["count"]!!.jsonPrimitive.int shouldBe 0
            mine.legal shouldBe listOf(dev.ttaaa.precinctnoir.engine.core.legal.SimpleOpt("inc"))
            erased.view(game, Viewer.Spectator).legal shouldBe emptyList()
        }

        test("team events are visible to that team only; status, nudge and metadata pass through") {
            val start = erased.setup(3, noConfig, 1).game
            val result = erased.apply(start, command(0, 1)) as AnyResult.Accepted
            val note = result.events.single { it.audience is Audience.ToTeam }
            erased.isVisible(result.game, note.audience, Viewer.Player(Seat(2))).shouldBeTrue()
            erased.isVisible(result.game, note.audience, Viewer.Player(Seat(1))).shouldBeFalse()
            erased.rematchConfig(result.game) shouldBe JsonObject(emptyMap())
            erased.status(result.game).let { it.actionSeq shouldBe 1; it.pending!!.actor shouldBe Seat(1); it.outcome.shouldBeNull() }
            erased.nudge(result.game).shouldNotBeNull()
            erased.id shouldBe "counter"
            erased.players shouldBe 1..3
            erased.schemaVersion shouldBe 2
            erased.configSpec.options.map { it.key } shouldBe listOf("target", "broken")
        }

        test("snapshots round-trip, and older schemas are migrated on restore") {
            val game = (erased.apply(erased.setup(2, noConfig, 1).game, command(0, 1)) as AnyResult.Accepted).game
            val snapshot = erased.encode(game)
            erased.encode(erased.decode(snapshot, 2)) shouldBe snapshot
            val model = snapshot.getValue("model").jsonObject
            val v1 = JsonObject(snapshot + ("model" to JsonObject(model - "count" + ("n" to model.getValue("count")))))
            erased.encode(erased.decode(v1, 1)) shouldBe snapshot
            shouldThrow<IllegalArgumentException> { erased.decode(snapshot, 3) }
        }

        test("a game from one mode can't be driven by another") {
            val duel = ModeRegistry.byId(ShadowDuel.id)!!.setup(2, noConfig, 1).game
            shouldThrow<IllegalArgumentException> { erased.status(duel) }
        }

        test("range options validate their default") {
            shouldThrow<IllegalArgumentException> { ConfigOption.Range("x", 1, 3, 4) }
        }
    }

    test("the registry finds modes by id") {
        ModeRegistry.byId("killer_inspector")!!.players shouldBe 2..2
        ModeRegistry.byId("nope").shouldBeNull()
        ModeRegistry.modes.map { it.id } shouldBe listOf("killer_inspector")
    }
})
