package dev.ttaaa.precinctnoir.server.room

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
enum class RoomStatus {
    @SerialName("lobby")
    LOBBY,

    @SerialName("in_game")
    IN_GAME,

    @SerialName("finished")
    FINISHED,
}

/** How the last round ended. */
@Serializable
enum class ResultKind {
    /** By the rules; the outcome says who won. */
    @SerialName("finished")
    FINISHED,

    @SerialName("ended_by_host")
    ENDED_BY_HOST,

    /** Nobody acted for the game idle TTL. */
    @SerialName("idle_timeout")
    IDLE_TIMEOUT,

    /** The saved game couldn't be restored after an update (no migration for its schema). */
    @SerialName("restore_failed")
    RESTORE_FAILED,
}

/** A player in the room. Ids grow in join order, so the lowest id is the VIP and seats go by id. */
@Serializable
data class Member(val id: Int, val name: String, val tokenHash: String, val lastClientSeq: Long = 0)

/**
 * The game being played (or just finished).
 *
 * @property seats member ids by seat index.
 * @property decisionSince when the current decision opened (epoch ms), for the turn timer.
 */
@Serializable
data class GameRecord(val mode: String, val schemaVersion: Int, val seed: Long, val seats: List<Int>, val decisionSince: Long)

@Serializable
data class RoundResult(val round: Int, val kind: ResultKind, val outcome: Outcome? = null)

/** Server-only config for the next game if the same members take the same seats in the same mode. */
@Serializable
data class Rematch(val mode: String, val seats: List<Int>, val config: JsonObject)

/**
 * Everything about a room except the engine state. Persisted after every change.
 *
 * Times are epoch milliseconds. [version] grows with every persisted change and is sent to clients.
 */
@Serializable
data class RoomSnapshot(
    val code: String,
    val status: RoomStatus,
    val createdAt: Long,
    val lastActivity: Long,
    val hostTokenHash: String,
    val hostClientSeq: Long = 0,
    val members: List<Member> = emptyList(),
    val nextMemberId: Int = 1,
    val mode: String,
    val config: JsonObject,
    val turnTimer: Int? = null,
    val round: Int = 0,
    val game: GameRecord? = null,
    val nextEventSeq: Long = 1,
    val lastResult: RoundResult? = null,
    val rematch: Rematch? = null,
    val version: Long = 1,
) {
    /** The VIP: the earliest player still in the room. */
    val vip: Int? get() = members.firstOrNull()?.id
}

/** A game event with its room-wide sequence number and audience. */
@Serializable
data class StoredEvent(val seq: Long, val audience: Audience, val event: JsonElement)

/** The persisted form of a room: the snapshot plus the engine's own JSON for the game, if any. */
@Serializable
data class PersistedRoom(val room: RoomSnapshot, val gameState: JsonObject? = null)

/** An accepted game command, kept append-only for audit and replay. */
data class CommandRecord(val round: Int, val actionSeq: Long, val command: JsonElement)

/** Changes to the stored case log that go with a save. */
data class EventWrite(val reset: Boolean, val append: List<StoredEvent>) {
    companion object {
        val NONE = EventWrite(reset = false, append = emptyList())
        val RESET = EventWrite(reset = true, append = emptyList())
    }
}

data class LoadedRoom(val room: PersistedRoom, val events: List<StoredEvent>)

/** Storage for live rooms. Every [save] is one transaction. */
interface RoomRepository {
    fun loadAll(): List<LoadedRoom>

    fun save(room: PersistedRoom, actionSeq: Long, events: EventWrite = EventWrite.NONE, command: CommandRecord? = null)

    fun delete(code: String)
}
