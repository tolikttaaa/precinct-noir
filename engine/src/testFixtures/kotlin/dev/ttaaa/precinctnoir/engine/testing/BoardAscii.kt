package dev.ttaaa.precinctnoir.engine.testing

import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.Officer
import dev.ttaaa.precinctnoir.engine.core.board.Tile
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId

/**
 * A compact text form of a city for tests: rows of whitespace-separated cells, each a suspect id
 * followed by optional flags in this order:
 *
 * `x` dead · `+` exonerated · `a` arrested · `o` officer · `s` stunned officer ·
 * `T` treasure · `P` protection · `H` threat · `B` bomb
 *
 * ```
 *  0  1x  2
 *  3+ 4   5xo   <- invalid: dead suspects can't hold an officer
 * ```
 */
object BoardAscii {
    private const val FLAGS = "x+aosTPHB"
    private val TOKENS = mapOf('T' to TokenKind.TREASURE, 'P' to TokenKind.PROTECTION, 'H' to TokenKind.THREAT, 'B' to TokenKind.BOMB)

    fun parse(text: String, removed: List<Int> = emptyList()): Board {
        val rows = text.trim().lines().map(String::trim).filter(String::isNotEmpty).map { it.split(Regex("\\s+")) }
        require(rows.isNotEmpty() && rows.all { it.size == rows[0].size }) { "rows must have equal length:\n$text" }
        return Board(rows.size, rows[0].size, rows.flatten().map(::parseCell), removed.map(::SuspectId))
    }

    fun parseCell(cell: String): Tile {
        val digits = cell.takeWhile(Char::isDigit)
        val flags = cell.drop(digits.length)
        require(digits.isNotEmpty() && flags.all { it in FLAGS }) { "bad cell '$cell'" }
        return Tile(
            id = SuspectId(digits.toInt()),
            alive = 'x' !in flags,
            exonerated = '+' in flags,
            arrested = 'a' in flags,
            officer = when {
                's' in flags -> Officer(stunned = true)
                'o' in flags -> Officer()
                else -> null
            },
            tokens = flags.mapNotNull(TOKENS::get).sorted(),
        )
    }

    fun render(board: Board): String = board.cells.chunked(board.cols).joinToString("\n") { row ->
        row.joinToString(" ") { renderCell(it) }
    }

    fun renderCell(tile: Tile): String = buildString {
        append(tile.id.value)
        if (!tile.alive) append('x')
        if (tile.exonerated) append('+')
        if (tile.arrested) append('a')
        tile.officer?.let { append(if (it.stunned) 's' else 'o') }
        TOKENS.forEach { (flag, kind) -> if (tile.has(kind)) append(flag) }
    }
}
