package dev.ttaaa.precinctnoir.engine.testing

import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.board.Officer
import dev.ttaaa.precinctnoir.engine.core.board.ShiftMove
import dev.ttaaa.precinctnoir.engine.core.board.Tile
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.ids.Roster
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.of
import io.kotest.property.arbitrary.shuffle
import io.kotest.property.arbitrary.subsequence

/** Kotest generators for engine types. */
object Arbs {
    /**
     * Random rectangular cities of distinct roster suspects.
     *
     * @param markers also scatter exonerations, arrests, officers and tokens on living suspects.
     * @param deadPercent chance (0–100) that a suspect is dead.
     */
    fun board(maxRows: Int = 7, maxCols: Int = 7, markers: Boolean = true, deadPercent: Int = 40): Arb<Board> = arbitrary {
        val rows = Arb.int(1..maxRows).bind()
        val cols = Arb.int(1..maxCols).bind()
        val ids = Arb.shuffle((0..<Roster.SIZE).toList()).bind().take(rows * cols).map(::SuspectId)
        val tiles = ids.map { id ->
            val dead = Arb.int(0..99).bind() < deadPercent
            when {
                dead -> Tile(id, alive = false, exonerated = markers && Arb.boolean().bind())
                !markers -> Tile(id)
                else -> Tile(
                    id = id,
                    exonerated = Arb.boolean().bind(),
                    arrested = Arb.int(0..9).bind() == 0,
                    officer = Arb.of(null, null, null, Officer(), Officer(stunned = true)).bind(),
                    tokens = Arb.subsequence(TokenKind.entries).bind().sorted(),
                )
            }
        }
        Board(rows, cols, tiles)
    }

    /** A shift of ±1 or ±2 on some line of [board] (possibly a no-op or an undo; callers filter). */
    fun shiftMove(board: Board): Arb<ShiftMove> = arbitrary {
        ShiftMove(Arb.element(board.grid.lines).bind(), Arb.element(-2, -1, 1, 2).bind())
    }

    fun line(board: Board): Arb<Line> = Arb.element(board.grid.lines)
}
