package dev.ttaaa.precinctnoir.engine.core.board

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** A cell of the city. Ordered row-major ("reading order"). */
@Serializable
data class Pos(val row: Int, val col: Int) : Comparable<Pos> {
    override fun compareTo(other: Pos): Int = compareValuesBy(this, other, Pos::row, Pos::col)
}

@Serializable
enum class Axis {
    @SerialName("row")
    ROW,

    @SerialName("col")
    COLUMN,
}

/** A whole row or column. */
@Serializable
data class Line(val axis: Axis, val index: Int)

/**
 * Dimensions of a rectangular city, plus pure geometry on it.
 *
 * Nothing wraps around the edges, and every list comes back in row-major order.
 */
data class Grid(val rows: Int, val cols: Int) {
    init {
        require(rows >= 1 && cols >= 1) { "grid must be at least 1x1: ${rows}x$cols" }
    }

    val size: Int get() = rows * cols

    val positions: List<Pos> get() = (0..<rows).flatMap { r -> (0..<cols).map { c -> Pos(r, c) } }

    /** All rows, then all columns. */
    val lines: List<Line> get() = (0..<rows).map { Line(Axis.ROW, it) } + (0..<cols).map { Line(Axis.COLUMN, it) }

    operator fun contains(p: Pos): Boolean = p.row in 0..<rows && p.col in 0..<cols

    operator fun contains(line: Line): Boolean = line.index in 0..<count(line.axis)

    fun index(p: Pos): Int {
        require(p in this) { "$p is outside ${rows}x$cols" }
        return p.row * cols + p.col
    }

    fun pos(index: Int): Pos {
        require(index in 0..<size) { "index $index is outside ${rows}x$cols" }
        return Pos(index / cols, index % cols)
    }

    /** Number of cells in [line]. */
    fun length(line: Line): Int {
        require(line in this) { "$line is outside ${rows}x$cols" }
        return if (line.axis == Axis.ROW) cols else rows
    }

    /** Cells of [line], from index 0 upwards. */
    fun positions(line: Line): List<Pos> {
        require(line in this) { "$line is outside ${rows}x$cols" }
        return if (line.axis == Axis.ROW) {
            (0..<cols).map { Pos(line.index, it) }
        } else {
            (0..<rows).map { Pos(it, line.index) }
        }
    }

    /** `N(p)`: the up to 8 cells touching [p]; [p] itself is excluded. */
    fun neighbors(p: Pos): List<Pos> = around(p, 1) { dr, dc -> max(abs(dr), abs(dc)) == 1 }

    /** `N[p]`: [p] together with its neighbours. */
    fun closedNeighbors(p: Pos): List<Pos> = around(p, 1) { _, _ -> true }

    /** Cells 1..[distance] away in the same row or column. */
    fun orthogonalWithin(p: Pos, distance: Int): List<Pos> = around(p, distance) { dr, dc -> (dr == 0) != (dc == 0) }

    /** Cells 1..[distance] away on the two diagonals through [p]. */
    fun diagonalWithin(p: Pos, distance: Int): List<Pos> = around(p, distance) { dr, dc -> dr != 0 && abs(dr) == abs(dc) }

    /** Top-left corners of every [size]×[size] square that fits. */
    fun squareCorners(size: Int): List<Pos> {
        require(size >= 1) { "square size must be positive: $size" }
        if (size > rows || size > cols) return emptyList()
        return (0..rows - size).flatMap { r -> (0..cols - size).map { c -> Pos(r, c) } }
    }

    /** Cells of the [size]×[size] square whose top-left corner is [corner]. */
    fun square(corner: Pos, size: Int): List<Pos> {
        require(corner in squareCorners(size)) { "no ${size}x$size square at $corner in ${rows}x$cols" }
        return (corner.row..<corner.row + size).flatMap { r -> (corner.col..<corner.col + size).map { c -> Pos(r, c) } }
    }

    fun count(axis: Axis): Int = if (axis == Axis.ROW) rows else cols

    private inline fun around(p: Pos, radius: Int, keep: (dr: Int, dc: Int) -> Boolean): List<Pos> {
        require(p in this) { "$p is outside ${rows}x$cols" }
        require(radius >= 1) { "radius must be positive: $radius" }
        val out = ArrayList<Pos>()
        for (r in max(0, p.row - radius)..min(rows - 1, p.row + radius)) {
            for (c in max(0, p.col - radius)..min(cols - 1, p.col + radius)) {
                if (keep(r - p.row, c - p.col)) out += Pos(r, c)
            }
        }
        return out
    }
}
