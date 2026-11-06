package dev.ttaaa.precinctnoir.engine.core.board

import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.testing.Arbs
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.filter
import io.kotest.property.arbitrary.flatMap
import io.kotest.property.arbitrary.long
import io.kotest.property.arbitrary.map
import io.kotest.property.checkAll
import dev.ttaaa.precinctnoir.engine.core.rng.Rng

/** Board invariants that must hold for every city, marker layout and move. */
class BoardPropertiesTest : FunSpec({

    val boardsWithMoves = Arbs.board()
        .filter { board -> board.grid.lines.any { board.grid.length(it) > 1 } }
        .flatMap { board -> Arbs.shiftMove(board).filter { !board.isNoOp(it) }.map { board to it } }

    test("a shift is a permutation that only touches its line, and tokens follow their suspect") {
        checkAll(boardsWithMoves) { (board, move) ->
            val after = board.shift(move)
            after.cells.sortedBy(Tile::id) shouldBe board.cells.sortedBy(Tile::id)
            val touched = board.grid.positions(move.line).toSet()
            board.grid.positions.filter { it !in touched }.forEach { after.tileAt(it) shouldBe board.tileAt(it) }
        }
    }

    test("shift then its inverse is the identity") {
        checkAll(boardsWithMoves) { (board, move) ->
            board.shift(move).shift(ShiftMove(move.line, -move.by)) shouldBe board
        }
    }

    test("shifts on one line add up") {
        checkAll(boardsWithMoves, Arb.element(-2, -1, 1, 2)) { (board, move), more ->
            val second = ShiftMove(move.line, more)
            val total = ShiftMove(move.line, move.by + more)
            val once = board.shift(move)
            when {
                once.isNoOp(second) -> Unit
                board.isNoOp(total) -> once.shift(second) shouldBe board
                else -> once.shift(second) shouldBe board.shift(total)
            }
        }
    }

    test("forbids is exact: a move is forbidden iff it restores the city the last shift changed") {
        checkAll(boardsWithMoves, Arb.element(-2, -1, 1, 2)) { (board, move), by ->
            val after = board.shift(move)
            val record = board.record(move)
            for (line in board.grid.lines) {
                val candidate = ShiftMove(line, by)
                if (after.isNoOp(candidate)) continue
                record.forbids(candidate) shouldBe (after.shift(candidate) == board)
            }
        }
    }

    test("collapse keeps a rectangle, keeps relative order and removes only the picks") {
        val collapsible = Arbs.board(markers = false, deadPercent = 60).filter { it.collapseOptions().isNotEmpty() }
        checkAll(collapsible, Arb.long()) { board, seed ->
            val rng = Rng.seeded(seed)
            for (option in board.collapseOptions()) {
                val picks = option.lines.map { it[rng.nextInt(it.size)] }
                val after = board.collapse(option.direction, picks)
                after.cells.size shouldBe after.rows * after.cols
                if (option.direction == CollapseDirection.COLUMNS) {
                    (after.rows to after.cols) shouldBe (board.rows - 1 to board.cols)
                    for (c in 0..<board.cols) {
                        after.inLine(Line(Axis.COLUMN, c)) shouldBe board.inLine(Line(Axis.COLUMN, c)) - picks[c]
                    }
                } else {
                    (after.rows to after.cols) shouldBe (board.rows to board.cols - 1)
                    for (r in 0..<board.rows) {
                        after.inLine(Line(Axis.ROW, r)) shouldBe board.inLine(Line(Axis.ROW, r)) - picks[r]
                    }
                }
                after.living().sorted() shouldBe board.living().sorted()
                after.removed shouldBe picks
            }
        }
    }

    test("a qualifying axis has a dead suspect in every line; otherwise none is offered") {
        checkAll(Arbs.board(markers = false)) { board ->
            for (direction in CollapseDirection.entries) {
                val lines = if (direction == CollapseDirection.COLUMNS) {
                    (0..<board.cols).map { Line(Axis.COLUMN, it) }
                } else {
                    (0..<board.rows).map { Line(Axis.ROW, it) }
                }
                val shrinking = if (direction == CollapseDirection.COLUMNS) board.rows else board.cols
                val expected = shrinking >= 2 && lines.all { line -> board.inLine(line).any { !board.isAlive(it) } }
                (board.collapseOption(direction) != null) shouldBe expected
            }
        }
    }

    test("kill keeps the exoneration and clears what dies with the suspect") {
        checkAll(Arbs.board()) { board ->
            board.cells.filter { it.alive && !it.arrested }.forEach { tile ->
                val dead = board.kill(tile.id).tile(tile.id)!!
                dead shouldBe Tile(tile.id, alive = false, exonerated = tile.exonerated)
            }
            board.suspects.map(SuspectId::value).toSet().size shouldBe board.cells.size
        }
    }
})
