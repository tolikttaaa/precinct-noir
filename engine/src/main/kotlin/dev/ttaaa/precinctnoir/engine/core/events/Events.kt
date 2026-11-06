package dev.ttaaa.precinctnoir.engine.core.events

import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Who may see an event. Public events have the same shape whatever the hidden values are. */
@Serializable
sealed interface Audience {
    @Serializable
    @SerialName("public")
    data object Public : Audience

    @Serializable
    @SerialName("player")
    data class ToPlayer(val seat: Seat) : Audience

    @Serializable
    @SerialName("team")
    data class ToTeam(val team: Int) : Audience

    /** Spectators see public events only. [teamOf] maps a seat to its team, if the mode has teams. */
    fun visibleTo(viewer: Viewer, teamOf: (Seat) -> Int?): Boolean = when (this) {
        Public -> true
        is ToPlayer -> viewer is Viewer.Player && viewer.seat == seat
        is ToTeam -> viewer is Viewer.Player && teamOf(viewer.seat) == team
    }
}

/** The [n]th event produced by command number [actionSeq] (0 = setup). */
@Serializable
data class EventRecord<E>(val actionSeq: Long, val n: Int, val audience: Audience, val event: E)
