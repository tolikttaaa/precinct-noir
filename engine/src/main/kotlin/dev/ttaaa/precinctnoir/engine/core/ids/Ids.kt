package dev.ttaaa.precinctnoir.engine.core.ids

import kotlinx.serialization.Serializable

/** The original character roster in `shared/roster.json`. Suspect ids are `0 until SIZE`. */
object Roster {
    const val SIZE = 60
}

/** A character from the roster. Its evidence card shares the id. */
@Serializable
@JvmInline
value class SuspectId(val value: Int) : Comparable<SuspectId> {
    init {
        require(value in 0..<Roster.SIZE) { "suspect id out of range: $value" }
    }

    override fun compareTo(other: SuspectId): Int = value.compareTo(other.value)

    override fun toString(): String = "S$value"
}

/** A player's place at the table, `0 until players`. */
@Serializable
@JvmInline
value class Seat(val index: Int) {
    init {
        require(index >= 0) { "seat must be non-negative: $index" }
    }

    override fun toString(): String = "Seat$index"
}
