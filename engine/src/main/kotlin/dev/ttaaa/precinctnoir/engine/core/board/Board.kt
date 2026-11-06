package dev.ttaaa.precinctnoir.engine.core.board

import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Slide [line] by [by] cells: positive moves right (rows) or down (columns), wrapping around. */
@Serializable
data class ShiftMove(val line: Line, val by: Int)

/** The last shift, kept until another main action, for the "no instant undo" rule. */
@Serializable
data class ShiftRecord(val line: Line, val by: Int, val length: Int) {
    /** True if [move] would exactly reverse this shift (a modular test: +2 then +2 undoes on a line of 4). */
    fun forbids(move: ShiftMove): Boolean = move.line == line && Math.floorMod(move.by + by, length) == 0
}

@Serializable
enum class CollapseDirection {
    /** Remove one dead suspect from every column; the city loses a row. */
    @SerialName("columns")
    COLUMNS,

    /** Remove one dead suspect from every row; the city loses a column. */
    @SerialName("rows")
    ROWS,
}

/** A legal collapse: for each column (or row) in order, the dead suspects the actor may remove. */
@Serializable
data class CollapseOption(val direction: CollapseDirection, val lines: List<List<SuspectId>>)

/**
 * The city: a rectangle of suspects stored row-major.
 *
 * Operations return a new board. Markers and tokens live on the [Tile], so they follow their suspect.
 *
 * @property removed suspects taken out by collapses, in removal order. They count as dead everywhere.
 */
@Serializable
data class Board(
    val rows: Int,
    val cols: Int,
    val cells: List<Tile>,
    val removed: List<SuspectId> = emptyList(),
) {
    init {
        require(rows >= 1 && cols >= 1 && cells.size == rows * cols) { "board must be a full ${rows}x$cols rectangle" }
        val ids = cells.map(Tile::id) + removed
        require(ids.size == ids.toSet().size) { "a suspect appears twice: $ids" }
    }

    val grid: Grid get() = Grid(rows, cols)

    val suspects: List<SuspectId> get() = cells.map(Tile::id)

    fun tileAt(p: Pos): Tile = cells[grid.index(p)]

    fun posOf(id: SuspectId): Pos? = cells.indexOfFirst { it.id == id }.takeIf { it >= 0 }?.let(grid::pos)

    fun requirePos(id: SuspectId): Pos = requireNotNull(posOf(id)) { "$id is not on the board" }

    fun tile(id: SuspectId): Tile? = posOf(id)?.let(::tileAt)

    fun isOnBoard(id: SuspectId): Boolean = posOf(id) != null

    /** Alive and on the board. Removed suspects count as dead. */
    fun isAlive(id: SuspectId): Boolean = tile(id)?.alive == true

    fun living(): List<SuspectId> = cells.filter(Tile::alive).map(Tile::id)

    fun neighbors(id: SuspectId): List<SuspectId> = ids(grid.neighbors(requirePos(id)))

    fun closedNeighbors(id: SuspectId): List<SuspectId> = ids(grid.closedNeighbors(requirePos(id)))

    fun orthogonalWithin(id: SuspectId, distance: Int): List<SuspectId> = ids(grid.orthogonalWithin(requirePos(id), distance))

    fun diagonalWithin(id: SuspectId, distance: Int): List<SuspectId> = ids(grid.diagonalWithin(requirePos(id), distance))

    fun inLine(line: Line): List<SuspectId> = ids(grid.positions(line))

    fun update(id: SuspectId, change: (Tile) -> Tile): Board {
        val index = grid.index(requirePos(id))
        val next = change(cells[index])
        require(next.id == id) { "a tile update must keep its suspect" }
        return copy(cells = cells.toMutableList().also { it[index] = next })
    }

    fun kill(id: SuspectId): Board = update(id, Tile::killed)

    fun exonerate(id: SuspectId): Board = update(id) {
        require(!it.exonerated) { "$id is already exonerated" }
        it.copy(exonerated = true)
    }

    fun arrest(id: SuspectId): Board = update(id) {
        require(it.alive && !it.arrested) { "only a living, free suspect can be arrested: $id" }
        it.copy(arrested = true)
    }

    fun setOfficer(id: SuspectId, officer: Officer?): Board = update(id) {
        require(it.alive || officer == null) { "officers stand on living suspects only: $id" }
        it.copy(officer = officer)
    }

    fun placeToken(id: SuspectId, kind: TokenKind): Board = update(id) { it.withToken(kind) }

    fun removeToken(id: SuspectId, kind: TokenKind): Board = update(id) { it.withoutToken(kind) }

    fun moveToken(kind: TokenKind, from: SuspectId, to: SuspectId): Board = removeToken(from, kind).placeToken(to, kind)

    fun tokenCount(kind: TokenKind): Int = cells.count { it.has(kind) }

    /** Two suspects trade places, taking their markers and tokens with them. */
    fun swap(a: SuspectId, b: SuspectId): Board {
        require(a != b) { "cannot swap $a with itself" }
        val ia = grid.index(requirePos(a))
        val ib = grid.index(requirePos(b))
        return copy(cells = cells.toMutableList().also { it[ia] = cells[ib]; it[ib] = cells[ia] })
    }

    /** A shift that leaves the line unchanged (e.g. any shift of a 1-cell line); always illegal. */
    fun isNoOp(move: ShiftMove): Boolean = Math.floorMod(move.by, grid.length(move.line)) == 0

    fun shift(move: ShiftMove): Board {
        require(!isNoOp(move)) { "$move changes nothing" }
        val positions = grid.positions(move.line)
        val next = cells.toMutableList()
        positions.forEachIndexed { i, p ->
            next[grid.index(positions[Math.floorMod(i + move.by, positions.size)])] = tileAt(p)
        }
        return copy(cells = next)
    }

    fun record(move: ShiftMove): ShiftRecord = ShiftRecord(move.line, move.by, grid.length(move.line))

    /** Every legal shift of up to [maxBy] cells, minus no-ops and the instant undo of [last]. */
    fun shiftMoves(maxBy: Int, last: ShiftRecord?): List<ShiftMove> {
        require(maxBy in 1..2) { "shifts move 1 or 2 cells: $maxBy" }
        val amounts = (1..maxBy).flatMap { listOf(-it, it) }.sorted()
        return grid.lines
            .flatMap { line -> amounts.map { ShiftMove(line, it) } }
            .filter { !isNoOp(it) && last?.forbids(it) != true }
    }

    /** Collapses available now, in [CollapseDirection] order. */
    fun collapseOptions(): List<CollapseOption> = CollapseDirection.entries.mapNotNull(::collapseOption)

    fun collapseOption(direction: CollapseDirection): CollapseOption? {
        val shrinking = if (direction == CollapseDirection.COLUMNS) rows else cols
        if (shrinking < 2) return null
        val lines = collapseLines(direction).map { line ->
            grid.positions(line).map(::tileAt).filterNot(Tile::alive).map(Tile::id)
        }
        return if (lines.all(List<SuspectId>::isNotEmpty)) CollapseOption(direction, lines) else null
    }

    /**
     * Removes [picks] (one dead suspect per column, or per row, in order) and closes the gaps.
     * Relative order is kept and the board stays a rectangle.
     */
    fun collapse(direction: CollapseDirection, picks: List<SuspectId>): Board {
        val option = requireNotNull(collapseOption(direction)) { "cannot collapse $direction" }
        require(picks.size == option.lines.size && picks.indices.all { picks[it] in option.lines[it] }) {
            "collapse needs one dead suspect from each line: $picks"
        }
        val kept = collapseLines(direction).mapIndexed { i, line ->
            grid.positions(line).map(::tileAt).filter { it.id != picks[i] }
        }
        return if (direction == CollapseDirection.COLUMNS) {
            Board(rows - 1, cols, (0..<rows - 1).flatMap { r -> kept.map { column -> column[r] } }, removed + picks)
        } else {
            Board(rows, cols - 1, kept.flatten(), removed + picks)
        }
    }

    private fun collapseLines(direction: CollapseDirection): List<Line> =
        if (direction == CollapseDirection.COLUMNS) {
            (0..<cols).map { Line(Axis.COLUMN, it) }
        } else {
            (0..<rows).map { Line(Axis.ROW, it) }
        }

    private fun ids(positions: List<Pos>): List<SuspectId> = positions.map { tileAt(it).id }

    companion object {
        /** A fresh city of living suspects, filled row-major. */
        fun of(rows: Int, cols: Int, suspects: List<SuspectId>): Board = Board(rows, cols, suspects.map(::Tile))
    }
}
