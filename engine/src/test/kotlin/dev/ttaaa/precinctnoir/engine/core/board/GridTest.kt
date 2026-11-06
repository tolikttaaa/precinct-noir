package dev.ttaaa.precinctnoir.engine.core.board

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldBeSorted
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlin.math.abs
import kotlin.math.max

class GridTest : FunSpec({

    test("rejects an empty grid") {
        shouldThrow<IllegalArgumentException> { Grid(0, 3) }
        shouldThrow<IllegalArgumentException> { Grid(3, 0) }
    }

    test("corner, edge and inner cells have 3, 5 and 8 neighbours; nothing wraps") {
        val grid = Grid(5, 5)
        grid.neighbors(Pos(0, 0)) shouldHaveSize 3
        grid.neighbors(Pos(0, 2)) shouldHaveSize 5
        grid.neighbors(Pos(2, 2)) shouldHaveSize 8
        grid.neighbors(Pos(0, 0)) shouldContainExactly listOf(Pos(0, 1), Pos(1, 0), Pos(1, 1))
        grid.closedNeighbors(Pos(4, 4)) shouldContainExactly listOf(Pos(3, 3), Pos(3, 4), Pos(4, 3), Pos(4, 4))
    }

    test("a 1x1 city has no neighbours") {
        Grid(1, 1).neighbors(Pos(0, 0)).shouldBeEmpty()
    }

    test("neighbourhoods and ranges match a brute-force definition, in reading order") {
        checkAll(Arb.int(1..7), Arb.int(1..7), Arb.int(1..3)) { rows, cols, d ->
            val grid = Grid(rows, cols)
            for (p in grid.positions) {
                fun brute(keep: (Int, Int) -> Boolean) = grid.positions.filter { keep(it.row - p.row, it.col - p.col) }
                grid.neighbors(p) shouldBe brute { dr, dc -> max(abs(dr), abs(dc)) == 1 }
                grid.closedNeighbors(p) shouldBe brute { dr, dc -> max(abs(dr), abs(dc)) <= 1 }
                grid.orthogonalWithin(p, d) shouldBe brute { dr, dc -> (dr == 0 && abs(dc) in 1..d) || (dc == 0 && abs(dr) in 1..d) }
                grid.diagonalWithin(p, d) shouldBe brute { dr, dc -> abs(dr) == abs(dc) && abs(dr) in 1..d }
                grid.neighbors(p).shouldBeSorted()
            }
        }
    }

    test("index and pos are inverse; lines list rows then columns") {
        val grid = Grid(2, 3)
        grid.positions.forEachIndexed { i, p -> grid.index(p) shouldBe i; grid.pos(i) shouldBe p }
        grid.size shouldBe 6
        grid.lines shouldContainExactly listOf(
            Line(Axis.ROW, 0), Line(Axis.ROW, 1),
            Line(Axis.COLUMN, 0), Line(Axis.COLUMN, 1), Line(Axis.COLUMN, 2),
        )
        grid.positions(Line(Axis.ROW, 1)) shouldContainExactly listOf(Pos(1, 0), Pos(1, 1), Pos(1, 2))
        grid.positions(Line(Axis.COLUMN, 2)) shouldContainExactly listOf(Pos(0, 2), Pos(1, 2))
        grid.length(Line(Axis.ROW, 0)) shouldBe 3
        grid.length(Line(Axis.COLUMN, 0)) shouldBe 2
        grid.count(Axis.ROW) shouldBe 2
    }

    test("out-of-range cells, lines and radii are rejected") {
        val grid = Grid(2, 2)
        shouldThrow<IllegalArgumentException> { grid.index(Pos(2, 0)) }
        shouldThrow<IllegalArgumentException> { grid.pos(4) }
        shouldThrow<IllegalArgumentException> { grid.length(Line(Axis.COLUMN, 2)) }
        shouldThrow<IllegalArgumentException> { grid.positions(Line(Axis.ROW, -1)) }
        shouldThrow<IllegalArgumentException> { grid.neighbors(Pos(-1, 0)) }
        shouldThrow<IllegalArgumentException> { grid.orthogonalWithin(Pos(0, 0), 0) }
        (Pos(1, 1) in grid) shouldBe true
        (Pos(1, 2) in grid) shouldBe false
    }

    test("4x4 squares: corners and cells") {
        val grid = Grid(5, 6)
        grid.squareCorners(4) shouldHaveSize 2 * 3
        grid.square(Pos(1, 2), 4) shouldHaveSize 16
        grid.square(Pos(0, 0), 2) shouldContainExactly listOf(Pos(0, 0), Pos(0, 1), Pos(1, 0), Pos(1, 1))
        Grid(3, 7).squareCorners(4).shouldBeEmpty()
        shouldThrow<IllegalArgumentException> { grid.square(Pos(2, 0), 4) }
        shouldThrow<IllegalArgumentException> { grid.squareCorners(0) }
    }

    test("positions order rows before columns") {
        Pos(0, 5) shouldBe Pos(0, 5)
        (Pos(0, 5) < Pos(1, 0)) shouldBe true
        (Pos(1, 0) < Pos(1, 1)) shouldBe true
    }
})
