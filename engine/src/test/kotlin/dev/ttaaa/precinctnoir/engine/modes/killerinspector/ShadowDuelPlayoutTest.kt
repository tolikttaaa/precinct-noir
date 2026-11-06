package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.ModeRegistry
import dev.ttaaa.precinctnoir.engine.core.api.AnyResult
import dev.ttaaa.precinctnoir.engine.core.api.ApplyResult
import dev.ttaaa.precinctnoir.engine.core.api.Command
import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.board.Axis
import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.ids.Roster
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PairChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.CardLedger
import dev.ttaaa.precinctnoir.engine.testing.isSatisfiable
import dev.ttaaa.precinctnoir.engine.testing.playout
import dev.ttaaa.precinctnoir.engine.testing.replay
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

private val stateSerializer = DuelState.serializer(ShadowDuelModel.serializer(), ShadowDuelStep.serializer())

private fun DuelState.json(): String = EngineJson.encodeToString(stateSerializer, this)

/** Every place a Shadow Duel card can be. */
private fun ledger(m: ShadowDuelModel): Map<String, List<SuspectId>> = mapOf(
    "deck" to m.deck.cards,
    "discard" to m.discard,
    "outOfPlay" to m.outOfPlay,
    "identities" to m.secrets.mapNotNull { it.identity },
    "hand" to m.secrets.flatMap { it.hand },
    "exonerationMarkers" to m.board.cells.filter { it.exonerated }.map { it.id },
)

/** Random but well-formed junk a hostile client might send. */
private fun junk(rng: Rng): Choice {
    val id = SuspectId(rng.nextInt(Roster.SIZE))
    val action = listOf("kill", "accuse", "disguise", "exonerate", "shift", "collapse", "choose_identity", "exonerate_discard", "hack")
        .let { it[rng.nextInt(it.size)] }
    return when (rng.nextInt(6)) {
        0 -> SimpleChoice(action)
        1 -> TargetChoice(action, id)
        2 -> ShiftChoice(action, Line(if (rng.nextInt(2) == 0) Axis.ROW else Axis.COLUMN, rng.nextInt(9) - 2), rng.nextInt(9) - 4)
        3 -> CollapseChoice(action, CollapseDirection.entries[rng.nextInt(2)], List(rng.nextInt(6)) { id })
        4 -> PickChoice(action, List(rng.nextInt(3)) { SuspectId(rng.nextInt(Roster.SIZE)) })
        else -> PairChoice(action, id, id)
    }
}

class ShadowDuelPlayoutTest : FunSpec({

    val noConfig = JsonObject(emptyMap())

    test("random playouts keep every invariant (~2 000 commands per seed)") {
        for (seed in 1L..6L) {
            var commands = 0
            var game = 0L
            val fuzz = Rng.seeded(seed * 31)
            while (commands < 2_000) {
                val config = if (game % 3 == 2L) buildJsonObject { put("interrogateDeadOnBoard", JsonPrimitive(false)) } else noConfig
                val result = ShadowDuel.playout(2, config, seed = seed * 10_000 + game, maxSteps = 600) { step ->
                    val m = step.after.model
                    // Each card is in exactly one place.
                    CardLedger.assertEachCardOnce(m.board.suspects + m.board.removed, ledger(m))
                    // Only the Killer kills: every dead or removed suspect is one kill.
                    m.kills shouldBe m.board.cells.count { !it.alive } + m.board.removed.size
                    // The Inspector holds 3 cards between turns (4 only while choosing a discard or an identity).
                    if (m.inspectorIdentity != null && step.after.agenda.pending?.prompt != ShadowDuel.Prompts.EXONERATE_DISCARD) {
                        m.secret(m.inspector).hand.size shouldBe 3
                    }
                    // The Killer's identity is always alive and never exonerated.
                    m.board.tile(m.killerIdentity)!!.let { it.alive.shouldBeTrue(); it.exonerated shouldBe false }
                    // Snapshot round-trip.
                    EngineJson.decodeFromString(stateSerializer, step.after.json()) shouldBe step.after
                    // Events: numbered in order; private payloads go to exactly one player.
                    step.events.map { it.n } shouldBe step.events.indices.toList()
                    step.events.forEach { record ->
                        val private = record.event is ShadowDuelEvent.YouDrew || record.event is ShadowDuelEvent.YourIdentity
                        (record.audience is Audience.ToPlayer) shouldBe private
                    }
                    // Whoever must act next always has a satisfiable menu.
                    step.after.agenda.pending?.let { pending ->
                        val menu = ShadowDuel.legalActions(step.after, Viewer.Player(pending.actor))
                        menu.isNotEmpty().shouldBeTrue()
                        menu.all { it.isSatisfiable() }.shouldBeTrue()
                        menu.map { it.action }.toSet().size shouldBe menu.size
                        // Hostile input is refused (or happens to be legal), never thrown.
                        repeat(3) {
                            val reply = ShadowDuel.apply(step.after, Command(pending.actor, pending.id, junk(fuzz)))
                            if (reply is ApplyResult.Rejected) reply.reason shouldBe Rejection.ILLEGAL_INPUT
                        }
                        val other = Seat(1 - pending.actor.index)
                        ShadowDuel.apply(step.after, Command(other, pending.id, junk(fuzz))) shouldBe ApplyResult.Rejected(Rejection.NOT_YOUR_DECISION)
                        ShadowDuel.apply(step.after, Command(pending.actor, pending.id - 1, junk(fuzz))) shouldBe
                            ApplyResult.Rejected(Rejection.STALE_DECISION)
                    }
                }
                // Replaying the same commands from the same seed reproduces the game byte for byte.
                ShadowDuel.replay(2, config, seed * 10_000 + game, result.commands).json() shouldBe result.final.json()
                commands += result.commands.size
                game++
            }
        }
    }

    test("random games end, and both sides win some") {
        val reasons = (1L..150L).map { ShadowDuel.playout(2, noConfig, it, maxSteps = 5_000).final.outcome?.reason }
        reasons.all { it != null }.shouldBeTrue()
        reasons.toSet() shouldBe setOf(
            ShadowDuel.Reasons.INSPECTOR_ELIMINATED,
            ShadowDuel.Reasons.KILL_QUOTA,
            ShadowDuel.Reasons.KILLER_CAUGHT,
        )
    }

    test("the erased JSON boundary plays a whole game and restores from every snapshot") {
        val mode = ModeRegistry.byId(ShadowDuel.id)!!
        val typed = ShadowDuel.playout(2, noConfig, seed = 99, maxSteps = 5_000)
        var game = mode.setup(2, noConfig, 99).game
        for (command in typed.commands) {
            val json = EngineJson.encodeToJsonElement(Command.serializer(), command)
            game = mode.apply(game, json).shouldBeInstanceOf<AnyResult.Accepted>().game
            game = mode.decode(mode.encode(game), mode.schemaVersion)
        }
        mode.encode(game) shouldBe EngineJson.encodeToJsonElement(stateSerializer, typed.final)
        mode.status(game).outcome shouldBe typed.final.outcome
        mode.nudge(game) shouldBe null
    }
})
