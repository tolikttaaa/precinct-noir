package dev.ttaaa.precinctnoir.server.testing

import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.room.CommandRecord
import dev.ttaaa.precinctnoir.server.room.Connection
import dev.ttaaa.precinctnoir.server.room.EventWrite
import dev.ttaaa.precinctnoir.server.room.LoadedRoom
import dev.ttaaa.precinctnoir.server.room.PersistedRoom
import dev.ttaaa.precinctnoir.server.room.Randomness
import dev.ttaaa.precinctnoir.server.room.RoomRepository
import dev.ttaaa.precinctnoir.server.room.StoredEvent
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Random

/** Records what the server sends; closing stops further delivery, like a real socket. */
class FakeConnection(override val id: String) : Connection {
    val sent = mutableListOf<ServerMessage>()
    var closedWith: CloseReason? = null

    override fun send(message: ServerMessage) {
        if (closedWith == null) sent += message
    }

    override fun close(reason: CloseReason) {
        if (closedWith == null) closedWith = reason
    }

    inline fun <reified T : ServerMessage> all(): List<T> = sent.filterIsInstance<T>()

    inline fun <reified T : ServerMessage> last(): T = all<T>().last()
}

/** In-memory [RoomRepository] that can be told to fail once. */
class FakeRepository : RoomRepository {
    val rooms = linkedMapOf<String, PersistedRoom>()
    val events = mutableMapOf<String, MutableList<StoredEvent>>()
    val commands = mutableListOf<Pair<String, CommandRecord>>()
    val actionSeqs = mutableMapOf<String, Long>()
    var saves = 0
    var failNextSave = false

    override fun loadAll(): List<LoadedRoom> = rooms.values.map { LoadedRoom(it, events[it.room.code].orEmpty().toList()) }

    override fun save(room: PersistedRoom, actionSeq: Long, events: EventWrite, command: CommandRecord?) {
        if (failNextSave) {
            failNextSave = false
            throw IllegalStateException("database unavailable")
        }
        saves++
        val code = room.room.code
        rooms[code] = room
        actionSeqs[code] = actionSeq
        val log = this.events.getOrPut(code) { mutableListOf() }
        if (events.reset) log.clear()
        log += events.append
        command?.let { commands += code to it }
    }

    override fun delete(code: String) {
        rooms.remove(code)
        events.remove(code)
    }
}

class MutableClock(var millis: Long = 1_800_000_000_000) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId?): Clock = this

    override fun instant(): Instant = Instant.ofEpochMilli(millis)

    fun advance(duration: Duration) {
        millis += duration.toMillis()
    }
}

class SeededRandomness(seed: Long) : Randomness {
    private val random = Random(seed)

    override fun nextInt(bound: Int): Int = random.nextInt(bound)

    override fun nextLong(): Long = random.nextLong()

    override fun nextBytes(count: Int): ByteArray = ByteArray(count).also(random::nextBytes)
}

/** Always the same values: every room code collides. */
object ConstantRandomness : Randomness {
    override fun nextInt(bound: Int): Int = 0

    override fun nextLong(): Long = 42

    override fun nextBytes(count: Int): ByteArray = ByteArray(count)
}
