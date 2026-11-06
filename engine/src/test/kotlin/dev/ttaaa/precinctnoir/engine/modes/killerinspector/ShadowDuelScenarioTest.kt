package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.board.Axis
import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseChoice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseOpt
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetOpt
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel.Actions
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Disguised
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Exonerated
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Killed
import dev.ttaaa.precinctnoir.engine.testing.BoardAscii
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Situations equivalent to the worked examples in the original rulebook, rebuilt in our own terms
 * (the rulebook itself is never copied). Each pins one observable outcome a player would check.
 */
class ShadowDuelScenarioTest : FunSpec({

    test("turn-1 kill and first pick, from a real deal") {
        val start = ShadowDuel.setup(2, buildJsonObject { put("killerSeat", JsonPrimitive(0)) }, seed = 2026).state
        val kill = start.option<TargetOpt>(Actions.KILL)
        start.actions() shouldBe listOf(Actions.KILL)
        val victim = kill.targets.first()
        val afterKill = start.act(TargetChoice(Actions.KILL, victim))
        val hand = afterKill.model.secret(INSPECTOR).hand
        hand.size shouldBe 4
        val pick = afterKill.state.option<PickOpt>(Actions.CHOOSE_IDENTITY)
        pick.cards shouldBe hand.filter { it != victim }
        val picked = afterKill.state.act(PickChoice(Actions.CHOOSE_IDENTITY, listOf(pick.cards.last())))
        picked.model.inspectorIdentity shouldBe pick.cards.last()
        picked.model.secret(INSPECTOR).hand.size shouldBe 3
        picked.model.kills shouldBe 1
    }

    test("a failed disguise: the drawn suspect is already dead, so the card is discarded face-up and the Killer stays put") {
        val board = CITY.replace(" 21 ", " 21x ")
        val r = duel(board = board, killer = 12, inspector = 0, deck = listOf(21, 3)).act(SimpleChoice(Actions.DISGUISE))
        r.public shouldContain Disguised(KILLER, discarded = s(21))
        r.model.killerIdentity shouldBe s(12)
        r.model.discard shouldBe ids(21)
        r.model.board shouldBe BoardAscii.parse(board)
    }

    test("exonerate → \"Yes\": the discarded suspect is alive, gets the marker, and the Killer next to it must say yes") {
        val r = duel(killer = 2, inspector = 20, hand = listOf(4, 9, 15, 7), toMove = INSPECTOR,
            kind = dev.ttaaa.precinctnoir.engine.core.flow.PendingKind.SUBSTEP, prompt = ShadowDuel.Prompts.EXONERATE_DISCARD)
            .act(PickChoice(Actions.EXONERATE_DISCARD, listOf(s(7))))
        r.public shouldContain Exonerated(INSPECTOR, s(7), placed = true, killerAdjacent = true)
        r.model.board.tile(s(7))!!.exonerated shouldBe true
    }

    test("kill → \"No\": killing an exonerated suspect far from the Inspector answers no") {
        val board = CITY.replace(" 3 ", " 3+")
        val r = duel(board = board, killer = 4, inspector = 20).act(TargetChoice(Actions.KILL, s(3)))
        r.public shouldContain Killed(KILLER, s(3), kills = 2, inspectorAdjacent = false)
    }

    test("shift example: sliding a column down moves the bottom suspect to the top") {
        val column = Line(Axis.COLUMN, 1)
        val r = duel(killer = 12, inspector = 0).act(ShiftChoice(Actions.SHIFT, column, 1))
        r.model.board.inLine(column) shouldBe ids(21, 1, 6, 11, 16)
    }

    test("collapse example: a 5x5 city with a dead suspect in every column shrinks to 4x5; where a column has two, the actor picks") {
        val board = """
             0   1   2   3   4
             5   6x  7   8   9x
            10  11  12x 13  14
            15x 16  17x 18x 19
            20  21  22  23  24
            """
        val start = duel(board = board, killer = 13, inspector = 1)
        val option = start.option<CollapseOpt>(Actions.COLLAPSE).options.single()
        option.direction shouldBe CollapseDirection.COLUMNS
        option.lines shouldBe listOf(ids(15), ids(6), ids(12, 17), ids(18), ids(9))
        val r = start.act(CollapseChoice(Actions.COLLAPSE, CollapseDirection.COLUMNS, ids(15, 6, 12, 18, 9)))
        BoardAscii.render(r.model.board) shouldBe BoardAscii.render(
            BoardAscii.parse(
                """
                 0   1   2   3   4
                 5  11   7   8  14
                10  16  17x 13  19
                20  21  22  23  24
                """,
            ),
        )
        r.model.board.removed shouldBe ids(15, 6, 12, 18, 9)
        r.model.kills shouldBe 1 // collapsing removes bodies; it never adds kills
    }

    test("config can switch KI-2 off for the whole game") {
        val config = buildJsonObject { put("interrogateDeadOnBoard", JsonPrimitive(false)) }
        ShadowDuel.setup(2, config, 1).state.model.config.interrogateDeadOnBoard shouldBe false
        ShadowDuel.project(ShadowDuel.setup(2, config, 1).state, dev.ttaaa.precinctnoir.engine.core.view.Viewer.Spectator)
            .interrogateDeadOnBoard shouldBe false
        JsonObject(emptyMap()).let { ShadowDuel.setup(2, it, 1).state.model.config.interrogateDeadOnBoard shouldBe true }
    }
})
