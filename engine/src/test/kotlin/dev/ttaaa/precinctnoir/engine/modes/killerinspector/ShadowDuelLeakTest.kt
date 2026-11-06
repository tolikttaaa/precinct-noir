package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret
import dev.ttaaa.precinctnoir.engine.core.cards.replace
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.rng.RngState
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.playout
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import kotlinx.serialization.json.JsonObject

/**
 * Non-interference: changing only what a viewer can't see must not change anything they're shown
 * (projection and legal menu). Positions come from random playouts.
 */
class ShadowDuelLeakTest : FunSpec({

    /** Reshuffles a seat's hidden cards together with the deck, keeping every count the same. */
    fun ShadowDuelModel.reshuffle(seat: Seat, rng: Rng): ShadowDuelModel {
        val secret = secret(seat)
        val pool = rng.shuffled(listOfNotNull(secret.identity) + secret.hand + deck.cards)
        val identity = secret.identity?.let { pool.first() }
        val rest = if (identity == null) pool else pool.drop(1)
        return copy(
            secrets = secrets.replace(seat, PlayerSecret(identity, rest.take(secret.hand.size))),
            deck = Deck(rest.drop(secret.hand.size)),
        )
    }

    fun positions(): List<DuelState> = (1L..40L).flatMap { seed ->
        val states = mutableListOf<DuelState>()
        ShadowDuel.playout(2, JsonObject(emptyMap()), seed, maxSteps = 200) { states += it.after }
        states.filter { it.outcome == null }
    }

    val all = positions()

    test("a player's view and menu don't depend on the opponent's secrets, the deck order or the RNG") {
        val rng = Rng.seeded(5)
        for (state in all) {
            val m = state.model
            for (viewer in m.seats) {
                val opponent = Seat(1 - viewer.index)
                repeat(3) {
                    val hidden = state.copy(model = m.reshuffle(opponent, rng), rng = RngState(rng.nextLong()))
                    val who = Viewer.Player(viewer)
                    ShadowDuel.project(hidden, who) shouldBe ShadowDuel.project(state, who)
                    ShadowDuel.legalActions(hidden, who) shouldBe ShadowDuel.legalActions(state, who)
                }
            }
        }
    }

    test("the shared screen sees no secrets at all") {
        val rng = Rng.seeded(6)
        for (state in all) {
            val hidden = state.copy(model = state.model.reshuffle(Seat(0), rng).reshuffle(Seat(1), rng), rng = RngState(rng.nextLong()))
            ShadowDuel.project(hidden, Viewer.Spectator) shouldBe ShadowDuel.project(state, Viewer.Spectator)
        }
    }

    test("serialized views never contain the deck order or the RNG state") {
        for (state in all.take(200)) {
            for (viewer in listOf(Viewer.Spectator, Viewer.Player(Seat(0)), Viewer.Player(Seat(1)))) {
                val json = EngineJson.encodeToString(ShadowDuelView.serializer(), ShadowDuel.project(state, viewer))
                json shouldNotContain "\"rng\""
                json shouldNotContain "\"cards\""
                if (viewer == Viewer.Spectator) json shouldNotContain "\"me\""
            }
        }
    }

    test("sanity: the perturbation really changes hidden data while keeping counts") {
        val rng = Rng.seeded(7)
        val changed = all.count { state ->
            val m = state.model
            val hidden = m.reshuffle(m.inspector, rng).reshuffle(m.killer, rng)
            hidden.deck.size shouldBe m.deck.size
            hidden.secrets.map { it.hand.size } shouldBe m.secrets.map { it.hand.size }
            fun cards(model: ShadowDuelModel): Set<SuspectId> =
                (model.secrets.mapNotNull(PlayerSecret::identity) + model.secrets.flatMap(PlayerSecret::hand) + model.deck.cards).toSet()
            cards(hidden) shouldBe cards(m)
            hidden != m
        }
        (changed > all.size / 2) shouldBe true
    }
})
