package dev.ttaaa.precinctnoir.engine.core

import dev.ttaaa.precinctnoir.engine.core.api.ApplyResult
import dev.ttaaa.precinctnoir.engine.core.api.ConfigOption
import dev.ttaaa.precinctnoir.engine.core.api.ConfigSpec
import dev.ttaaa.precinctnoir.engine.core.api.CounterMode
import dev.ttaaa.precinctnoir.engine.core.api.CounterModel
import dev.ttaaa.precinctnoir.engine.core.api.CounterStep
import dev.ttaaa.precinctnoir.engine.core.api.CounterEvent
import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.api.Tx
import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.Grid
import dev.ttaaa.precinctnoir.engine.core.board.Pos
import dev.ttaaa.precinctnoir.engine.core.board.Quadrant
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.Agenda
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.legal.PairChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PairOpt
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SquareChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SquareOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SuspectPair
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMove
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveOpt
import dev.ttaaa.precinctnoir.engine.core.legal.VaultChoice
import dev.ttaaa.precinctnoir.engine.core.legal.VaultOpt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.BoardAscii
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.JsonObject

/** The far side of every guard: lower bounds, wrong action names, and checks that must refuse. */
class BoundaryTest : FunSpec({

    test("grid bounds on every side") {
        val grid = Grid(2, 2)
        listOf(Pos(-1, 0), Pos(0, -1), Pos(2, 0), Pos(0, 2)).forEach { (it in grid).shouldBeFalse() }
        shouldThrow<IllegalArgumentException> { grid.pos(-1) }
        Grid(5, 3).squareCorners(4).shouldBeEmpty()
    }

    test("board guards") {
        shouldThrow<IllegalArgumentException> { Board(1, 0, emptyList()) }
        val board = BoardAscii.parse("0 1x")
        board.isOnBoard(SuspectId(9)).shouldBeFalse()
        board.isOnBoard(SuspectId(1)) shouldBe true
        board.setOfficer(SuspectId(1), null) shouldBe board
        shouldThrow<IllegalArgumentException> { board.shiftMoves(0, null) }
    }

    test("deck and pick ranges refuse negatives") {
        shouldThrow<IllegalArgumentException> { Deck().drawN(-1) }
        shouldThrow<IllegalArgumentException> { PickOpt("p", emptyList(), -1, 1) }
        shouldThrow<IllegalArgumentException> { ConfigOption.Range("x", 1, 3, 0) }
    }

    test("options refuse the right shape under the wrong action name") {
        val a = SuspectId(1)
        val b = SuspectId(2)
        PairOpt("swap", listOf(SuspectPair(a, b))).accepts(PairChoice("other", a, b)).shouldBeFalse()
        TokenMoveOpt("prep", listOf(TokenMove(TokenKind.BOMB, a, b))).accepts(TokenMoveChoice("other", TokenKind.BOMB, a, b)).shouldBeFalse()
        TokenMoveOpt("prep", listOf(TokenMove(TokenKind.BOMB, a, b))).accepts(TokenMoveChoice("prep", TokenKind.THREAT, a, b)).shouldBeFalse()
        SquareOpt("search", 4, listOf(Pos(0, 0))).let {
            it.size shouldBe 4
            it.accepts(SquareChoice("other", Pos(0, 0))).shouldBeFalse()
            it.accepts(SquareChoice("search", Pos(1, 0))).shouldBeFalse()
        }
        VaultOpt("rob", listOf(Quadrant.NW)).accepts(VaultChoice("other", Quadrant.NW)).shouldBeFalse()
        VaultOpt("rob", listOf(Quadrant.NW)).accepts(VaultChoice("rob", Quadrant.SE)).shouldBeFalse()
    }

    test("a finished transaction accepts no decision; setup refuses too few players") {
        val tx = Tx<CounterModel, CounterStep, CounterEvent>(CounterModel(1, 1), Rng.seeded(1), 1, Agenda())
        tx.finish(Outcome(emptyList(), "done"))
        shouldThrow<IllegalStateException> { tx.await(Seat(0), PendingKind.TURN, "late") }
        shouldThrow<IllegalArgumentException> { CounterMode.setup(0, JsonObject(emptyMap()), 1) }
    }

    test("team events need a team") {
        Audience.ToTeam(0).visibleTo(Viewer.Player(Seat(0))) { null }.shouldBeFalse()
    }

    test("rejections, configs and outcomes have stable JSON") {
        Rejection.entries.map { EngineJson.encodeToString(Rejection.serializer(), it) } shouldBe
            listOf("\"game_over\"", "\"not_your_decision\"", "\"stale_decision\"", "\"illegal_input\"", "\"malformed\"")
        val spec = ConfigSpec(listOf(ConfigOption.Toggle("a", true), ConfigOption.Range("b", 3, 5, 4)))
        val json = EngineJson.encodeToString(ConfigSpec.serializer(), spec)
        json shouldBe """{"options":[{"t":"toggle","key":"a","default":true},{"t":"range","key":"b","min":3,"max":5,"default":4}]}"""
        EngineJson.decodeFromString(ConfigSpec.serializer(), json) shouldBe spec
        ConfigSpec().options.shouldBeEmpty()
        ApplyResult.Rejected<Unit, Unit>(Rejection.MALFORMED).reason shouldBe Rejection.MALFORMED
    }
})
