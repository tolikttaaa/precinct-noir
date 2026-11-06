package dev.ttaaa.precinctnoir.engine.core.board

import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.testing.BoardAscii
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

private fun ids(vararg values: Int) = values.map(::SuspectId)

private val col0 = Line(Axis.COLUMN, 0)
private val col1 = Line(Axis.COLUMN, 1)
private val row0 = Line(Axis.ROW, 0)

class BoardTest : FunSpec({

    val start = BoardAscii.parse(
        """
         0  1  2
         3  4  5
         6  7  8
        """,
    )

    context("shift") {
        test("row +1 moves right and the last suspect wraps to the front") {
            BoardAscii.render(start.shift(ShiftMove(row0, 1))) shouldBe "2 0 1\n3 4 5\n6 7 8"
        }

        test("column +1 moves down and the bottom suspect wraps to the top") {
            BoardAscii.render(start.shift(ShiftMove(col1, 1))) shouldBe "0 7 2\n3 1 5\n6 4 8"
        }

        test("column -2 equals column +1 on a line of 3") {
            start.shift(ShiftMove(col0, -2)) shouldBe start.shift(ShiftMove(col0, 1))
        }

        test("legacy regression: shifting right/down never duplicates or loses a suspect") {
            // The old Area.kt duplicated a card when shifting RIGHT/DOWN.
            for (move in listOf(ShiftMove(row0, 1), ShiftMove(col0, 1), ShiftMove(row0, 2), ShiftMove(col0, 2))) {
                start.shift(move).suspects.sorted() shouldBe start.suspects.sorted()
            }
        }

        test("no-op shifts are illegal, including every shift of a 1-cell line") {
            val single = BoardAscii.parse("0 1 2")
            single.isNoOp(ShiftMove(col0, 1)) shouldBe true
            shouldThrow<IllegalArgumentException> { single.shift(ShiftMove(col0, 1)) }
            BoardAscii.parse("0 1").isNoOp(ShiftMove(row0, 2)) shouldBe true
        }

        test("the last shift forbids exactly its reversal, modulo the line length (+2 then +2 on 4)") {
            val wide = BoardAscii.parse("0 1 2 3")
            val record = wide.record(ShiftMove(row0, 2))
            record shouldBe ShiftRecord(row0, 2, 4)
            record.forbids(ShiftMove(row0, 2)) shouldBe true
            record.forbids(ShiftMove(row0, -2)) shouldBe true
            record.forbids(ShiftMove(row0, 1)) shouldBe false
            record.forbids(ShiftMove(Line(Axis.COLUMN, 2), -2)) shouldBe false
        }

        test("shiftMoves lists ±1 (or ±2) on every line minus no-ops and the forbidden undo") {
            start.shiftMoves(1, null).size shouldBe 6 * 2
            start.shiftMoves(2, null).size shouldBe 6 * 4
            val last = start.record(ShiftMove(col1, 1))
            start.shiftMoves(1, last) shouldBe start.shiftMoves(1, null) - ShiftMove(col1, -1)
            // On a 1x2 city, the only line of length 2 is blocked after a shift; the columns are no-ops.
            val tiny = BoardAscii.parse("0 1")
            tiny.shiftMoves(1, tiny.record(ShiftMove(row0, 1))).shouldBeEmpty()
            shouldThrow<IllegalArgumentException> { start.shiftMoves(3, null) }
        }
    }

    context("collapse") {
        test("a column collapse removes the picked dead suspect per column; the rest slide up in order") {
            val board = BoardAscii.parse(
                """
                 0  1x 2
                 3x 4  5x
                 6x 7x 8
                """,
            )
            val option = board.collapseOption(CollapseDirection.COLUMNS)!!
            option.lines shouldBe listOf(ids(3, 6), ids(1, 7), ids(5))
            val after = board.collapse(CollapseDirection.COLUMNS, ids(6, 1, 5))
            BoardAscii.render(after) shouldBe "0 4 2\n3x 7x 8"
            after.removed shouldBe ids(6, 1, 5)
            after.isAlive(SuspectId(6)) shouldBe false
            after.isOnBoard(SuspectId(6)) shouldBe false
        }

        test("a row collapse shrinks the city by one column") {
            val board = BoardAscii.parse(
                """
                 0x 1  2
                 3  4x 5
                """,
            )
            board.collapseOption(CollapseDirection.COLUMNS).shouldBeNull()
            BoardAscii.render(board.collapse(CollapseDirection.ROWS, ids(0, 4))) shouldBe "1 2\n3 5"
        }

        test("legacy regression: collapse never removes a living suspect and only shrinks the chosen axis") {
            // The old Area.kt removed living cards along the wrong axis.
            val board = BoardAscii.parse(
                """
                 0  1  2x
                 3x 4  5
                """,
            )
            board.collapseOptions().map(CollapseOption::direction) shouldContainExactly listOf(CollapseDirection.ROWS)
            shouldThrow<IllegalArgumentException> { board.collapse(CollapseDirection.ROWS, ids(0, 3)) }
            shouldThrow<IllegalArgumentException> { board.collapse(CollapseDirection.COLUMNS, ids(3, 4, 2)) }
            val after = board.collapse(CollapseDirection.ROWS, ids(2, 3))
            after.rows shouldBe 2
            after.cols shouldBe 2
            after.living() shouldBe ids(0, 1, 4, 5)
        }

        test("needs exactly one valid pick per line") {
            val board = BoardAscii.parse("0x 1x")
            board.collapseOption(CollapseDirection.COLUMNS).shouldBeNull() // a 1-row city can't lose its row
            shouldThrow<IllegalArgumentException> { board.collapse(CollapseDirection.ROWS, ids(0, 1)) }
            shouldThrow<IllegalArgumentException> { board.collapse(CollapseDirection.ROWS, emptyList()) }
            board.collapse(CollapseDirection.ROWS, ids(1)).suspects shouldBe ids(0)
        }

        test("arrested suspects are alive and never collapsed") {
            val option = BoardAscii.parse("0a 1x\n2 3x").collapseOptions().single()
            option.direction shouldBe CollapseDirection.ROWS
            option.lines shouldBe listOf(ids(1), ids(3))
        }
    }

    context("suspects, markers and tokens") {
        test("kill clears tokens and the officer marker but keeps the exoneration") {
            val board = BoardAscii.parse("0+oBP 1")
            val tile = board.kill(SuspectId(0)).tile(SuspectId(0))!!
            BoardAscii.renderCell(tile) shouldBe "0x+"
            shouldThrow<IllegalArgumentException> { board.kill(SuspectId(0)).kill(SuspectId(0)) }
            shouldThrow<IllegalArgumentException> { BoardAscii.parse("0a").kill(SuspectId(0)) }
        }

        test("tokens are kept sorted, unique and only on the living") {
            val board = BoardAscii.parse("0 1 2x")
                .placeToken(SuspectId(0), TokenKind.BOMB)
                .placeToken(SuspectId(0), TokenKind.TREASURE)
            board.tile(SuspectId(0))!!.tokens shouldBe listOf(TokenKind.TREASURE, TokenKind.BOMB)
            board.tokenCount(TokenKind.BOMB) shouldBe 1
            shouldThrow<IllegalArgumentException> { board.placeToken(SuspectId(0), TokenKind.BOMB) }
            shouldThrow<IllegalArgumentException> { board.placeToken(SuspectId(2), TokenKind.BOMB) }
            shouldThrow<IllegalArgumentException> { board.removeToken(SuspectId(1), TokenKind.BOMB) }
            val moved = board.moveToken(TokenKind.BOMB, SuspectId(0), SuspectId(1))
            BoardAscii.render(moved) shouldBe "0T 1B 2x"
            BoardAscii.render(moved.removeToken(SuspectId(1), TokenKind.BOMB)) shouldBe "0T 1 2x"
        }

        test("markers: exonerate once, arrest the living, officers on the living") {
            val board = BoardAscii.parse("0 1x 2")
            BoardAscii.render(board.exonerate(SuspectId(1))) shouldBe "0 1x+ 2"
            shouldThrow<IllegalArgumentException> { board.exonerate(SuspectId(1)).exonerate(SuspectId(1)) }
            BoardAscii.render(board.arrest(SuspectId(0))) shouldBe "0a 1x 2"
            shouldThrow<IllegalArgumentException> { board.arrest(SuspectId(1)) }
            shouldThrow<IllegalArgumentException> { board.arrest(SuspectId(0)).arrest(SuspectId(0)) }
            BoardAscii.render(board.setOfficer(SuspectId(2), Officer(stunned = true))) shouldBe "0 1x 2s"
            BoardAscii.render(board.setOfficer(SuspectId(2), Officer()).setOfficer(SuspectId(2), null)) shouldBe "0 1x 2"
            shouldThrow<IllegalArgumentException> { board.setOfficer(SuspectId(1), Officer()) }
        }

        test("swap trades places, markers included") {
            val board = BoardAscii.parse("0+ 1 2T")
            BoardAscii.render(board.swap(SuspectId(0), SuspectId(2))) shouldBe "2T 1 0+"
            shouldThrow<IllegalArgumentException> { board.swap(SuspectId(1), SuspectId(1)) }
            shouldThrow<IllegalArgumentException> { board.swap(SuspectId(1), SuspectId(9)) }
        }

        test("lookups by suspect, and suspect-based geometry") {
            start.posOf(SuspectId(5)) shouldBe Pos(1, 2)
            start.posOf(SuspectId(9)).shouldBeNull()
            start.tile(SuspectId(9)).shouldBeNull()
            start.isAlive(SuspectId(9)) shouldBe false
            start.neighbors(SuspectId(0)) shouldBe ids(1, 3, 4)
            start.closedNeighbors(SuspectId(0)) shouldBe ids(0, 1, 3, 4)
            start.orthogonalWithin(SuspectId(4), 1) shouldBe ids(1, 3, 5, 7)
            start.diagonalWithin(SuspectId(4), 1) shouldBe ids(0, 2, 6, 8)
            start.inLine(col1) shouldBe ids(1, 4, 7)
            shouldThrow<IllegalArgumentException> { start.requirePos(SuspectId(9)) }
            shouldThrow<IllegalArgumentException> { start.update(SuspectId(0)) { Tile(SuspectId(9)) } }
        }

        test("a board must be a full rectangle of distinct suspects") {
            shouldThrow<IllegalArgumentException> { Board(2, 2, listOf(Tile(SuspectId(0)))) }
            shouldThrow<IllegalArgumentException> { Board(1, 2, listOf(Tile(SuspectId(0)), Tile(SuspectId(0)))) }
            shouldThrow<IllegalArgumentException> { Board(1, 1, listOf(Tile(SuspectId(0))), removed = ids(0)) }
            shouldThrow<IllegalArgumentException> { Board(0, 0, emptyList()) }
        }

        test("tiles reject unsorted tokens and markers on the dead") {
            shouldThrow<IllegalArgumentException> { Tile(SuspectId(0), tokens = listOf(TokenKind.BOMB, TokenKind.TREASURE)) }
            shouldThrow<IllegalArgumentException> { Tile(SuspectId(0), alive = false, tokens = listOf(TokenKind.BOMB)) }
            shouldThrow<IllegalArgumentException> { Tile(SuspectId(0), alive = false, officer = Officer()) }
            shouldThrow<IllegalArgumentException> { Tile(SuspectId(0), alive = false, arrested = true) }
        }
    }
})
