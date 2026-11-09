package dev.ttaaa.precinctnoir.server.protocol

import dev.ttaaa.precinctnoir.engine.core.api.ConfigSpec
import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.server.room.RoomStatus
import dev.ttaaa.precinctnoir.server.room.RoundResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * The wire protocol (see docs/PROTOCOL.md). These types are the source of truth for
 * `web/src/protocol/generated.ts`; regenerate it with `./gradlew :server:generateProtocol`.
 */
val ProtocolJson: Json = EngineJson

const val PROTOCOL_VERSION = 1

/** Messages a browser sends over `/ws`. The first one must be [Hello]. */
@Serializable
sealed interface ClientMessage {
    /** Authenticates the socket. [lastEventSeq] is the last case-log event the client has, to resume after a reconnect. */
    @Serializable
    @SerialName("hello")
    data class Hello(val room: String, val token: String, val lastEventSeq: Long? = null) : ClientMessage

    /**
     * Everything after the hello. [clientSeq] must grow per sender; a repeat (e.g. resent after a
     * reconnect) is acknowledged without running again.
     */
    @Serializable
    sealed interface RoomCommand : ClientMessage {
        val clientSeq: Long
    }

    /** Answers the pending decision. */
    @Serializable
    @SerialName("act")
    data class Act(override val clientSeq: Long, val decisionId: Int, val choice: Choice) : RoomCommand

    @Serializable
    @SerialName("set_mode")
    data class SetMode(override val clientSeq: Long, val mode: String) : RoomCommand

    /** Replaces the lobby's variant switches; keys must come from the mode's config spec. */
    @Serializable
    @SerialName("set_config")
    data class SetConfig(override val clientSeq: Long, val config: JsonObject) : RoomCommand

    /** Turn timer in seconds (60, 90 or 120), or `null` for off. It only nudges. */
    @Serializable
    @SerialName("set_timer")
    data class SetTimer(override val clientSeq: Long, val seconds: Int? = null) : RoomCommand

    /**
     * Shows page [page] of the mode's "How to play" walkthrough on the board, or hides it (`null`).
     * Lobby only; the client owns the pages, the server only checks the range.
     */
    @Serializable
    @SerialName("show_guide")
    data class ShowGuide(override val clientSeq: Long, val page: Int? = null) : RoomCommand

    @Serializable
    @SerialName("kick")
    data class Kick(override val clientSeq: Long, val playerId: Int) : RoomCommand

    @Serializable
    @SerialName("leave")
    data class Leave(override val clientSeq: Long) : RoomCommand

    @Serializable
    @SerialName("start")
    data class Start(override val clientSeq: Long) : RoomCommand

    @Serializable
    @SerialName("end_game")
    data class EndGame(override val clientSeq: Long) : RoomCommand

    @Serializable
    @SerialName("play_again")
    data class PlayAgain(override val clientSeq: Long) : RoomCommand
}

@Serializable
enum class Role {
    @SerialName("host")
    HOST,

    @SerialName("player")
    PLAYER,
}

@Serializable
data class You(val role: Role, val playerId: Int? = null)

@Serializable
data class MemberView(val id: Int, val name: String, val connected: Boolean)

/** The room as everyone sees it. Never contains tokens. */
@Serializable
data class RoomView(
    val code: String,
    val status: RoomStatus,
    val version: Long,
    val round: Int,
    val vip: Int?,
    val members: List<MemberView>,
    val hostConnected: Boolean,
    val mode: String,
    val config: JsonObject,
    val turnTimer: Int?,
    val seats: List<Int>,
    val lastResult: RoundResult?,
    /** The walkthrough page the board shows, or `null` when it's hidden. */
    val guide: Int? = null,
)

@Serializable
data class EventView(val seq: Long, val event: JsonElement)

/** Why a command was refused. Deliberately coarse, like the engine's own rejections. */
@Serializable
enum class Refusal {
    @SerialName("not_vip")
    NOT_VIP,

    @SerialName("not_a_player")
    NOT_A_PLAYER,

    @SerialName("wrong_status")
    WRONG_STATUS,

    @SerialName("unknown_mode")
    UNKNOWN_MODE,

    @SerialName("invalid_config")
    INVALID_CONFIG,

    @SerialName("invalid_timer")
    INVALID_TIMER,

    @SerialName("invalid_target")
    INVALID_TARGET,

    @SerialName("not_enough_players")
    NOT_ENOUGH_PLAYERS,

    @SerialName("game_over")
    GAME_OVER,

    @SerialName("not_your_decision")
    NOT_YOUR_DECISION,

    @SerialName("stale_decision")
    STALE_DECISION,

    @SerialName("illegal_input")
    ILLEGAL_INPUT,

    @SerialName("malformed")
    MALFORMED,
    ;

    companion object {
        fun of(rejection: Rejection): Refusal = when (rejection) {
            Rejection.GAME_OVER -> GAME_OVER
            Rejection.NOT_YOUR_DECISION -> NOT_YOUR_DECISION
            Rejection.STALE_DECISION -> STALE_DECISION
            Rejection.ILLEGAL_INPUT -> ILLEGAL_INPUT
            Rejection.MALFORMED -> MALFORMED
        }
    }
}

@Serializable
enum class ProtocolError {
    @SerialName("malformed")
    MALFORMED,

    @SerialName("already_authenticated")
    ALREADY_AUTHENTICATED,

    @SerialName("server_error")
    SERVER_ERROR,
}

/** Messages the server sends over `/ws`. */
@Serializable
sealed interface ServerMessage {
    @Serializable
    @SerialName("welcome")
    data class Welcome(val you: You, val protocol: Int = PROTOCOL_VERSION) : ServerMessage

    /** The room changed (or someone connected/disconnected). */
    @Serializable
    @SerialName("room")
    data class Room(val room: RoomView) : ServerMessage

    /** Your projection of the game in [mode] and what you may do now. [seat] is `null` for the TV and spectators. */
    @Serializable
    @SerialName("game")
    data class Game(val round: Int, val mode: String, val seat: Int? = null, val view: JsonElement, val legal: List<Opt>) :
        ServerMessage

    /** New case-log events you may see, in order. */
    @Serializable
    @SerialName("events")
    data class Events(val round: Int, val events: List<EventView>) : ServerMessage

    /** The turn timer ran out for the pending decision. Changes nothing. */
    @Serializable
    @SerialName("nudge")
    data class Nudge(val event: JsonElement) : ServerMessage

    @Serializable
    @SerialName("ack")
    data class Ack(val clientSeq: Long) : ServerMessage

    @Serializable
    @SerialName("rejected")
    data class Rejected(val clientSeq: Long, val reason: Refusal) : ServerMessage

    @Serializable
    @SerialName("error")
    data class Error(val code: ProtocolError) : ServerMessage

    /** Sent just before the server closes the socket. */
    @Serializable
    @SerialName("closing")
    data class Closing(val reason: CloseReason) : ServerMessage
}

@Serializable
enum class CloseReason(val code: Int) {
    @SerialName("bad_token")
    BAD_TOKEN(4001),

    @SerialName("auth_timeout")
    AUTH_TIMEOUT(4002),

    @SerialName("kicked")
    KICKED(4003),

    @SerialName("room_closed")
    ROOM_CLOSED(4004),

    @SerialName("hello_required")
    HELLO_REQUIRED(4005),

    @SerialName("left")
    LEFT(1000),

    /** Server restart or deploy: reconnect with backoff. */
    @SerialName("restarting")
    RESTARTING(1012),
}

// --- HTTP API (/api) ---

/**
 * [turnstileToken] comes from the Turnstile widget on the TV (docs/SECURITY.md). [mode] is the game the host
 * picked on the home screen; without it the room starts in the first mode. The VIP can change it in the lobby.
 */
@Serializable
data class CreateRoomRequest(val turnstileToken: String, val mode: String? = null)

@Serializable
data class CreateRoomResponse(val code: String, val hostToken: String)

@Serializable
data class JoinRequest(val name: String)

@Serializable
data class JoinResponse(val playerId: Int, val playerToken: String)

@Serializable
data class RoomSummary(val code: String, val status: RoomStatus, val players: Int, val maxPlayers: Int, val mode: String)

@Serializable
data class ModeInfo(val id: String, val minPlayers: Int, val maxPlayers: Int, val config: ConfigSpec)

@Serializable
data class ApiError(val error: String)

/**
 * Public settings the web client needs at startup.
 *
 * @property version the release that is running, like `0.1.0`; absent between releases (a development build).
 * @property commit the full commit hash of the running build, when known.
 */
@Serializable
data class ClientConfig(val turnstileSiteKey: String? = null, val version: String? = null, val commit: String? = null)
