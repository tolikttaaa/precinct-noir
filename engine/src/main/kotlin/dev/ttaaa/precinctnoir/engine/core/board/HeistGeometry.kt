package dev.ttaaa.precinctnoir.engine.core.board

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** The four corner vaults of a Casino Heist city. */
@Serializable
enum class Quadrant {
    @SerialName("nw")
    NW,

    @SerialName("ne")
    NE,

    @SerialName("sw")
    SW,

    @SerialName("se")
    SE,
}

/**
 * Casino Heist zones on an odd square city (7×7 in play).
 *
 * Each corner block of `n/2 × n/2` cells is a vault zone (`HX-1`). The middle row and column
 * ("the cross") belong to no zone, and the exact centre is special.
 */
object HeistGeometry {
    fun centre(grid: Grid): Pos = mid(grid).let { Pos(it, it) }

    fun isCross(grid: Grid, p: Pos): Boolean = quadrantOf(grid, p) == null

    fun isCentre(grid: Grid, p: Pos): Boolean = p == centre(grid)

    /** The vault zone containing [p], or `null` on the cross. */
    fun quadrantOf(grid: Grid, p: Pos): Quadrant? {
        val m = mid(grid)
        require(p in grid) { "$p is outside the city" }
        return when {
            p.row == m || p.col == m -> null
            p.row < m && p.col < m -> Quadrant.NW
            p.row < m -> Quadrant.NE
            p.col < m -> Quadrant.SW
            else -> Quadrant.SE
        }
    }

    fun zone(grid: Grid, quadrant: Quadrant): List<Pos> = grid.positions.filter { quadrantOf(grid, it) == quadrant }

    /** Zones next to [p] (8-neighbourhood). From the centre that's every zone. */
    fun quadrantsTouching(grid: Grid, p: Pos): List<Quadrant> =
        grid.neighbors(p).mapNotNull { quadrantOf(grid, it) }.distinct().sorted()

    private fun mid(grid: Grid): Int {
        require(grid.rows == grid.cols && grid.rows % 2 == 1 && grid.rows >= 3) {
            "heist zones need an odd square city, got ${grid.rows}x${grid.cols}"
        }
        return grid.rows / 2
    }
}
