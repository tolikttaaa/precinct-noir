package dev.ttaaa.precinctnoir.engine.core.view

import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.Officer
import dev.ttaaa.precinctnoir.engine.core.board.Tile
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Who a projection is for: a seated player, or the shared screen / anyone else. */
@Serializable
sealed interface Viewer {
    @Serializable
    @SerialName("spectator")
    data object Spectator : Viewer

    @Serializable
    @SerialName("player")
    data class Player(val seat: Seat) : Viewer
}

/** Public tile state, copied field by field (whitelist) so new hidden tile data can't leak by default. */
@Serializable
data class TileView(
    val id: SuspectId,
    val alive: Boolean,
    val exonerated: Boolean,
    val arrested: Boolean,
    val officer: Officer?,
    val tokens: List<TokenKind>,
)

@Serializable
data class BoardView(val rows: Int, val cols: Int, val tiles: List<TileView>, val removed: List<SuspectId>) {
    /** Rebuilds a [Board] so legal-move code can run on exactly what the viewer sees. */
    fun toBoard(): Board = Board(
        rows,
        cols,
        tiles.map { Tile(it.id, it.alive, it.exonerated, it.arrested, it.officer, it.tokens) },
        removed,
    )

    companion object {
        fun of(board: Board): BoardView = BoardView(
            board.rows,
            board.cols,
            board.cells.map { TileView(it.id, it.alive, it.exonerated, it.arrested, it.officer, it.tokens) },
            board.removed,
        )
    }
}

/** The public label of the pending decision: everyone may see who is deciding what. */
@Serializable
data class PendingView(val id: Int, val actor: Seat, val kind: PendingKind, val prompt: String) {
    companion object {
        fun of(pending: Pending): PendingView = PendingView(pending.id, pending.actor, pending.kind, pending.prompt)
    }
}
