package dev.ttaaa.precinctnoir.server.room

import dev.ttaaa.precinctnoir.engine.core.api.AnyMode
import dev.ttaaa.precinctnoir.engine.core.api.AnyResult
import dev.ttaaa.precinctnoir.engine.core.api.ErasedMode
import dev.ttaaa.precinctnoir.engine.core.api.Rejection
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel
import dev.ttaaa.precinctnoir.engine.testing.CounterMode
import dev.ttaaa.precinctnoir.engine.testing.sample
import dev.ttaaa.precinctnoir.server.config.RoomLimits
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.Act
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.EndGame
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.Hello
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.Kick
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.Leave
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.PlayAgain
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.SetConfig
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.SetMode
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.SetTimer
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.ShowGuide
import dev.ttaaa.precinctnoir.server.protocol.ClientMessage.Start
import dev.ttaaa.precinctnoir.server.protocol.CloseReason
import dev.ttaaa.precinctnoir.server.protocol.EventView
import dev.ttaaa.precinctnoir.server.protocol.ProtocolError
import dev.ttaaa.precinctnoir.server.protocol.Refusal
import dev.ttaaa.precinctnoir.server.protocol.Role
import dev.ttaaa.precinctnoir.server.protocol.RoomSummary
import dev.ttaaa.precinctnoir.server.protocol.RoomView
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage.Ack
import dev.ttaaa.precinctnoir.server.protocol.ServerMessage.Rejected
import dev.ttaaa.precinctnoir.server.protocol.You
import dev.ttaaa.precinctnoir.server.testing.ConstantRandomness
import dev.ttaaa.precinctnoir.server.testing.FakeConnection
import dev.ttaaa.precinctnoir.server.testing.FakeRepository
import dev.ttaaa.precinctnoir.server.testing.MutableClock
import dev.ttaaa.precinctnoir.server.testing.SeededRandomness
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.Duration

class RoomServiceTest {
    private val repo = FakeRepository()
    private val clock = MutableClock()
    private var limits = RoomLimits()
    private val modes: List<AnyMode> = listOf(ErasedMode(ShadowDuel), ErasedMode(CounterMode))
    private var connections = 0

    private fun service(random: Randomness = SeededRandomness(7), modeList: List<AnyMode> = modes) =
        RoomService(repo, clock, random, limits, modeList)

    /** A room with the TV connected and [players] joined and connected, in order (ids 1, 2, …). */
    private inner class Table(val rooms: RoomService = service(), players: List<String> = listOf("Ann", "Bob")) {
        val created = rooms.create()
        val code = created.code
        val tv = connect(created.hostToken)
        val tokens = mutableMapOf<Int, String>()
        val conns = mutableMapOf<Int, FakeConnection>()
        var seq = 0L

        init {
            players.forEach(::add)
        }

        val vip: FakeConnection get() = player(1)

        fun add(name: String): Int {
            val joined = rooms.join(code, name)
            tokens[joined.playerId] = joined.playerToken
            conns[joined.playerId] = connect(joined.playerToken)
            return joined.playerId
        }

        fun connect(token: String, lastEventSeq: Long? = null): FakeConnection =
            FakeConnection("c${connections++}").also { rooms.attach(it, Hello(code, token, lastEventSeq)) }

        fun player(id: Int): FakeConnection = conns.getValue(id)

        /** Sends a command with the next sequence number; returns the sender's last message (the ack or refusal). */
        fun send(from: FakeConnection, command: (Long) -> ClientMessage.RoomCommand): ServerMessage {
            rooms.handle(from, command(++seq))
            return from.sent.last()
        }

        fun ack() = Ack(seq)

        fun refused(reason: Refusal) = Rejected(seq, reason)

        fun room(conn: FakeConnection = tv): RoomView = conn.last<ServerMessage.Room>().room

        fun game(conn: FakeConnection): ServerMessage.Game = conn.last()

        fun start(): ServerMessage = send(vip) { Start(it) }

        fun actor(): FakeConnection? = conns.values.firstOrNull { it.all<ServerMessage.Game>().lastOrNull()?.legal?.isNotEmpty() == true }

        fun decision(conn: FakeConnection): Int = game(conn).view.jsonObject["pending"]!!.jsonObject["id"]!!.jsonPrimitive.int

        fun role(id: Int): String = game(player(id)).view.jsonObject["me"]!!.jsonObject["role"]!!.jsonPrimitive.content

        /** Plays one random legal choice; `false` once nobody has anything to do. */
        fun step(rng: Rng): Boolean {
            val actor = actor() ?: return false
            val legal = game(actor).legal
            assertThat(send(actor) { Act(it, decision(actor), legal[rng.nextInt(legal.size)].sample(rng)) }).isEqualTo(ack())
            return true
        }

        fun playToEnd(rng: Rng = Rng.seeded(3)): Int {
            var steps = 0
            while (step(rng)) check(++steps < 5_000) { "game did not end" }
            return steps
        }

        fun events(conn: FakeConnection): List<EventView> = conn.all<ServerMessage.Events>().flatMap { it.events }
    }

    private fun assertApi(status: Int, code: String, block: () -> Unit) {
        assertThatThrownBy(block).isInstanceOfSatisfying(ApiException::class.java) {
            assertThat(it.status).isEqualTo(status)
            assertThat(it.code).isEqualTo(code)
        }
    }

    // --- Creating and joining ---

    @Test
    fun `a new room gets a consonant code and a host token, and is saved at once`() {
        val rooms = service()
        val created = rooms.create()
        assertThat(created.code).matches("[${RoomCodes.ALPHABET}]{4}")
        assertThat(created.hostToken).hasSize(22)
        val saved = repo.rooms.getValue(created.code).room
        assertThat(saved.hostTokenHash).isEqualTo(Tokens.hash(created.hostToken)).isNotEqualTo(created.hostToken)
        assertThat(saved.config).isEqualTo(buildJsonObject { put("interrogateDeadOnBoard", JsonPrimitive(true)) })
        assertThat(rooms.roomCount).isEqualTo(1)
        assertThat(rooms.summary(" ${created.code.lowercase()} ")).isEqualTo(RoomSummary(created.code, RoomStatus.LOBBY, 0, 9, "killer_inspector"))
        assertApi(404, "room_not_found") { rooms.summary("ZZZZ") }
        assertThat(rooms.modeInfo().map { it.id to (it.minPlayers..it.maxPlayers) }).containsExactly("killer_inspector" to 2..2, "counter" to 1..3)
    }

    @Test
    fun `a room starts in the game the host picked, or the first one`() {
        val rooms = service()
        assertThat(rooms.modeFor(null).id).isEqualTo("killer_inspector")
        val counter = rooms.create(rooms.modeFor("counter"))
        assertThat(rooms.summary(counter.code).mode).isEqualTo("counter")
        assertThat(repo.rooms.getValue(counter.code).room.config).isEqualTo(buildJsonObject { put("target", JsonPrimitive(3)); put("broken", JsonPrimitive(false)) })
        assertApi(422, "unknown_mode") { rooms.modeFor("chess") }
    }

    @Test
    fun `room capacity and code exhaustion both answer 503`() {
        limits = RoomLimits(maxRooms = 1)
        val full = service()
        full.create()
        assertApi(503, "capacity") { full.create() }
        limits = RoomLimits()
        val unlucky = service(ConstantRandomness)
        unlucky.create()
        assertApi(503, "capacity") { unlucky.create() }
    }

    @Test
    fun `joining checks names, uniqueness, room size and the code`() {
        limits = RoomLimits(maxPlayers = 3)
        val t = Table(players = listOf("Ann"))
        assertApi(409, "name_taken") { t.rooms.join(t.code, " ANN ") }
        assertApi(422, "invalid_name") { t.rooms.join(t.code, "‮\u0007 ") }
        assertApi(422, "invalid_name") { t.rooms.join(t.code, "x".repeat(17)) }
        assertApi(404, "room_not_found") { t.rooms.join("ZZZZ", "Cy") }
        assertApi(404, "room_not_found") { t.rooms.join("A1", "Cy") }
        t.add("Bob")
        t.add("Cy")
        assertApi(409, "room_full") { t.rooms.join(t.code, "Dee") }
        assertThat(t.room().members.map { it.name }).containsExactly("Ann", "Bob", "Cy")
        assertThat(repo.rooms.getValue(t.code).room.members.map { it.tokenHash }).doesNotContainAnyElementsOf(t.tokens.values)
    }

    // --- Sockets ---

    @Test
    fun `the TV and players learn who they are and see who is connected`() {
        val t = Table()
        assertThat(t.tv.sent.first()).isEqualTo(ServerMessage.Welcome(You(Role.HOST)))
        assertThat(t.player(1).sent.first()).isEqualTo(ServerMessage.Welcome(You(Role.PLAYER, 1)))
        assertThat(t.room().let { Triple(it.hostConnected, it.vip, it.members.map { m -> m.connected }) }).isEqualTo(Triple(true, 1, listOf(true, true)))
        t.rooms.detach(t.player(2))
        assertThat(t.room().members.map { it.connected }).containsExactly(true, false)
        t.rooms.detach(t.player(2))
        t.rooms.detach(t.tv)
        assertThat(t.room(t.player(1)).hostConnected).isFalse()
    }

    @Test
    fun `bad tokens and unknown rooms are turned away`() {
        val t = Table()
        val bad = FakeConnection("bad")
        assertThat(t.rooms.attach(bad, Hello(t.code, "not-a-token"))).isFalse()
        assertThat(bad.closedWith).isEqualTo(CloseReason.BAD_TOKEN)
        assertThat(bad.sent).containsExactly(ServerMessage.Closing(CloseReason.BAD_TOKEN))
        val lost = FakeConnection("lost")
        assertThat(t.rooms.attach(lost, Hello("ZZZZ", t.created.hostToken))).isFalse()
        assertThat(lost.closedWith).isEqualTo(CloseReason.ROOM_CLOSED)
    }

    @Test
    fun `commands from unknown sockets are ignored, a second hello is an error`() {
        val t = Table()
        val stranger = FakeConnection("stranger")
        t.rooms.handle(stranger, Start(1))
        assertThat(stranger.sent).isEmpty()
        t.rooms.handle(t.tv, Hello(t.code, t.created.hostToken))
        assertThat(t.tv.sent.last()).isEqualTo(ServerMessage.Error(ProtocolError.ALREADY_AUTHENTICATED))
    }

    @Test
    fun `shutdown closes every socket with 1012 and refuses newcomers`() {
        val t = Table()
        t.rooms.shutdown()
        assertThat(t.rooms.accepting).isFalse()
        for (conn in listOf(t.tv, t.player(1), t.player(2))) {
            assertThat(conn.closedWith).isEqualTo(CloseReason.RESTARTING)
            assertThat(conn.sent.last()).isEqualTo(ServerMessage.Closing(CloseReason.RESTARTING))
        }
        val late = FakeConnection("late")
        assertThat(t.rooms.attach(late, Hello(t.code, t.created.hostToken))).isFalse()
        assertThat(late.closedWith).isEqualTo(CloseReason.RESTARTING)
        assertApi(503, "unavailable") { t.rooms.create() }
        assertApi(503, "unavailable") { t.rooms.join(t.code, "Cy") }
        assertThat(repo.rooms).containsKey(t.code) // nothing to flush: every change was already saved
    }

    // --- Lobby ---

    @Test
    fun `only the VIP runs the lobby`() {
        val t = Table()
        assertThat(t.send(t.player(2)) { SetTimer(it, 60) }).isEqualTo(t.refused(Refusal.NOT_VIP))
        assertThat(t.send(t.tv) { Start(it) }).isEqualTo(t.refused(Refusal.NOT_VIP))
        assertThat(t.send(t.player(2)) { EndGame(it) }).isEqualTo(t.refused(Refusal.NOT_VIP))
    }

    @Test
    fun `the VIP picks the mode, its switches and the timer, bad values are refused`() {
        val t = Table()
        val version = t.room().version
        assertThat(t.send(t.vip) { SetMode(it, "chess") }).isEqualTo(t.refused(Refusal.UNKNOWN_MODE))
        assertThat(t.send(t.vip) { SetMode(it, "counter") }).isEqualTo(t.ack())
        assertThat(t.room().config).isEqualTo(buildJsonObject { put("target", JsonPrimitive(3)); put("broken", JsonPrimitive(false)) })
        assertThat(t.send(t.vip) { SetConfig(it, buildJsonObject { put("target", JsonPrimitive(5)) }) }).isEqualTo(t.ack())
        assertThat(t.room().config).isEqualTo(buildJsonObject { put("target", JsonPrimitive(5)); put("broken", JsonPrimitive(false)) })
        for (bad in listOf(
            buildJsonObject { put("target", JsonPrimitive(10)) },
            buildJsonObject { put("target", JsonPrimitive(0)) },
            buildJsonObject { put("target", JsonPrimitive("5")) },
            buildJsonObject { put("target", JsonObject(emptyMap())) },
            buildJsonObject { put("broken", JsonPrimitive("yes")) },
            buildJsonObject { put("broken", JsonPrimitive(1)) },
            buildJsonObject { put("killerSeat", JsonPrimitive(0)) },
        )) {
            assertThat(t.send(t.vip) { SetConfig(it, bad) }).describedAs("$bad").isEqualTo(t.refused(Refusal.INVALID_CONFIG))
        }
        assertThat(t.send(t.vip) { SetTimer(it, 45) }).isEqualTo(t.refused(Refusal.INVALID_TIMER))
        assertThat(t.send(t.vip) { SetTimer(it, 90) }).isEqualTo(t.ack())
        assertThat(t.room().turnTimer).isEqualTo(90)
        assertThat(t.send(t.vip) { SetTimer(it, null) }).isEqualTo(t.ack())
        assertThat(t.room().turnTimer).isNull()
        assertThat(t.room().version).isEqualTo(version + 4)
    }

    @Test
    fun `the VIP shows the walkthrough on the board, page by page, until a game starts`() {
        val t = Table()
        assertThat(t.room().guide).isNull()
        assertThat(t.send(t.player(2)) { ShowGuide(it, 0) }).isEqualTo(t.refused(Refusal.NOT_VIP))
        assertThat(t.send(t.vip) { ShowGuide(it, -1) }).isEqualTo(t.refused(Refusal.ILLEGAL_INPUT))
        assertThat(t.send(t.vip) { ShowGuide(it, 20) }).isEqualTo(t.refused(Refusal.ILLEGAL_INPUT))
        assertThat(t.send(t.vip) { ShowGuide(it, 3) }).isEqualTo(t.ack())
        assertThat(t.room().guide).isEqualTo(3)
        assertThat(t.room(t.player(2)).guide).isEqualTo(3)
        assertThat(t.send(t.vip) { ShowGuide(it, null) }).isEqualTo(t.ack())
        assertThat(t.room().guide).isNull()

        t.send(t.vip) { ShowGuide(it, 1) }
        t.send(t.vip) { SetMode(it, "counter") } // another game's guide has other pages
        assertThat(t.room().guide).isNull()
        t.send(t.vip) { SetMode(it, "killer_inspector") }
        t.send(t.vip) { ShowGuide(it, 2) }
        t.start()
        assertThat(t.room().guide).isNull()
        assertThat(t.send(t.vip) { ShowGuide(it, 0) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
    }

    @Test
    fun `the VIP can remove players, whose tokens then stop working`() {
        val t = Table(players = listOf("Ann", "Bob", "Cy"))
        assertThat(t.send(t.vip) { Kick(it, 1) }).isEqualTo(t.refused(Refusal.INVALID_TARGET))
        assertThat(t.send(t.vip) { Kick(it, 99) }).isEqualTo(t.refused(Refusal.INVALID_TARGET))
        assertThat(t.send(t.vip) { Kick(it, 2) }).isEqualTo(t.ack())
        assertThat(t.player(2).closedWith).isEqualTo(CloseReason.KICKED)
        assertThat(t.player(2).sent.last()).isEqualTo(ServerMessage.Closing(CloseReason.KICKED))
        assertThat(t.room().members.map { it.name }).containsExactly("Ann", "Cy")
        val again = FakeConnection("again")
        assertThat(t.rooms.attach(again, Hello(t.code, t.tokens.getValue(2)))).isFalse()
        assertThat(again.closedWith).isEqualTo(CloseReason.BAD_TOKEN)
        t.rooms.handle(t.player(2), Start(1_000)) // a kicked socket's late command is ignored
        assertThat(t.room().status).isEqualTo(RoomStatus.LOBBY)
    }

    @Test
    fun `players may leave between games, and the next earliest player becomes VIP`() {
        val t = Table(players = listOf("Ann", "Bob", "Cy"))
        assertThat(t.send(t.tv) { Leave(it) }).isEqualTo(t.refused(Refusal.NOT_A_PLAYER))
        t.send(t.vip) { Leave(it) }
        assertThat(t.player(1).closedWith).isEqualTo(CloseReason.LEFT)
        assertThat(t.room().vip).isEqualTo(2)
        assertThat(t.send(t.player(3)) { Kick(it, 2) }).isEqualTo(t.refused(Refusal.NOT_VIP))
    }

    // --- Playing ---

    @Test
    fun `start seats the earliest players, everyone else watches, the room locks`() {
        assertThat(Table(players = listOf("Ann")).start()).isEqualTo(Rejected(1, Refusal.NOT_ENOUGH_PLAYERS))
        val t = Table(players = listOf("Ann", "Bob", "Cy"))
        assertThat(t.start()).isEqualTo(t.ack())
        assertThat(t.room().let { Triple(it.status, it.seats, it.round) }).isEqualTo(Triple(RoomStatus.IN_GAME, listOf(1, 2), 1))
        assertThat(listOf(1, 2, 3).map { t.game(t.player(it)).seat }).containsExactly(0, 1, null)
        assertThat(t.game(t.tv).seat).isNull()
        assertThat(t.game(t.tv).mode).isEqualTo("killer_inspector")
        assertThat(t.game(t.player(3)).legal).isEmpty()
        assertThat(listOf(1, 2).count { t.game(t.player(it)).legal.isNotEmpty() }).isEqualTo(1)
        // The Killer's identity is private: only the Killer's socket gets that event.
        val killer = listOf(1, 2).single { t.role(it) == "killer" }
        val privateEvents = { conn: FakeConnection -> t.events(conn).count { "your_identity" in it.event.toString() } }
        assertThat(privateEvents(t.player(killer))).isEqualTo(1)
        assertThat(listOf(t.tv, t.player(3), t.player(3 - killer)).map(privateEvents)).containsOnly(0)

        assertApi(409, "room_locked") { t.rooms.join(t.code, "Dee") }
        assertThat(t.send(t.vip) { SetMode(it, "counter") }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        assertThat(t.send(t.vip) { Kick(it, 3) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        assertThat(t.send(t.player(3)) { Leave(it) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        assertThat(t.send(t.vip) { PlayAgain(it) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
    }

    @Test
    fun `acts are checked - spectators, the TV, stale, foreign and illegal choices are refused`() {
        val t = Table(players = listOf("Ann", "Bob", "Cy"))
        assertThat(t.send(t.vip) { Act(it, 1, SimpleChoice("kill")) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        t.start()
        val actor = t.actor()!!
        val other = listOf(t.player(1), t.player(2)).single { it != actor }
        val decision = t.decision(actor)
        val choice = t.game(actor).legal.first().sample(Rng.seeded(1))
        assertThat(t.send(t.player(3)) { Act(it, decision, choice) }).isEqualTo(t.refused(Refusal.NOT_A_PLAYER))
        assertThat(t.send(t.tv) { Act(it, decision, choice) }).isEqualTo(t.refused(Refusal.NOT_A_PLAYER))
        assertThat(t.send(actor) { Act(it, decision + 1, choice) }).isEqualTo(t.refused(Refusal.STALE_DECISION))
        assertThat(t.send(other) { Act(it, decision, choice) }).isEqualTo(t.refused(Refusal.NOT_YOUR_DECISION))
        assertThat(t.send(actor) { Act(it, decision, SimpleChoice("teleport")) }).isEqualTo(t.refused(Refusal.ILLEGAL_INPUT))
        assertThat(t.send(actor) { Act(it, decision, choice) }).isEqualTo(t.ack())
    }

    @Test
    fun `a whole game is saved command by command and ends with a result`() {
        val t = Table()
        t.start()
        val steps = t.playToEnd()
        val room = t.room()
        assertThat(room.status).isEqualTo(RoomStatus.FINISHED)
        assertThat(room.lastResult!!.kind).isEqualTo(ResultKind.FINISHED)
        assertThat(room.lastResult.outcome).isNotNull()
        assertThat(repo.commands.map { it.second.actionSeq }).isEqualTo((1L..steps).toList())
        assertThat(repo.actionSeqs.getValue(t.code)).isEqualTo(steps.toLong())
        val seqs = repo.events.getValue(t.code).map { it.seq }
        assertThat(seqs).isEqualTo((1L..seqs.size).toList())
        assertThat(t.events(t.tv).map { it.seq }).isSorted()
        assertThat(t.send(t.vip) { Act(it, 1, SimpleChoice("kill")) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        assertThat(t.send(t.vip) { EndGame(it) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        // A finished room accepts newcomers again; they'll play next round if seated.
        t.add("Cy")
        assertThat(t.room().members).hasSize(3)
    }

    @Test
    fun `play again swaps Shadow Duel roles for the same pair, but not for a new line-up or mode`() {
        val spy = SpyMode(ErasedMode(ShadowDuel))
        val counter = SpyMode(ErasedMode(CounterMode))
        val t = Table(rooms = service(modeList = listOf(spy, counter)))
        t.start()
        val firstKiller = listOf(1, 2).single { t.role(it) == "killer" }
        t.playToEnd()
        assertThat(t.send(t.player(2)) { PlayAgain(it) }).isEqualTo(t.refused(Refusal.NOT_VIP))
        assertThat(t.send(t.vip) { PlayAgain(it) }).isEqualTo(t.ack())
        assertThat(t.room().status).isEqualTo(RoomStatus.LOBBY)
        t.start()
        assertThat(t.role(firstKiller)).isEqualTo("inspector")
        assertThat(spy.configs.last()).containsKey("killerSeat")

        t.playToEnd()
        t.send(t.vip) { PlayAgain(it) }
        t.send(t.vip) { Kick(it, 2) }
        t.add("Cy")
        t.start()
        assertThat(spy.configs.last()).doesNotContainKey("killerSeat")

        t.send(t.vip) { EndGame(it) }
        t.playAgainAfter(spy) // a finished Shadow Duel leaves a rematch hint …
        t.send(t.vip) { SetMode(it, "counter") }
        t.start() // … that a different mode ignores
        assertThat(counter.configs.last()).doesNotContainKey("killerSeat")
    }

    private fun Table.playAgainAfter(spy: SpyMode) {
        val games = spy.configs.size
        start()
        playToEnd()
        assertThat(send(vip) { PlayAgain(it) }).isEqualTo(ack())
        assertThat(spy.configs).hasSize(games + 1)
    }

    @Test
    fun `the VIP can end a running game, the room returns to the lobby`() {
        val t = Table()
        assertThat(t.send(t.vip) { EndGame(it) }).isEqualTo(t.refused(Refusal.WRONG_STATUS))
        t.start()
        t.step(Rng.seeded(1))
        assertThat(t.send(t.vip) { EndGame(it) }).isEqualTo(t.ack())
        val room = t.room()
        assertThat(room.status).isEqualTo(RoomStatus.LOBBY)
        assertThat(room.lastResult).isEqualTo(RoundResult(1, ResultKind.ENDED_BY_HOST))
        assertThat(room.seats).isEmpty()
        assertThat(repo.events.getValue(t.code)).isEmpty()
        assertThat(t.start()).isEqualTo(t.ack())
        assertThat(t.room().round).isEqualTo(2)
    }

    @Test
    fun `a mode that refuses its config can't start`() {
        val fragile = object : AnyMode by ErasedMode(ShadowDuel) {
            override fun setup(players: Int, config: JsonObject, seed: Long): AnyResult.Accepted = throw IllegalArgumentException("no")
        }
        val t = Table(rooms = service(modeList = listOf(fragile)))
        assertThat(t.start()).isEqualTo(t.refused(Refusal.INVALID_CONFIG))
        assertThat(t.room().status).isEqualTo(RoomStatus.LOBBY)
    }

    @Test
    fun `repeated client sequence numbers are acknowledged without running again`() {
        val t = Table()
        val saves = repo.saves
        t.rooms.handle(t.vip, SetTimer(5, 60))
        t.rooms.handle(t.vip, SetTimer(5, 90))
        t.rooms.handle(t.vip, SetTimer(4, 120))
        assertThat(t.vip.sent.takeLast(3)).containsExactly(Ack(5), Ack(5), Ack(4))
        assertThat(t.room().turnTimer).isEqualTo(60)
        assertThat(repo.saves).isEqualTo(saves + 1)
        t.rooms.handle(t.tv, Start(1))
        t.rooms.handle(t.tv, Start(1))
        assertThat(t.tv.sent.takeLast(2)).containsExactly(Rejected(1, Refusal.NOT_VIP), Ack(1))
    }

    @Test
    fun `a failed save changes nothing and reports a server error`() {
        val t = Table()
        val before = t.room()
        repo.failNextSave = true
        t.rooms.handle(t.vip, SetTimer(1, 60))
        assertThat(t.vip.sent.last()).isEqualTo(ServerMessage.Error(ProtocolError.SERVER_ERROR))
        assertThat(t.room()).isEqualTo(before)
        t.rooms.handle(t.vip, SetTimer(2, 60))
        assertThat(t.room().turnTimer).isEqualTo(60)
    }

    @Test
    fun `reconnecting resumes from the last event the client saw`() {
        val t = Table()
        t.start()
        val rng = Rng.seeded(5)
        repeat(4) { t.step(rng) }
        val seen = t.events(t.player(1))
        val resumed = t.connect(t.tokens.getValue(1), lastEventSeq = seen[2].seq)
        assertThat(resumed.sent.first()).isEqualTo(ServerMessage.Welcome(You(Role.PLAYER, 1)))
        assertThat(t.game(resumed)).isEqualTo(t.game(t.player(1)))
        assertThat(t.events(resumed)).isEqualTo(seen.drop(3))
        assertThat(t.events(t.connect(t.tokens.getValue(1)))).isEqualTo(seen)
        assertThat(t.connect(t.tokens.getValue(1), lastEventSeq = seen.last().seq).all<ServerMessage.Events>()).isEmpty()
    }

    // --- Time ---

    @Test
    fun `idle lobbies and finished rooms expire and their sockets are closed`() {
        val lobby = Table()
        clock.advance(Duration.ofMinutes(29))
        lobby.rooms.tick()
        assertThat(lobby.rooms.roomCount).isEqualTo(1)
        clock.advance(Duration.ofMinutes(1))
        lobby.rooms.tick()
        assertThat(lobby.rooms.roomCount).isZero()
        assertThat(repo.rooms).doesNotContainKey(lobby.code)
        assertThat(lobby.tv.closedWith).isEqualTo(CloseReason.ROOM_CLOSED)
        assertThat(lobby.tv.sent.last()).isEqualTo(ServerMessage.Closing(CloseReason.ROOM_CLOSED))
        assertApi(404, "room_not_found") { lobby.rooms.join(lobby.code, "Cy") }

        val finished = Table()
        finished.start()
        finished.playToEnd()
        clock.advance(Duration.ofMinutes(14))
        finished.rooms.tick()
        assertThat(finished.rooms.roomCount).isEqualTo(1)
        clock.advance(Duration.ofMinutes(1))
        finished.rooms.tick()
        assertThat(finished.rooms.roomCount).isZero()
    }

    @Test
    fun `a game nobody touches for two hours ends and the room goes back to the lobby`() {
        val t = Table()
        t.start()
        clock.advance(Duration.ofMinutes(119))
        t.rooms.tick()
        assertThat(t.room().status).isEqualTo(RoomStatus.IN_GAME)
        clock.advance(Duration.ofMinutes(1))
        t.rooms.tick()
        assertThat(t.room().status).isEqualTo(RoomStatus.LOBBY)
        assertThat(t.room().lastResult).isEqualTo(RoundResult(1, ResultKind.IDLE_TIMEOUT))
        clock.advance(Duration.ofMinutes(29))
        t.rooms.tick()
        assertThat(t.rooms.roomCount).isEqualTo(1) // the lobby gets its own 30 minutes
    }

    @Test
    fun `the turn timer nudges once per decision and never moves for anyone`() {
        val t = Table()
        t.send(t.vip) { SetTimer(it, 60) }
        t.start()
        val nudges = { listOf(t.tv, t.player(1), t.player(2)).map { it.all<ServerMessage.Nudge>().size } }
        clock.advance(Duration.ofSeconds(59))
        t.rooms.tick()
        assertThat(nudges()).containsOnly(0)
        clock.advance(Duration.ofSeconds(1))
        t.rooms.tick()
        t.rooms.tick()
        assertThat(nudges()).containsOnly(1)
        val decision = t.decision(t.actor()!!)
        t.step(Rng.seeded(2))
        assertThat(t.decision(t.actor()!!)).isNotEqualTo(decision)
        clock.advance(Duration.ofSeconds(60))
        t.rooms.tick()
        assertThat(nudges()).containsOnly(2)

        val quiet = Table()
        quiet.start()
        clock.advance(Duration.ofMinutes(10))
        quiet.rooms.tick()
        assertThat(quiet.tv.all<ServerMessage.Nudge>()).isEmpty()
    }

    // --- Restarts ---

    @Test
    fun `a restarted server restores rooms, games, case logs and sequence numbers`() {
        val t = Table()
        t.start()
        val rng = Rng.seeded(9)
        repeat(3) { t.step(rng) }
        val restarted = service()
        restarted.restore()
        assertThat(restarted.roomCount).isEqualTo(1)
        val again = FakeConnection("again")
        assertThat(restarted.attach(again, Hello(t.code, t.tokens.getValue(1)))).isTrue()
        assertThat(t.game(again)).isEqualTo(t.game(t.player(1)))
        assertThat(t.events(again)).isEqualTo(t.events(t.player(1)))
        restarted.handle(again, SetTimer(1, 60)) // seq 1 was the VIP's start: a repeat
        assertThat(again.sent.last()).isEqualTo(Ack(1))
        assertThat(again.last<ServerMessage.Room>().room.turnTimer).isNull()
    }

    @Test
    fun `games that can't be restored end gracefully, unknown lobby modes fall back to the default`() {
        val t = Table(players = listOf("Ann"))
        t.send(t.vip) { SetMode(it, "counter") }
        t.start()
        val withoutCounter = service(modeList = listOf(ErasedMode(ShadowDuel)))
        withoutCounter.restore()
        val tv = FakeConnection("tv2")
        withoutCounter.attach(tv, Hello(t.code, t.created.hostToken))
        val room = tv.last<ServerMessage.Room>().room
        assertThat(room.status).isEqualTo(RoomStatus.LOBBY)
        assertThat(room.mode).isEqualTo("killer_inspector")
        assertThat(room.lastResult).isEqualTo(RoundResult(1, ResultKind.RESTORE_FAILED))
        assertThat(tv.all<ServerMessage.Game>()).isEmpty()

        val other = Table()
        other.start()
        val stored = repo.rooms.getValue(other.code)
        repo.rooms[other.code] = stored.copy(room = stored.room.copy(game = stored.room.game!!.copy(schemaVersion = 99)))
        val newer = service()
        newer.restore()
        val tv3 = FakeConnection("tv3")
        newer.attach(tv3, Hello(other.code, other.created.hostToken))
        assertThat(tv3.last<ServerMessage.Room>().room.lastResult).isEqualTo(RoundResult(1, ResultKind.RESTORE_FAILED))
    }

    @Test
    fun `engine rejections map one to one onto refusals`() {
        assertThat(Rejection.entries.map(Refusal::of).map { it.name }).isEqualTo(Rejection.entries.map { it.name })
    }

    /** Records the config each game was started with. */
    private class SpyMode(private val delegate: AnyMode) : AnyMode by delegate {
        val configs = mutableListOf<JsonObject>()

        override fun setup(players: Int, config: JsonObject, seed: Long): AnyResult.Accepted =
            delegate.setup(players, config, seed).also { configs += config }
    }
}
