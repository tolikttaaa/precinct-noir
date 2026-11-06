package dev.ttaaa.precinctnoir.server.room

import dev.ttaaa.precinctnoir.engine.ModeRegistry
import dev.ttaaa.precinctnoir.engine.core.api.AnyEvent
import dev.ttaaa.precinctnoir.engine.core.api.AnyGame
import dev.ttaaa.precinctnoir.engine.core.api.AnyMode
import dev.ttaaa.precinctnoir.engine.core.api.AnyResult
import dev.ttaaa.precinctnoir.engine.core.api.Command
import dev.ttaaa.precinctnoir.engine.core.api.ConfigOption
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.server.config.RoomLimits
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage
import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.EventView
import dev.ttaaa.precinctnoir.server.protocol.MemberView
import dev.ttaaa.precinctnoir.server.protocol.ModeInfo
import dev.ttaaa.precinctnoir.server.protocol.ProtocolError
import dev.ttaaa.precinctnoir.server.protocol.Refusal
import dev.ttaaa.precinctnoir.server.protocol.Role
import dev.ttaaa.precinctnoir.server.protocol.RoomSummary
import dev.ttaaa.precinctnoir.server.protocol.RoomView
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.protocol.You
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import org.slf4j.LoggerFactory
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** One socket, as the room service sees it. Implementations must tolerate calls after close. */
interface Connection {
    val id: String

    fun send(message: ServerMessage)

    fun close(reason: CloseReason)
}

/** A thrown HTTP error with an i18n code, e.g. `409 name_taken`. */
class ApiException(val status: Int, val code: String) : RuntimeException(code)

data class CreatedRoom(val code: String, val hostToken: String)

data class JoinedRoom(val playerId: Int, val playerToken: String)

/** Who is behind a socket. */
sealed interface Principal {
    data object Host : Principal

    data class Player(val id: Int) : Principal
}

/** A live room. Every field is read and written only while holding [lock]. */
class Room internal constructor(var snap: RoomSnapshot, var game: AnyGame?, var events: List<StoredEvent>) {
    val lock = ReentrantLock()
    internal val connections = LinkedHashMap<String, Attached>()
    internal var nudged: Int? = null
    internal var closed = false
}

internal class Attached(val connection: Connection, val principal: Principal)

private class Binding(val room: Room, val principal: Principal)

/**
 * Rooms, lobbies and the game loop. Each room acts like an actor: every change runs under the room's
 * lock as validate → engine → persist → fan out, so clients only ever see persisted state.
 */
class RoomService(
    private val repository: RoomRepository,
    private val clock: Clock,
    private val random: Randomness,
    private val limits: RoomLimits,
    private val modes: List<AnyMode> = ModeRegistry.modes,
) {
    private val log = LoggerFactory.getLogger(RoomService::class.java)
    private val rooms = ConcurrentHashMap<String, Room>()
    private val bindings = ConcurrentHashMap<String, Binding>()
    private val createLock = ReentrantLock()

    /** False once shutdown has begun: new rooms, joins and sockets are refused. */
    @Volatile
    var accepting = true
        private set

    val roomCount: Int get() = rooms.size

    // --- HTTP ---

    fun create(): CreatedRoom {
        requireAccepting()
        createLock.withLock {
            if (rooms.size >= limits.maxRooms) throw ApiException(503, "capacity")
            val code = generateSequence { RoomCodes.generate(random) }.take(CODE_ATTEMPTS).firstOrNull { !rooms.containsKey(it) }
                ?: throw ApiException(503, "capacity")
            val hostToken = Tokens.create(random)
            val mode = modes.first()
            val now = clock.millis()
            val snap = RoomSnapshot(code, RoomStatus.LOBBY, now, now, Tokens.hash(hostToken), mode = mode.id, config = defaults(mode))
            repository.save(PersistedRoom(snap), 0)
            rooms[code] = Room(snap, null, emptyList())
            return CreatedRoom(code, hostToken)
        }
    }

    fun join(code: String, rawName: String): JoinedRoom {
        requireAccepting()
        val room = find(code) ?: throw notFound()
        room.lock.withLock {
            if (room.closed) throw notFound()
            val snap = room.snap
            if (snap.status == RoomStatus.IN_GAME) throw ApiException(409, "room_locked")
            if (snap.members.size >= limits.maxPlayers) throw ApiException(409, "room_full")
            val name = Names.normalize(rawName) ?: throw ApiException(422, "invalid_name")
            if (snap.members.any { Names.same(it.name, name) }) throw ApiException(409, "name_taken")
            val token = Tokens.create(random)
            val member = Member(snap.nextMemberId, name, Tokens.hash(token))
            commit(room, snap.copy(members = snap.members + member, nextMemberId = member.id + 1, lastActivity = clock.millis()))
            return JoinedRoom(member.id, token)
        }
    }

    fun summary(code: String): RoomSummary {
        val room = find(code) ?: throw notFound()
        room.lock.withLock {
            if (room.closed) throw notFound()
            val snap = room.snap
            return RoomSummary(snap.code, snap.status, snap.members.size, limits.maxPlayers, snap.mode)
        }
    }

    fun modeInfo(): List<ModeInfo> = modes.map { ModeInfo(it.id, it.players.first, it.players.last, it.configSpec) }

    // --- WebSocket ---

    /** Authenticates [connection] with its hello. On failure the connection is closed and `false` returned. */
    fun attach(connection: Connection, hello: ClientMessage.Hello): Boolean {
        if (!accepting) return refuse(connection, CloseReason.RESTARTING)
        val room = find(hello.room) ?: return refuse(connection, CloseReason.ROOM_CLOSED)
        room.lock.withLock {
            if (room.closed) return refuse(connection, CloseReason.ROOM_CLOSED)
            val principal = authenticate(room.snap, hello.token) ?: return refuse(connection, CloseReason.BAD_TOKEN)
            val attached = Attached(connection, principal)
            room.connections[connection.id] = attached
            bindings[connection.id] = Binding(room, principal)
            val you = when (principal) {
                Principal.Host -> You(Role.HOST)
                is Principal.Player -> You(Role.PLAYER, principal.id)
            }
            connection.send(ServerMessage.Welcome(you))
            broadcastRoom(room)
            if (room.game != null) pushGame(room, attached, room.events.filter { it.seq > (hello.lastEventSeq ?: 0) })
            return true
        }
    }

    /** Runs a command from an authenticated connection. */
    fun handle(connection: Connection, message: ClientMessage) {
        val binding = bindings[connection.id] ?: return
        val room = binding.room
        room.lock.withLock {
            if (room.closed) return
            when (message) {
                is ClientMessage.Hello -> connection.send(ServerMessage.Error(ProtocolError.ALREADY_AUTHENTICATED))
                is ClientMessage.RoomCommand -> run(room, connection, binding.principal, message)
            }
        }
    }

    fun detach(connection: Connection) {
        val binding = bindings.remove(connection.id) ?: return
        val room = binding.room
        room.lock.withLock {
            if (room.connections.remove(connection.id) != null && !room.closed) broadcastRoom(room)
        }
    }

    // --- Lifecycle ---

    /** Loads rooms saved before a restart. A game that can't be restored ends; its room stays open. */
    fun restore() {
        for (loaded in repository.loadAll()) {
            var snap = loaded.room.room
            var events = loaded.events
            if (modes.none { it.id == snap.mode }) snap = snap.copy(mode = modes.first().id, config = defaults(modes.first()))
            val record = snap.game
            var game: AnyGame? = null
            if (record != null) {
                game = try {
                    modes.firstOrNull { it.id == record.mode }?.decode(loaded.room.gameState!!, record.schemaVersion)
                } catch (e: IllegalArgumentException) {
                    log.warn("Room {} could not restore its {} game: {}", snap.code, record.mode, e.message)
                    null
                }
                if (game == null) {
                    snap = snap.copy(
                        status = RoomStatus.LOBBY,
                        game = null,
                        lastResult = RoundResult(snap.round, ResultKind.RESTORE_FAILED),
                        version = snap.version + 1,
                    )
                    events = emptyList()
                    repository.save(PersistedRoom(snap), 0, EventWrite.RESET)
                }
            }
            rooms[snap.code] = Room(snap, game, events)
        }
        log.info("Restored {} rooms", rooms.size)
    }

    /** Expires idle rooms, ends idle games and sends turn-timer nudges. Called periodically. */
    fun tick() {
        val now = clock.millis()
        for (room in rooms.values.toList()) {
            room.lock.withLock {
                if (room.closed) return@withLock
                val snap = room.snap
                val idle = now - snap.lastActivity
                when (snap.status) {
                    RoomStatus.LOBBY -> if (idle >= limits.lobbyIdle.toMillis()) close(room)
                    RoomStatus.FINISHED -> if (idle >= limits.finishedIdle.toMillis()) close(room)
                    RoomStatus.IN_GAME ->
                        if (idle >= limits.gameIdle.toMillis()) endRound(room, ResultKind.IDLE_TIMEOUT) else nudge(room, now)
                }
            }
        }
    }

    /** Stops accepting and closes every socket with 1012 so clients reconnect to the next instance. State is already saved. */
    fun shutdown() {
        accepting = false
        for (room in rooms.values.toList()) {
            room.lock.withLock { disconnectAll(room, CloseReason.RESTARTING) }
        }
    }

    // --- Commands ---

    private fun run(room: Room, connection: Connection, who: Principal, command: ClientMessage.RoomCommand) {
        if (who is Principal.Player && room.snap.members.none { it.id == who.id }) return
        if (command.clientSeq <= lastClientSeq(room.snap, who)) {
            connection.send(ServerMessage.Ack(command.clientSeq))
            return
        }
        room.snap = withClientSeq(room.snap, who, command.clientSeq)
        val refusal = try {
            execute(room, who, command)
        } catch (e: RuntimeException) {
            log.error("Room {} failed to run {}", room.snap.code, command::class.simpleName, e)
            connection.send(ServerMessage.Error(ProtocolError.SERVER_ERROR))
            return
        }
        connection.send(if (refusal == null) ServerMessage.Ack(command.clientSeq) else ServerMessage.Rejected(command.clientSeq, refusal))
    }

    private fun execute(room: Room, who: Principal, command: ClientMessage.RoomCommand): Refusal? = when (command) {
        is ClientMessage.Act -> act(room, who, command)
        is ClientMessage.SetMode -> asVip(room, who, LOBBY_ONLY) { setMode(room, command.mode) }
        is ClientMessage.SetConfig -> asVip(room, who, LOBBY_ONLY) { setConfig(room, command.config) }
        is ClientMessage.SetTimer -> asVip(room, who, LOBBY_ONLY) { setTimer(room, command.seconds) }
        is ClientMessage.Kick -> asVip(room, who, BETWEEN_GAMES) { kick(room, who as Principal.Player, command.playerId) }
        is ClientMessage.Leave -> leave(room, who)
        is ClientMessage.Start -> asVip(room, who, LOBBY_ONLY) { start(room) }
        is ClientMessage.EndGame -> asVip(room, who, setOf(RoomStatus.IN_GAME)) { endRound(room, ResultKind.ENDED_BY_HOST) }
        is ClientMessage.PlayAgain -> asVip(room, who, setOf(RoomStatus.FINISHED)) { playAgain(room) }
    }

    private inline fun asVip(room: Room, who: Principal, statuses: Set<RoomStatus>, block: () -> Refusal?): Refusal? = when {
        who !is Principal.Player || who.id != room.snap.vip -> Refusal.NOT_VIP
        room.snap.status !in statuses -> Refusal.WRONG_STATUS
        else -> block()
    }

    private fun setMode(room: Room, id: String): Refusal? {
        val mode = modes.firstOrNull { it.id == id } ?: return Refusal.UNKNOWN_MODE
        commit(room, room.snap.copy(mode = mode.id, config = defaults(mode), lastActivity = clock.millis()))
        return null
    }

    private fun setConfig(room: Room, config: JsonObject): Refusal? {
        val valid = validConfig(mode(room.snap.mode), config) ?: return Refusal.INVALID_CONFIG
        commit(room, room.snap.copy(config = valid, lastActivity = clock.millis()))
        return null
    }

    private fun setTimer(room: Room, seconds: Int?): Refusal? {
        if (seconds != null && seconds !in TIMER_SECONDS) return Refusal.INVALID_TIMER
        commit(room, room.snap.copy(turnTimer = seconds, lastActivity = clock.millis()))
        return null
    }

    private fun kick(room: Room, vip: Principal.Player, target: Int): Refusal? {
        val member = room.snap.members.firstOrNull { it.id == target }?.takeIf { it.id != vip.id } ?: return Refusal.INVALID_TARGET
        remove(room, member, CloseReason.KICKED)
        return null
    }

    private fun leave(room: Room, who: Principal): Refusal? {
        if (who !is Principal.Player) return Refusal.NOT_A_PLAYER
        if (room.snap.status !in BETWEEN_GAMES) return Refusal.WRONG_STATUS
        remove(room, room.snap.members.first { it.id == who.id }, CloseReason.LEFT)
        return null
    }

    private fun remove(room: Room, member: Member, reason: CloseReason) {
        commit(room, room.snap.copy(members = room.snap.members - member, lastActivity = clock.millis()))
        room.connections.values.filter { it.principal == Principal.Player(member.id) }.toList().forEach { disconnect(room, it, reason) }
    }

    private fun start(room: Room): Refusal? {
        val snap = room.snap
        val mode = mode(snap.mode)
        if (snap.members.size < mode.players.first) return Refusal.NOT_ENOUGH_PLAYERS
        val seats = snap.members.map(Member::id).take(mode.players.last)
        val hint = snap.rematch?.takeIf { it.mode == mode.id && it.seats == seats }?.config ?: JsonObject(emptyMap())
        val seed = random.nextLong()
        val setup = try {
            mode.setup(seats.size, JsonObject(snap.config + hint), seed)
        } catch (e: IllegalArgumentException) {
            log.warn("Room {} could not start {}: {}", snap.code, mode.id, e.message)
            return Refusal.INVALID_CONFIG
        }
        val now = clock.millis()
        val events = number(setup.events, snap.nextEventSeq)
        val next = snap.copy(
            status = RoomStatus.IN_GAME,
            round = snap.round + 1,
            game = GameRecord(mode.id, mode.schemaVersion, seed, seats, now),
            nextEventSeq = snap.nextEventSeq + events.size,
            rematch = null,
            lastActivity = now,
        )
        commit(room, next, setup.game, EventWrite(reset = true, append = events))
        room.nudged = null
        pushGameToAll(room, events)
        return null
    }

    private fun act(room: Room, who: Principal, act: ClientMessage.Act): Refusal? {
        val game = room.game.takeIf { room.snap.status == RoomStatus.IN_GAME } ?: return Refusal.WRONG_STATUS
        val snap = room.snap
        val record = snap.game!!
        val seat = (who as? Principal.Player)?.let { record.seats.indexOf(it.id) }?.takeIf { it >= 0 } ?: return Refusal.NOT_A_PLAYER
        val mode = mode(game.modeId)
        val command = EngineJson.encodeToJsonElement(Command.serializer(), Command(Seat(seat), act.decisionId, act.choice))
        return when (val result = mode.apply(game, command)) {
            is AnyResult.Rejected -> Refusal.of(result.reason)
            is AnyResult.Accepted -> {
                val status = mode.status(result.game)
                val events = number(result.events, snap.nextEventSeq)
                val now = clock.millis()
                val next = snap.copy(
                    status = if (status.outcome == null) RoomStatus.IN_GAME else RoomStatus.FINISHED,
                    game = record.copy(decisionSince = now),
                    nextEventSeq = snap.nextEventSeq + events.size,
                    lastResult = status.outcome?.let { RoundResult(snap.round, ResultKind.FINISHED, it) } ?: snap.lastResult,
                    lastActivity = now,
                )
                commit(room, next, result.game, EventWrite(reset = false, append = events), CommandRecord(snap.round, status.actionSeq, command))
                room.nudged = null
                pushGameToAll(room, events)
                null
            }
        }
    }

    /** Ends the current game early; the room goes back to the lobby. */
    private fun endRound(room: Room, kind: ResultKind): Refusal? {
        val snap = room.snap
        commit(
            room,
            snap.copy(status = RoomStatus.LOBBY, game = null, lastResult = RoundResult(snap.round, kind), lastActivity = clock.millis()),
            null,
            EventWrite.RESET,
        )
        return null
    }

    private fun playAgain(room: Room): Refusal? {
        val snap = room.snap
        val game = room.game!!
        val rematch = Rematch(game.modeId, snap.game!!.seats, mode(game.modeId).rematchConfig(game))
        commit(room, snap.copy(status = RoomStatus.LOBBY, game = null, rematch = rematch, lastActivity = clock.millis()), null, EventWrite.RESET)
        return null
    }

    private fun nudge(room: Room, now: Long) {
        val seconds = room.snap.turnTimer ?: return
        val game = room.game!!
        val mode = mode(game.modeId)
        val pending = mode.status(game).pending!!
        if (room.nudged == pending.id || now - room.snap.game!!.decisionSince < seconds * MILLIS) return
        room.nudged = pending.id
        val event = mode.nudge(game)!!
        room.connections.values.toList().forEach { it.connection.send(ServerMessage.Nudge(event)) }
    }

    // --- State, persistence and fan-out (callers hold the room lock) ---

    /** Persists first; only then does the room change in memory and clients hear about it. */
    private fun commit(room: Room, snap: RoomSnapshot, game: AnyGame? = room.game, events: EventWrite = EventWrite.NONE, command: CommandRecord? = null) {
        val next = snap.copy(version = room.snap.version + 1)
        val engine = game?.let { mode(it.modeId) }
        repository.save(PersistedRoom(next, engine?.encode(game)), engine?.status(game)?.actionSeq ?: 0, events, command)
        room.snap = next
        room.game = game
        room.events = if (events.reset) events.append else room.events + events.append
        broadcastRoom(room)
    }

    private fun broadcastRoom(room: Room) {
        val message = ServerMessage.Room(roomView(room))
        room.connections.values.toList().forEach { it.connection.send(message) }
    }

    private fun pushGameToAll(room: Room, events: List<StoredEvent>) {
        room.connections.values.toList().forEach { pushGame(room, it, events) }
    }

    private fun pushGame(room: Room, attached: Attached, events: List<StoredEvent>) {
        val game = room.game!!
        val mode = mode(game.modeId)
        val viewer = viewerOf(room.snap.game!!, attached.principal)
        val view = mode.view(game, viewer)
        val seat = (viewer as? Viewer.Player)?.seat?.index
        attached.connection.send(ServerMessage.Game(room.snap.round, game.modeId, seat, view.view, view.legal))
        val visible = events.filter { mode.isVisible(game, it.audience, viewer) }
        if (visible.isNotEmpty()) {
            attached.connection.send(ServerMessage.Events(room.snap.round, visible.map { EventView(it.seq, it.event) }))
        }
    }

    private fun roomView(room: Room): RoomView {
        val snap = room.snap
        val online = room.connections.values.map(Attached::principal).toSet()
        return RoomView(
            code = snap.code,
            status = snap.status,
            version = snap.version,
            round = snap.round,
            vip = snap.vip,
            members = snap.members.map { MemberView(it.id, it.name, Principal.Player(it.id) in online) },
            hostConnected = Principal.Host in online,
            mode = snap.mode,
            config = snap.config,
            turnTimer = snap.turnTimer,
            seats = snap.game?.seats ?: emptyList(),
            lastResult = snap.lastResult,
        )
    }

    private fun close(room: Room) {
        room.closed = true
        rooms.remove(room.snap.code, room)
        repository.delete(room.snap.code)
        disconnectAll(room, CloseReason.ROOM_CLOSED)
        log.info("Room {} expired", room.snap.code)
    }

    private fun disconnectAll(room: Room, reason: CloseReason) {
        room.connections.values.toList().forEach { disconnect(room, it, reason) }
    }

    /** Unbinds first, so a synchronous close callback finds nothing left to detach. */
    private fun disconnect(room: Room, attached: Attached, reason: CloseReason) {
        room.connections.remove(attached.connection.id)
        bindings.remove(attached.connection.id)
        attached.connection.send(ServerMessage.Closing(reason))
        attached.connection.close(reason)
    }

    // --- Helpers ---

    private fun refuse(connection: Connection, reason: CloseReason): Boolean {
        connection.send(ServerMessage.Closing(reason))
        connection.close(reason)
        return false
    }

    private fun requireAccepting() {
        if (!accepting) throw ApiException(503, "unavailable")
    }

    private fun find(code: String): Room? = RoomCodes.normalize(code)?.let(rooms::get)

    private fun notFound() = ApiException(404, "room_not_found")

    private fun mode(id: String): AnyMode = modes.first { it.id == id }

    private fun authenticate(snap: RoomSnapshot, token: String): Principal? = when {
        Tokens.matches(token, snap.hostTokenHash) -> Principal.Host
        else -> snap.members.firstOrNull { Tokens.matches(token, it.tokenHash) }?.let { Principal.Player(it.id) }
    }

    private fun viewerOf(record: GameRecord, principal: Principal): Viewer =
        (principal as? Principal.Player)?.let { record.seats.indexOf(it.id) }?.takeIf { it >= 0 }?.let { Viewer.Player(Seat(it)) }
            ?: Viewer.Spectator

    private fun lastClientSeq(snap: RoomSnapshot, who: Principal): Long = when (who) {
        Principal.Host -> snap.hostClientSeq
        is Principal.Player -> snap.members.first { it.id == who.id }.lastClientSeq
    }

    private fun withClientSeq(snap: RoomSnapshot, who: Principal, seq: Long): RoomSnapshot = when (who) {
        Principal.Host -> snap.copy(hostClientSeq = seq)
        is Principal.Player -> snap.copy(members = snap.members.map { if (it.id == who.id) it.copy(lastClientSeq = seq) else it })
    }

    private fun number(events: List<AnyEvent>, first: Long): List<StoredEvent> =
        events.mapIndexed { i, e -> StoredEvent(first + i, e.audience, e.event) }

    companion object {
        val TIMER_SECONDS = setOf(60, 90, 120)
        private const val CODE_ATTEMPTS = 100
        private const val MILLIS = 1000L
        private val LOBBY_ONLY = setOf(RoomStatus.LOBBY)
        private val BETWEEN_GAMES = setOf(RoomStatus.LOBBY, RoomStatus.FINISHED)

        /** The lobby's starting switches: every option of the mode at its default. */
        fun defaults(mode: AnyMode): JsonObject = JsonObject(
            mode.configSpec.options.associate {
                it.key to when (it) {
                    is ConfigOption.Toggle -> JsonPrimitive(it.default)
                    is ConfigOption.Range -> JsonPrimitive(it.default)
                }
            },
        )

        /** Lobby switches checked against the mode's spec; missing keys get defaults. `null` if anything is off. */
        fun validConfig(mode: AnyMode, config: JsonObject): JsonObject? {
            val spec = mode.configSpec.options
            if (!spec.map(ConfigOption::key).containsAll(config.keys)) return null
            val values = spec.associate { option ->
                // Strings ("true", "5") and non-primitives are refused, not coerced.
                val raw = (config[option.key] ?: defaults(mode).getValue(option.key)) as? JsonPrimitive
                val value = raw?.takeIf { !it.isString }
                val valid = when (option) {
                    is ConfigOption.Toggle -> value?.booleanOrNull?.let(::JsonPrimitive)
                    is ConfigOption.Range -> value?.intOrNull?.takeIf { it in option.min..option.max }?.let(::JsonPrimitive)
                }
                option.key to (valid ?: return null)
            }
            return JsonObject(values)
        }
    }
}
