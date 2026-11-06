package dev.ttaaa.precinctnoir.engine.core.legal

import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.CollapseOption
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.board.Pos
import dev.ttaaa.precinctnoir.engine.core.board.Quadrant
import dev.ttaaa.precinctnoir.engine.core.board.ShiftMove
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Action names shared by every mode. */
object CommonActions {
    const val SHIFT = "shift"
    const val COLLAPSE = "collapse"
    const val STOP_COLLAPSING = "stop_collapsing"
}

/** Two suspects, unordered. Stored with the smaller id first. */
@Serializable
data class SuspectPair(val a: SuspectId, val b: SuspectId) {
    init {
        require(a < b) { "pair must be distinct and ordered: $a, $b" }
    }

    companion object {
        fun of(x: SuspectId, y: SuspectId): SuspectPair = if (x < y) SuspectPair(x, y) else SuspectPair(y, x)
    }
}

@Serializable
data class TokenMove(val kind: TokenKind, val from: SuspectId, val to: SuspectId)

/**
 * One legal action and the shape of its parameters. The UI renders options generically and replies
 * with the matching [Choice]. Every [action] name appears at most once in a menu.
 */
@Serializable
sealed interface Opt {
    val action: String

    fun accepts(choice: Choice): Boolean
}

@Serializable
@SerialName("simple")
data class SimpleOpt(override val action: String) : Opt {
    override fun accepts(choice: Choice): Boolean = choice is SimpleChoice && choice.action == action
}

@Serializable
@SerialName("shift")
data class ShiftOpt(override val action: String, val moves: List<ShiftMove>) : Opt {
    override fun accepts(choice: Choice): Boolean =
        choice is ShiftChoice && choice.action == action && ShiftMove(choice.line, choice.by) in moves
}

@Serializable
@SerialName("collapse")
data class CollapseOpt(override val action: String, val options: List<CollapseOption>) : Opt {
    override fun accepts(choice: Choice): Boolean {
        if (choice !is CollapseChoice || choice.action != action) return false
        val lines = options.firstOrNull { it.direction == choice.direction }?.lines ?: return false
        return choice.picks.size == lines.size && choice.picks.indices.all { choice.picks[it] in lines[it] }
    }
}

@Serializable
@SerialName("target")
data class TargetOpt(override val action: String, val targets: List<SuspectId>) : Opt {
    override fun accepts(choice: Choice): Boolean = choice is TargetChoice && choice.action == action && choice.target in targets
}

@Serializable
@SerialName("pair")
data class PairOpt(override val action: String, val pairs: List<SuspectPair>) : Opt {
    override fun accepts(choice: Choice): Boolean =
        choice is PairChoice && choice.action == action && choice.a != choice.b && SuspectPair.of(choice.a, choice.b) in pairs
}

@Serializable
@SerialName("pick")
data class PickOpt(override val action: String, val cards: List<SuspectId>, val min: Int, val max: Int) : Opt {
    init {
        require(min in 0..max) { "invalid pick range $min..$max" }
    }

    override fun accepts(choice: Choice): Boolean =
        choice is PickChoice && choice.action == action &&
            choice.cards.size in min..max && choice.cards.toSet().size == choice.cards.size && cards.containsAll(choice.cards)
}

@Serializable
@SerialName("token_move")
data class TokenMoveOpt(override val action: String, val moves: List<TokenMove>) : Opt {
    override fun accepts(choice: Choice): Boolean =
        choice is TokenMoveChoice && choice.action == action && TokenMove(choice.kind, choice.from, choice.to) in moves
}

@Serializable
@SerialName("square")
data class SquareOpt(override val action: String, val size: Int, val corners: List<Pos>) : Opt {
    override fun accepts(choice: Choice): Boolean = choice is SquareChoice && choice.action == action && choice.corner in corners
}

@Serializable
@SerialName("vault")
data class VaultOpt(override val action: String, val vaults: List<Quadrant>) : Opt {
    override fun accepts(choice: Choice): Boolean = choice is VaultChoice && choice.action == action && choice.vault in vaults
}

/** A player's reply to the pending decision. */
@Serializable
sealed interface Choice {
    val action: String
}

@Serializable
@SerialName("simple")
data class SimpleChoice(override val action: String) : Choice

@Serializable
@SerialName("shift")
data class ShiftChoice(override val action: String, val line: Line, val by: Int) : Choice

@Serializable
@SerialName("collapse")
data class CollapseChoice(override val action: String, val direction: CollapseDirection, val picks: List<SuspectId>) : Choice

@Serializable
@SerialName("target")
data class TargetChoice(override val action: String, val target: SuspectId) : Choice

@Serializable
@SerialName("pair")
data class PairChoice(override val action: String, val a: SuspectId, val b: SuspectId) : Choice

@Serializable
@SerialName("pick")
data class PickChoice(override val action: String, val cards: List<SuspectId>) : Choice

@Serializable
@SerialName("token_move")
data class TokenMoveChoice(override val action: String, val kind: TokenKind, val from: SuspectId, val to: SuspectId) : Choice

@Serializable
@SerialName("square")
data class SquareChoice(override val action: String, val corner: Pos) : Choice

@Serializable
@SerialName("vault")
data class VaultChoice(override val action: String, val vault: Quadrant) : Choice
