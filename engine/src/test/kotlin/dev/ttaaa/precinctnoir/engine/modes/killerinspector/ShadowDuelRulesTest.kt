package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.board.Axis
import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.board.ShiftMove
import dev.ttaaa.precinctnoir.engine.core.board.ShiftRecord
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseChoice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseOpt
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetOpt
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel.Actions
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel.Prompts
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel.Reasons
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Accused
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.CardsDrawn
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Collapsed
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Disguised
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Exonerated
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.GameOver
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.GameStarted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.IdentityChosen
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Killed
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Nudged
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Shifted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.TurnStarted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.YouDrew
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.YourIdentity
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

private val noConfig = JsonObject(emptyMap())
private val row2 = Line(Axis.ROW, 2)

class ShadowDuelRulesTest : FunSpec({

    context("setup") {
        test("deals 25 distinct suspects on a 5x5 city; the Killer draws an identity and must kill first") {
            val start = ShadowDuel.setup(2, noConfig, seed = 42)
            val m = start.state.model
            (m.board.rows to m.board.cols) shouldBe (5 to 5)
            m.board.suspects.toSet().size shouldBe 25
            m.board.living().size shouldBe 25
            m.deck.size shouldBe 24
            m.deck.cards.toSet() + m.killerIdentity shouldBe m.board.suspects.toSet()
            m.inspectorIdentity.shouldBeNull()
            m.kills shouldBe 0
            start.state.agenda.pending!!.let {
                it.actor shouldBe m.killer
                it.prompt shouldBe Prompts.OPENING_KILL
                it.kind shouldBe PendingKind.TURN
            }
            start.events.map { it.event } shouldContainExactly listOf(
                GameStarted(m.killer, m.inspector),
                YourIdentity(m.killerIdentity),
                TurnStarted(m.killer, 1),
            )
        }

        test("the same seed deals the same game; roles are random across seeds") {
            ShadowDuel.setup(2, noConfig, 7) shouldBe ShadowDuel.setup(2, noConfig, 7)
            ShadowDuel.setup(2, noConfig, 7).state.model.board shouldNotBe ShadowDuel.setup(2, noConfig, 8).state.model.board
            (1L..40L).map { ShadowDuel.setup(2, noConfig, it).state.model.killer }.toSet() shouldBe setOf(Seat(0), Seat(1))
        }

        test("killerSeat fixes the Killer (used to swap roles on a rematch)") {
            for (seat in 0..1) {
                val config = buildJsonObject { put("killerSeat", JsonPrimitive(seat)) }
                (1L..10L).forEach { ShadowDuel.setup(2, config, it).state.model.killer shouldBe Seat(seat) }
            }
        }

        test("refuses other player counts, unknown config keys and an invalid killerSeat") {
            shouldThrow<IllegalArgumentException> { ShadowDuel.setup(3, noConfig, 1) }
            shouldThrow<IllegalArgumentException> { ShadowDuel.setup(2, buildJsonObject { put("bogus", JsonPrimitive(1)) }, 1) }
            shouldThrow<IllegalArgumentException> { ShadowDuel.setup(2, buildJsonObject { put("killerSeat", JsonPrimitive(2)) }, 1) }
        }

        test("the lobby offers only the KI-2 switch, on by default") {
            ShadowDuel.configSpec.options.map { it.key } shouldBe listOf("interrogateDeadOnBoard")
        }
    }

    context("first round") {
        test("the Killer's opening turn offers only Kill, on living neighbours") {
            val start = duel(killer = 12, inspector = null, turn = 1, prompt = Prompts.OPENING_KILL, kills = 0)
            start.options().single() shouldBe TargetOpt(Actions.KILL, ids(6, 7, 8, 11, 13, 16, 17, 18))
        }

        test("after the opening kill the Inspector draws 4 privately and must pick a living identity (KI-3)") {
            val start = duel(killer = 12, inspector = null, deck = listOf(7, 0, 1, 2, 3), turn = 1, prompt = Prompts.OPENING_KILL, kills = 0)
            val afterKill = start.act(TargetChoice(Actions.KILL, s(7)))
            afterKill.model.kills shouldBe 1 // KI-6: the opening kill counts
            afterKill.model.secret(INSPECTOR).hand shouldBe ids(7, 0, 1, 2)
            afterKill.public shouldContain CardsDrawn(INSPECTOR, 4)
            afterKill.privateTo(INSPECTOR) shouldContainExactly listOf(YouDrew(ids(7, 0, 1, 2)))
            afterKill.state.agenda.pending!!.let { it.kind shouldBe PendingKind.SETUP; it.prompt shouldBe Prompts.CHOOSE_IDENTITY }
            // KI-3: the suspect just killed can't be picked.
            afterKill.state.options().single() shouldBe PickOpt(Actions.CHOOSE_IDENTITY, ids(0, 1, 2), 1, 1)
            afterKill.state.rejection(PickChoice(Actions.CHOOSE_IDENTITY, ids(7))) shouldBe Rejection.ILLEGAL_INPUT

            val picked = afterKill.state.act(PickChoice(Actions.CHOOSE_IDENTITY, ids(1)))
            picked.model.inspectorIdentity shouldBe s(1)
            picked.model.secret(INSPECTOR).hand shouldBe ids(7, 0, 2)
            picked.public shouldContain IdentityChosen(INSPECTOR)
            picked.privateTo(INSPECTOR) shouldContainExactly listOf(YourIdentity(s(1)))
            picked.state.agenda.pending!!.let { it.actor shouldBe KILLER; it.prompt shouldBe Prompts.TURN }
            picked.model.turn shouldBe 3
        }
    }

    context("killer") {
        test("kill: a living neighbour dies; no question unless the victim was exonerated") {
            val r = duel(killer = 12, inspector = 0, kills = 3).act(TargetChoice(Actions.KILL, s(13)))
            r.model.board.isAlive(s(13)) shouldBe false
            r.public shouldContain Killed(KILLER, s(13), 4, inspectorAdjacent = null)
            r.state.actor shouldBe INSPECTOR
        }

        test("KI-7: killing an exonerated suspect, even the Killer's old disguise, asks whether the Inspector is adjacent") {
            val board = CITY.replace(" 7 ", " 7+").replace(" 13", " 13+")
            duel(board = board, killer = 12, inspector = 8).act(TargetChoice(Actions.KILL, s(7))).public shouldContain
                Killed(KILLER, s(7), 2, inspectorAdjacent = true)
            duel(board = board, killer = 12, inspector = 0).act(TargetChoice(Actions.KILL, s(13))).public shouldContain
                Killed(KILLER, s(13), 2, inspectorAdjacent = false)
        }

        test("killing the Inspector's identity wins at once and reveals everything") {
            val r = duel(killer = 12, inspector = 6, hand = listOf(0, 1, 2)).act(TargetChoice(Actions.KILL, s(6)))
            val outcome = Outcome(listOf(KILLER), Reasons.INSPECTOR_ELIMINATED)
            r.state.outcome shouldBe outcome
            r.state.agenda.pending.shouldBeNull()
            val reveal = Reveal(listOf(SeatReveal(KILLER, Role.KILLER, s(12), emptyList()), SeatReveal(INSPECTOR, Role.INSPECTOR, s(6), ids(0, 1, 2))))
            r.public.last() shouldBe GameOver(outcome, reveal)
            ShadowDuel.project(r.state, Viewer.Spectator).reveal shouldBe reveal
            r.state.rejection(TargetChoice(Actions.KILL, s(7)), KILLER, 1) shouldBe Rejection.GAME_OVER
            ShadowDuel.onTimer(r.state).shouldBeNull()
        }

        test("KI-6: the 14th kill wins (the opening kill counted)") {
            duel(killer = 12, inspector = 0, kills = 13).act(TargetChoice(Actions.KILL, s(13))).state.outcome shouldBe
                Outcome(listOf(KILLER), Reasons.KILL_QUOTA)
        }

        test("KI-4: only living suspects can be killed; with nobody alive in reach there is no Kill") {
            val crowded = CITY.replace(" 6 ", " 6x").replace(" 7 ", " 7x")
            duel(board = crowded, killer = 12, inspector = 0).option<TargetOpt>(Actions.KILL).targets shouldBe ids(8, 11, 13, 16, 17, 18)
            val alone = """
                0  1x 2
                3x 4x 5
                """
            duel(board = alone, killer = 0, inspector = 5).actions() shouldBe listOf(Actions.SHIFT, Actions.COLLAPSE)
        }

        test("disguise succeeds on a living suspect: the old identity is publicly exonerated, the new one is private") {
            val r = duel(killer = 12, inspector = 0, deck = listOf(20, 21)).act(SimpleChoice(Actions.DISGUISE))
            r.model.killerIdentity shouldBe s(20)
            r.model.board.tile(s(12))!!.exonerated shouldBe true
            r.model.deck.cards shouldBe ids(21)
            r.public shouldContain Disguised(KILLER, exonerated = s(12))
            r.privateTo(KILLER) shouldContainExactly listOf(YourIdentity(s(20)))
            r.privateTo(INSPECTOR).shouldBeEmpty()
        }

        test("disguise fails on a dead or removed suspect (KI-5): the card is discarded face-up, the turn still ends") {
            val board = CITY.replace(" 20 ", " 20x ")
            for (drawn in listOf(20, 30)) {
                val r = duel(board = board, killer = 12, inspector = 0, deck = listOf(drawn), removed = listOf(30)).act(SimpleChoice(Actions.DISGUISE))
                r.model.killerIdentity shouldBe s(12)
                r.model.discard shouldBe ids(drawn)
                r.public shouldContain Disguised(KILLER, discarded = s(drawn))
                r.privateTo(KILLER).shouldBeEmpty()
                r.state.actor shouldBe INSPECTOR
            }
        }

        test("KI-1: with an empty deck the Killer can't disguise") {
            duel(killer = 12, inspector = 0).actions() shouldBe listOf(Actions.SHIFT, Actions.KILL)
            duel(killer = 12, inspector = 0, deck = listOf(3)).actions() shouldBe listOf(Actions.SHIFT, Actions.KILL, Actions.DISGUISE)
        }
    }

    context("inspector") {
        test("accuse: anyone living in N[me], including a bluff on yourself (KI-4)") {
            val board = CITY.replace(" 7 ", " 7x")
            duel(board = board, killer = 0, inspector = 12, toMove = INSPECTOR).option<TargetOpt>(Actions.ACCUSE).targets shouldBe
                ids(6, 8, 11, 12, 13, 16, 17, 18)
        }

        test("a wrong accusation is announced and play goes on; the right one wins") {
            val wrong = duel(killer = 0, inspector = 12, toMove = INSPECTOR).act(TargetChoice(Actions.ACCUSE, s(12)))
            wrong.public shouldContain Accused(INSPECTOR, s(12), correct = false)
            wrong.state.actor shouldBe KILLER
            val right = duel(killer = 13, inspector = 12, toMove = INSPECTOR).act(TargetChoice(Actions.ACCUSE, s(13)))
            right.public shouldContain Accused(INSPECTOR, s(13), correct = true)
            right.state.outcome shouldBe Outcome(listOf(INSPECTOR), Reasons.KILLER_CAUGHT)
        }

        test("exonerate: draw to 4, discard one; a living suspect gets the marker and the Killer is asked") {
            val start = duel(killer = 8, inspector = 0, hand = listOf(1, 2, 3), deck = listOf(7, 9), toMove = INSPECTOR)
            val drawn = start.act(SimpleChoice(Actions.EXONERATE))
            drawn.model.secret(INSPECTOR).hand shouldBe ids(1, 2, 3, 7)
            drawn.public shouldContain CardsDrawn(INSPECTOR, 1)
            drawn.privateTo(INSPECTOR) shouldContainExactly listOf(YouDrew(ids(7)))
            drawn.state.agenda.pending!!.let { it.kind shouldBe PendingKind.SUBSTEP; it.prompt shouldBe Prompts.EXONERATE_DISCARD }
            drawn.state.options().single() shouldBe PickOpt(Actions.EXONERATE_DISCARD, ids(1, 2, 3, 7), 1, 1)

            val done = drawn.state.act(PickChoice(Actions.EXONERATE_DISCARD, ids(7)))
            done.model.board.tile(s(7))!!.exonerated shouldBe true
            done.model.secret(INSPECTOR).hand shouldBe ids(1, 2, 3)
            done.public shouldContain Exonerated(INSPECTOR, s(7), placed = true, killerAdjacent = true)
            done.model.discard.shouldBeEmpty()
            done.state.actor shouldBe KILLER
        }

        test("KI-2: a dead suspect still on the board is discarded but still asked about; the switch turns that off") {
            val board = CITY.replace(" 3 ", " 3x")
            for ((variant, expected) in listOf(true to false, false to null)) {
                val r = duel(board = board, killer = 12, inspector = 0, hand = listOf(3, 1, 2, 4), toMove = INSPECTOR, kind = PendingKind.SUBSTEP,
                    prompt = Prompts.EXONERATE_DISCARD, interrogateDeadOnBoard = variant)
                    .act(PickChoice(Actions.EXONERATE_DISCARD, ids(3)))
                r.public shouldContain Exonerated(INSPECTOR, s(3), placed = false, killerAdjacent = expected)
                r.model.discard shouldBe ids(3)
                r.model.board.tile(s(3))!!.exonerated shouldBe false
            }
        }

        test("KI-5: a suspect removed by a collapse is discarded with no question") {
            duel(killer = 12, inspector = 0, hand = listOf(30, 1, 2, 4), removed = listOf(30), toMove = INSPECTOR, kind = PendingKind.SUBSTEP,
                prompt = Prompts.EXONERATE_DISCARD).act(PickChoice(Actions.EXONERATE_DISCARD, ids(30))).public shouldContain
                Exonerated(INSPECTOR, s(30), placed = false, killerAdjacent = null)
        }

        test("KI-1: with an empty deck the Inspector can't exonerate") {
            duel(killer = 0, inspector = 12, hand = listOf(1, 2, 3), toMove = INSPECTOR).actions() shouldBe listOf(Actions.SHIFT, Actions.ACCUSE)
        }
    }

    context("shift and collapse") {
        test("a shift moves the line and blocks only its instant undo for the next player") {
            val r = duel(killer = 12, inspector = 0).act(ShiftChoice(Actions.SHIFT, row2, 1))
            r.model.board.inLine(row2) shouldBe ids(14, 10, 11, 12, 13)
            r.model.lastShift shouldBe ShiftRecord(row2, 1, 5)
            r.public shouldContain Shifted(KILLER, row2, 1)
            val moves = r.state.option<ShiftOpt>(Actions.SHIFT).moves
            moves shouldNotContain ShiftMove(row2, -1)
            moves shouldContain ShiftMove(row2, 1)
            moves.size shouldBe 10 * 2 - 1
        }

        test("any other main action clears the undo block") {
            val shifted = duel(killer = 12, inspector = 0, deck = listOf(1), toMove = INSPECTOR, hand = listOf(2, 3, 4),
                lastShift = ShiftRecord(row2, 1, 5))
            shifted.option<ShiftOpt>(Actions.SHIFT).moves shouldNotContain ShiftMove(row2, -1)
            val accused = shifted.act(TargetChoice(Actions.ACCUSE, s(0)))
            accused.model.lastShift.shouldBeNull()
            accused.state.option<ShiftOpt>(Actions.SHIFT).moves shouldContain ShiftMove(row2, -1)
        }

        test("collapse: one dead per column is removed, KI-8 sends exoneration cards out of play, and the actor may collapse again") {
            val board = """
                 0x+ 1x  2x  3x  4x
                 5x  6   7   8   9x
                10  11  12  13  14
                """
            val start = duel(board = board, killer = 12, inspector = 7, lastShift = ShiftRecord(row2, 1, 5))
            val option = start.option<CollapseOpt>(Actions.COLLAPSE)
            option.options.map { it.direction } shouldBe listOf(CollapseDirection.COLUMNS)
            val first = start.act(CollapseChoice(Actions.COLLAPSE, CollapseDirection.COLUMNS, ids(0, 1, 2, 3, 4)))
            first.model.board.rows shouldBe 2
            first.model.outOfPlay shouldBe ids(0)
            first.model.lastShift.shouldBeNull()
            first.public shouldContain Collapsed(KILLER, CollapseDirection.COLUMNS, ids(0, 1, 2, 3, 4))
            // Columns 0 and 4 still have a dead suspect each, but columns 1-3 don't: no second collapse.
            first.state.actor shouldBe INSPECTOR
        }

        test("a collapse that qualifies again asks the same player to continue or stop") {
            val board = """
                 0x  1x
                 2x  3x
                 4   5
                """
            val first = duel(board = board, killer = 4, inspector = 5).act(CollapseChoice(Actions.COLLAPSE, CollapseDirection.COLUMNS, ids(0, 1)))
            first.state.agenda.pending!!.let { it.actor shouldBe KILLER; it.kind shouldBe PendingKind.SUBSTEP; it.prompt shouldBe Prompts.COLLAPSE_MORE }
            first.state.actions() shouldBe listOf(Actions.COLLAPSE, Actions.STOP_COLLAPSING)
            first.state.act(SimpleChoice(Actions.STOP_COLLAPSING)).state.actor shouldBe INSPECTOR
            val second = first.state.act(CollapseChoice(Actions.COLLAPSE, CollapseDirection.COLUMNS, ids(2, 3)))
            second.model.board.suspects shouldBe ids(4, 5)
            second.state.actor shouldBe INSPECTOR
        }
    }

    context("protocol") {
        test("commands from the wrong seat, for an old decision, or not on the menu are refused") {
            val start = duel(killer = 12, inspector = 0)
            start.rejection(TargetChoice(Actions.KILL, s(13)), seat = INSPECTOR) shouldBe Rejection.NOT_YOUR_DECISION
            start.rejection(TargetChoice(Actions.KILL, s(13)), decisionId = 4) shouldBe Rejection.STALE_DECISION
            start.rejection(TargetChoice(Actions.KILL, s(0))) shouldBe Rejection.ILLEGAL_INPUT
            start.rejection(TargetChoice(Actions.ACCUSE, s(13))) shouldBe Rejection.ILLEGAL_INPUT
            start.rejection(SimpleChoice(Actions.DISGUISE)) shouldBe Rejection.ILLEGAL_INPUT
        }

        test("guards: seats, identities and impossible views are refused loudly") {
            shouldThrow<IllegalArgumentException> { ShadowDuel.setup(2, buildJsonObject { put("killerSeat", JsonPrimitive(-1)) }, 1) }
            val model = duel(killer = 12, inspector = 0).model
            shouldThrow<IllegalArgumentException> { model.copy(secrets = model.secrets.take(1)) }
            shouldThrow<IllegalArgumentException> { model.copy(killer = Seat(2)) }
            shouldThrow<IllegalStateException> {
                model.copy(secrets = listOf(dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret(), model.secrets[1])).killerIdentity
            }
            // A view whose actor has no identity can only come from a bug; it must not produce a menu.
            val view = ShadowDuel.project(duel(killer = 12, inspector = 0), Viewer.Player(KILLER))
            shouldThrow<IllegalStateException> { ShadowDuel.legalFor(view.copy(me = view.me!!.copy(identity = null))) }
            val opening = ShadowDuel.project(duel(killer = 12, inspector = null, turn = 1, prompt = Prompts.OPENING_KILL), Viewer.Player(KILLER))
            shouldThrow<IllegalStateException> { ShadowDuel.legalFor(opening.copy(me = opening.me!!.copy(identity = null))) }
            ShadowDuel.teamOf(duel(killer = 12, inspector = 0), KILLER).shouldBeNull()
        }

        test("on a 1x2 city right after a shift there is no shift to offer, but the Inspector can still accuse") {
            duel(board = "0 1", killer = 0, inspector = 1, toMove = INSPECTOR, lastShift = ShiftRecord(Line(Axis.ROW, 0), 1, 2))
                .actions() shouldBe listOf(Actions.ACCUSE)
        }

        test("play again swaps roles: the rematch config makes the Inspector the Killer") {
            for (seat in 0..1) {
                val first = ShadowDuel.setup(2, buildJsonObject { put("killerSeat", JsonPrimitive(seat)) }, 5).state
                val hint = ShadowDuel.rematchConfig(first)
                hint shouldBe buildJsonObject { put("killerSeat", JsonPrimitive(1 - seat)) }
                ShadowDuel.setup(2, hint, 6).state.model.killer shouldBe first.model.inspector
            }
        }

        test("the turn timer only nudges the pending actor") {
            ShadowDuel.onTimer(duel(killer = 12, inspector = 0, toMove = INSPECTOR)) shouldBe Nudged(INSPECTOR)
        }

        test("each viewer sees only their own secrets; spectators see none; menus only for the actor") {
            val state = duel(killer = 12, inspector = 0, hand = listOf(1, 2, 3), deck = listOf(4, 5))
            val killerView = ShadowDuel.project(state, Viewer.Player(KILLER))
            killerView.me shouldBe MeView(KILLER, Role.KILLER, s(12), emptyList())
            ShadowDuel.project(state, Viewer.Player(INSPECTOR)).me shouldBe MeView(INSPECTOR, Role.INSPECTOR, s(0), ids(1, 2, 3))
            ShadowDuel.project(state, Viewer.Spectator).me.shouldBeNull()
            ShadowDuel.project(state, Viewer.Player(Seat(5))).me.shouldBeNull()
            killerView.reveal.shouldBeNull()
            killerView.deckCount shouldBe 2
            killerView.seats shouldContainExactlyInAnyOrder listOf(SeatView(KILLER, Role.KILLER, 0), SeatView(INSPECTOR, Role.INSPECTOR, 3))
            killerView.killsToWin shouldBe 14
            killerView.pending.shouldNotBeNull().actor shouldBe KILLER
            state.options(INSPECTOR).shouldBeEmpty()
            ShadowDuel.legalActions(state, Viewer.Spectator).shouldBeEmpty()
        }
    }
})

