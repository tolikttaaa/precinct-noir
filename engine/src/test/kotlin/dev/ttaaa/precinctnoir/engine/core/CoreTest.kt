package dev.ttaaa.precinctnoir.engine.core

import dev.ttaaa.precinctnoir.engine.core.board.Axis
import dev.ttaaa.precinctnoir.engine.core.board.CollapseDirection
import dev.ttaaa.precinctnoir.engine.core.board.CollapseOption
import dev.ttaaa.precinctnoir.engine.core.board.Line
import dev.ttaaa.precinctnoir.engine.core.board.Pos
import dev.ttaaa.precinctnoir.engine.core.board.Quadrant
import dev.ttaaa.precinctnoir.engine.core.board.ShiftMove
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret
import dev.ttaaa.precinctnoir.engine.core.cards.replace
import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.engine.core.flow.Agenda
import dev.ttaaa.precinctnoir.engine.core.flow.GameState
import dev.ttaaa.precinctnoir.engine.core.flow.Outcome
import dev.ttaaa.precinctnoir.engine.core.flow.Pending
import dev.ttaaa.precinctnoir.engine.core.flow.PendingKind
import dev.ttaaa.precinctnoir.engine.core.ids.Roster
import dev.ttaaa.precinctnoir.engine.core.ids.Seat
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import dev.ttaaa.precinctnoir.engine.core.legal.Choice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseChoice
import dev.ttaaa.precinctnoir.engine.core.legal.CollapseOpt
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.legal.PairChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PairOpt
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SquareChoice
import dev.ttaaa.precinctnoir.engine.core.legal.SquareOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SuspectPair
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetOpt
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMove
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TokenMoveOpt
import dev.ttaaa.precinctnoir.engine.core.legal.VaultChoice
import dev.ttaaa.precinctnoir.engine.core.legal.VaultOpt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.persist.Migration
import dev.ttaaa.precinctnoir.engine.core.persist.Migrations
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.rng.RngState
import dev.ttaaa.precinctnoir.engine.core.rules.EvidencePlacement
import dev.ttaaa.precinctnoir.engine.core.rules.IdentityDraw
import dev.ttaaa.precinctnoir.engine.core.rules.Queries
import dev.ttaaa.precinctnoir.engine.core.view.BoardView
import dev.ttaaa.precinctnoir.engine.core.view.PendingView
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.testing.Arbs
import dev.ttaaa.precinctnoir.engine.testing.BoardAscii
import dev.ttaaa.precinctnoir.engine.testing.CardLedger
import dev.ttaaa.precinctnoir.engine.testing.isSatisfiable
import dev.ttaaa.precinctnoir.engine.testing.sample
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.property.Arb
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

private fun ids(vararg values: Int) = values.map(::SuspectId)

class CoreTest : FunSpec({

    context("ids and roster") {
        test("suspect ids stay inside the roster and seats are non-negative") {
            shouldThrow<IllegalArgumentException> { SuspectId(-1) }
            shouldThrow<IllegalArgumentException> { SuspectId(Roster.SIZE) }
            shouldThrow<IllegalArgumentException> { Seat(-1) }
            SuspectId(7).toString() shouldBe "S7"
            Seat(1).toString() shouldBe "Seat1"
            (SuspectId(3) < SuspectId(10)).shouldBeTrue()
        }

        test("shared/roster.json lists exactly ids 0 until Roster.SIZE, with unique names and both genders") {
            val root = System.getProperty("precinctnoir.repoRoot") ?: ".."
            val roster = EngineJson.parseToJsonElement(File(root, "shared/roster.json").readText()) as JsonObject
            val suspects = (roster["suspects"] as kotlinx.serialization.json.JsonArray).map { it as JsonObject }
            suspects.map { it["id"]!!.jsonPrimitive.int } shouldContainExactly (0..<Roster.SIZE).toList()
            suspects.map { it["name"]!!.jsonPrimitive.content }.toSet().size shouldBe Roster.SIZE
            suspects.groupingBy { it["gender"]!!.jsonPrimitive.content }.eachCount() shouldBe mapOf("f" to 30, "m" to 30)
        }
    }

    context("cards") {
        test("draw, drawN and putBottom work from the top") {
            val deck = Deck(ids(1, 2, 3))
            deck.draw() shouldBe (SuspectId(1) to Deck(ids(2, 3)))
            deck.drawN(2) shouldBe (ids(1, 2) to Deck(ids(3)))
            deck.drawN(0).first.shouldBeEmpty()
            deck.putBottom(SuspectId(9)) shouldBe Deck(ids(1, 2, 3, 9))
            deck.size shouldBe 3
            Deck().isEmpty().shouldBeTrue()
            shouldThrow<IllegalArgumentException> { Deck().draw() }
            shouldThrow<IllegalArgumentException> { deck.drawN(4) }
            shouldThrow<IllegalArgumentException> { Deck(ids(1, 1)) }
        }

        test("shuffleIn keeps every card and is deterministic per seed") {
            checkAll(Arb.long()) { seed ->
                val shuffled = Deck(ids(1, 2, 3)).shuffleIn(ids(4, 5), Rng.seeded(seed))
                shuffled.cards.sorted() shouldBe ids(1, 2, 3, 4, 5)
                Deck(ids(1, 2, 3)).shuffleIn(ids(4, 5), Rng.seeded(seed)) shouldBe shuffled
            }
        }

        test("replace swaps one seat's secret") {
            listOf(PlayerSecret(), PlayerSecret()).replace(Seat(1), PlayerSecret(SuspectId(4))) shouldBe
                listOf(PlayerSecret(), PlayerSecret(SuspectId(4)))
        }

        test("the card ledger catches duplicates and missing cards") {
            CardLedger.assertEachCardOnce(ids(1, 2), mapOf("deck" to ids(1), "hand" to ids(2)))
            shouldThrow<AssertionError> { CardLedger.assertEachCardOnce(ids(1, 2), mapOf("deck" to ids(1, 2), "hand" to ids(2))) }
            shouldThrow<AssertionError> { CardLedger.assertEachCardOnce(ids(1, 2), mapOf("deck" to ids(1))) }
        }
    }

    context("rule helpers") {
        val board = BoardAscii.parse("0 1x 2", removed = listOf(9))

        test("evidence placement: alive is placed and asked; dead on board asked only with KI-2; removed never") {
            EvidencePlacement.place(board, SuspectId(0), true).let {
                it.placed.shouldBeTrue(); it.interrogate.shouldBeTrue(); it.board.tile(SuspectId(0))!!.exonerated.shouldBeTrue()
            }
            EvidencePlacement.place(board, SuspectId(1), true).let { it.placed.shouldBeFalse(); it.interrogate.shouldBeTrue(); it.board shouldBe board }
            EvidencePlacement.place(board, SuspectId(1), false).interrogate.shouldBeFalse()
            EvidencePlacement.place(board, SuspectId(9), true).let { it.placed.shouldBeFalse(); it.interrogate.shouldBeFalse() }
        }

        test("drawLiving skips dead and removed suspects and reports running out") {
            IdentityDraw.drawLiving(Deck(ids(1, 9, 2, 0)), board) shouldBe IdentityDraw.Result(SuspectId(2), ids(1, 9), Deck(ids(0)))
            IdentityDraw.drawLiving(Deck(ids(1, 9)), board) shouldBe IdentityDraw.Result(null, ids(1, 9), Deck())
        }

        test("queries answer adjacency truthfully; nobody is next to themselves") {
            Queries.isNextTo(board, SuspectId(0), SuspectId(1)).shouldBeTrue()
            Queries.isNextTo(board, SuspectId(0), SuspectId(2)).shouldBeFalse()
            Queries.isNextTo(board, SuspectId(1), SuspectId(1)).shouldBeFalse()
            Queries.seatsNextTo(board, listOf(Seat(2) to SuspectId(2), Seat(0) to SuspectId(0), Seat(1) to null), SuspectId(1)) shouldBe
                listOf(Seat(0), Seat(2))
        }
    }

    context("options") {
        val a = SuspectId(1)
        val b = SuspectId(2)
        val line = Line(Axis.ROW, 0)
        val options: List<Pair<Opt, Choice>> = listOf(
            SimpleOpt("go") to SimpleChoice("go"),
            ShiftOpt("shift", listOf(ShiftMove(line, 1))) to ShiftChoice("shift", line, 1),
            CollapseOpt("collapse", listOf(CollapseOption(CollapseDirection.ROWS, listOf(listOf(a, b))))) to
                CollapseChoice("collapse", CollapseDirection.ROWS, listOf(b)),
            TargetOpt("kill", listOf(a)) to TargetChoice("kill", a),
            PairOpt("swap", listOf(SuspectPair.of(b, a))) to PairChoice("swap", b, a),
            PickOpt("pick", listOf(a, b), 1, 2) to PickChoice("pick", listOf(b, a)),
            TokenMoveOpt("prepare", listOf(TokenMove(TokenKind.BOMB, a, b))) to TokenMoveChoice("prepare", TokenKind.BOMB, a, b),
            SquareOpt("search", 4, listOf(Pos(0, 0))) to SquareChoice("search", Pos(0, 0)),
            VaultOpt("rob", listOf(Quadrant.NE)) to VaultChoice("rob", Quadrant.NE),
        )

        test("each option accepts its own choice and nothing else") {
            for ((opt, choice) in options) {
                opt.accepts(choice).shouldBeTrue()
                opt.isSatisfiable().shouldBeTrue()
                options.filter { it.second != choice }.forEach { (_, other) -> opt.accepts(other).shouldBeFalse() }
            }
        }

        test("options reject wrong parameters and wrong action names") {
            ShiftOpt("shift", listOf(ShiftMove(line, 1))).accepts(ShiftChoice("shift", line, -1)).shouldBeFalse()
            CollapseOpt("collapse", listOf(CollapseOption(CollapseDirection.ROWS, listOf(listOf(a))))).let {
                it.accepts(CollapseChoice("collapse", CollapseDirection.COLUMNS, listOf(a))).shouldBeFalse()
                it.accepts(CollapseChoice("collapse", CollapseDirection.ROWS, listOf(b))).shouldBeFalse()
                it.accepts(CollapseChoice("collapse", CollapseDirection.ROWS, listOf(a, a))).shouldBeFalse()
                it.accepts(CollapseChoice("other", CollapseDirection.ROWS, listOf(a))).shouldBeFalse()
            }
            TargetOpt("kill", listOf(a)).accepts(TargetChoice("kill", b)).shouldBeFalse()
            TargetOpt("kill", listOf(a)).accepts(TargetChoice("accuse", a)).shouldBeFalse()
            PairOpt("swap", listOf(SuspectPair.of(a, b))).accepts(PairChoice("swap", a, a)).shouldBeFalse()
            PickOpt("pick", listOf(a, b), 1, 1).let {
                it.accepts(PickChoice("pick", emptyList())).shouldBeFalse()
                it.accepts(PickChoice("pick", listOf(a, b))).shouldBeFalse()
                it.accepts(PickChoice("pick", listOf(SuspectId(3)))).shouldBeFalse()
            }
            PickOpt("pick", listOf(a, b), 2, 2).accepts(PickChoice("pick", listOf(a, a))).shouldBeFalse()
            SimpleOpt("go").accepts(SimpleChoice("stop")).shouldBeFalse()
            shouldThrow<IllegalArgumentException> { PickOpt("pick", listOf(a), 2, 1) }
            shouldThrow<IllegalArgumentException> { SuspectPair(b, a) }
        }

        test("empty options are not satisfiable, so a mode must not offer them") {
            listOf(
                ShiftOpt("s", emptyList()), CollapseOpt("c", emptyList()), TargetOpt("t", emptyList()), PairOpt("p", emptyList()),
                PickOpt("k", emptyList(), 1, 1), TokenMoveOpt("m", emptyList()), SquareOpt("q", 4, emptyList()), VaultOpt("v", emptyList()),
                CollapseOpt("c", listOf(CollapseOption(CollapseDirection.ROWS, listOf(emptyList())))),
            ).forEach { it.isSatisfiable().shouldBeFalse() }
        }

        test("sampled choices are always accepted") {
            checkAll(Arb.long()) { seed ->
                val rng = Rng.seeded(seed)
                options.forEach { (opt, _) -> opt.accepts(opt.sample(rng)).shouldBeTrue() }
            }
        }

        test("options and choices round-trip through JSON with a 't' discriminator") {
            val opts = options.map { it.first }
            val json = EngineJson.encodeToString(ListSerializer(Opt.serializer()), opts)
            json shouldContain """"t":"token_move""""
            EngineJson.decodeFromString(ListSerializer(Opt.serializer()), json) shouldBe opts
            val choices = options.map { it.second }
            EngineJson.decodeFromString(ListSerializer(Choice.serializer()), EngineJson.encodeToString(ListSerializer(Choice.serializer()), choices)) shouldBe choices
        }
    }

    context("flow") {
        val pending = Pending(1, Seat(0), PendingKind.TURN, "turn")

        test("a game at rest has a pending decision xor an outcome, and no steps once over") {
            GameState(0, RngState(1), Agenda<Int>(pending = pending), model = "m").outcome.shouldBeNull()
            GameState(0, RngState(1), Agenda<Int>(), Outcome(listOf(Seat(0)), "won"), "m").agenda.pending.shouldBeNull()
            shouldThrow<IllegalArgumentException> { GameState(0, RngState(1), Agenda<Int>(), model = "m") }
            shouldThrow<IllegalArgumentException> { GameState(0, RngState(1), Agenda<Int>(pending = pending), Outcome(emptyList(), "x"), "m") }
            shouldThrow<IllegalArgumentException> { GameState(0, RngState(1), Agenda(listOf(1)), Outcome(emptyList(), "x"), "m") }
        }

        test("pending kinds and views serialize with stable lowercase names") {
            EngineJson.encodeToString(PendingView.of(pending)) shouldBe """{"id":1,"actor":0,"kind":"turn","prompt":"turn"}"""
            PendingKind.entries.map { EngineJson.encodeToString(it) } shouldBe
                listOf("\"setup\"", "\"turn\"", "\"substep\"", "\"trigger\"", "\"reaction\"", "\"forced\"")
        }
    }

    context("views and audiences") {
        test("a board view rebuilds exactly the board it was made from") {
            checkAll(Arbs.board()) { board -> BoardView.of(board).toBoard() shouldBe board }
        }

        test("public events reach everyone; player and team events only their audience") {
            val teams = mapOf(Seat(0) to 1, Seat(1) to 2)
            val alice = Viewer.Player(Seat(0))
            val bob = Viewer.Player(Seat(1))
            Audience.Public.visibleTo(Viewer.Spectator, teams::get).shouldBeTrue()
            Audience.ToPlayer(Seat(0)).visibleTo(alice, teams::get).shouldBeTrue()
            Audience.ToPlayer(Seat(0)).visibleTo(bob, teams::get).shouldBeFalse()
            Audience.ToPlayer(Seat(0)).visibleTo(Viewer.Spectator, teams::get).shouldBeFalse()
            Audience.ToTeam(1).visibleTo(alice, teams::get).shouldBeTrue()
            Audience.ToTeam(1).visibleTo(bob, teams::get).shouldBeFalse()
            Audience.ToTeam(1).visibleTo(Viewer.Spectator, teams::get).shouldBeFalse()
        }
    }

    context("persistence") {
        val json = buildJsonObject { put("v", JsonPrimitive(1)) }
        val bump = { from: Int -> Migration(from) { JsonObject(it + ("v" to JsonPrimitive(from + 1))) } }

        test("migrations run in order from the stored schema to the current one") {
            Migrations.upgrade(json, 1, 3, listOf(bump(2), bump(1)))["v"]!!.jsonPrimitive.int shouldBe 3
            Migrations.upgrade(json, 2, 2, emptyList()) shouldBe json
        }

        test("a missing step or a snapshot from a newer engine is refused") {
            shouldThrow<IllegalArgumentException> { Migrations.upgrade(json, 1, 3, listOf(bump(1))) }
            shouldThrow<IllegalArgumentException> { Migrations.upgrade(json, 4, 3, emptyList()) }
            shouldThrow<IllegalArgumentException> { Migrations.upgrade(json, 0, 3, emptyList()) }
        }

        test("the engine JSON is strict, writes defaults and omits nulls") {
            EngineJson.encodeToString(PlayerSecret()) shouldBe """{"hand":[]}"""
            shouldThrow<IllegalArgumentException> { EngineJson.decodeFromString<PlayerSecret>("""{"hand":[],"extra":1}""") }
        }
    }
})
