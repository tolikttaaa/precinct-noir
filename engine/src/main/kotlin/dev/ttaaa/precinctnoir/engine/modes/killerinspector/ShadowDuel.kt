package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.api.ConfigOption
import dev.ttaaa.precinctnoir.engine.core.api.ConfigSpec
import dev.ttaaa.precinctnoir.engine.core.api.FlowMode
import dev.ttaaa.precinctnoir.engine.core.api.ModeSerializers
import dev.ttaaa.precinctnoir.engine.core.api.Tx
import dev.ttaaa.precinctnoir.engine.core.board.Board
import dev.ttaaa.precinctnoir.engine.core.board.ShiftMove
import dev.ttaaa.precinctnoir.engine.core.board.Tile
import dev.ttaaa.precinctnoir.engine.core.cards.Deck
import dev.ttaaa.precinctnoir.engine.core.cards.PlayerSecret
import dev.ttaaa.precinctnoir.engine.core.cards.replace
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
import dev.ttaaa.precinctnoir.engine.core.legal.CommonActions
import dev.ttaaa.precinctnoir.engine.core.legal.Opt
import dev.ttaaa.precinctnoir.engine.core.legal.PickChoice
import dev.ttaaa.precinctnoir.engine.core.legal.PickOpt
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftChoice
import dev.ttaaa.precinctnoir.engine.core.legal.ShiftOpt
import dev.ttaaa.precinctnoir.engine.core.legal.SimpleOpt
import dev.ttaaa.precinctnoir.engine.core.legal.TargetChoice
import dev.ttaaa.precinctnoir.engine.core.legal.TargetOpt
import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.core.persist.Migration
import dev.ttaaa.precinctnoir.engine.core.rng.Rng
import dev.ttaaa.precinctnoir.engine.core.rules.EvidencePlacement
import dev.ttaaa.precinctnoir.engine.core.rules.Queries
import dev.ttaaa.precinctnoir.engine.core.view.BoardView
import dev.ttaaa.precinctnoir.engine.core.view.PendingView
import dev.ttaaa.precinctnoir.engine.core.view.Viewer
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Accused
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.CardsDrawn
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Collapsed
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Disguised
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Exonerated
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.GameOver
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.GameStarted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.IdentityChosen
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Killed
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Nudged
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.Shifted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.TurnStarted
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.YouDrew
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent.YourIdentity
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelStep.BeginTurn
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelStep.EndTurn
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelStep.Start
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

private typealias DuelTx = Tx<ShadowDuelModel, ShadowDuelStep, ShadowDuelEvent>

/** Shadow Duel (internal id `killer_inspector`): a Killer hides in the crowd, an Inspector hunts them. See docs/RULES.md §2. */
object ShadowDuel : FlowMode<ShadowDuelModel, ShadowDuelStep, ShadowDuelEvent, ShadowDuelView>() {
    const val SIZE = 5
    const val KILLS_TO_WIN = 14
    const val INSPECTOR_OPENING_DRAW = 4

    /** Pending-decision prompts (public i18n keys). */
    object Prompts {
        const val OPENING_KILL = "opening_kill"
        const val CHOOSE_IDENTITY = "choose_identity"
        const val TURN = "turn"
        const val EXONERATE_DISCARD = "exonerate_discard"
        const val COLLAPSE_MORE = "collapse_more"
    }

    object Actions {
        const val SHIFT = CommonActions.SHIFT
        const val COLLAPSE = CommonActions.COLLAPSE
        const val STOP_COLLAPSING = CommonActions.STOP_COLLAPSING
        const val KILL = "kill"
        const val DISGUISE = "disguise"
        const val ACCUSE = "accuse"
        const val EXONERATE = "exonerate"
        const val EXONERATE_DISCARD = "exonerate_discard"
        const val CHOOSE_IDENTITY = "choose_identity"
    }

    object Reasons {
        const val INSPECTOR_ELIMINATED = "inspector_eliminated"
        const val KILL_QUOTA = "kill_quota"
        const val KILLER_CAUGHT = "killer_caught"
    }

    override val id: String = "killer_inspector"
    override val schemaVersion: Int = 1
    override val players: IntRange = 2..2
    override val configSpec: ConfigSpec = ConfigSpec(listOf(ConfigOption.Toggle("interrogateDeadOnBoard", default = true)))
    override val serializers = ModeSerializers(
        ShadowDuelModel.serializer(),
        ShadowDuelStep.serializer(),
        ShadowDuelEvent.serializer(),
        ShadowDuelView.serializer(),
    )
    override val migrations: List<Migration> = emptyList()

    override fun begin(players: Int, config: JsonObject, rng: Rng): ShadowDuelModel {
        val settings = EngineJson.decodeFromJsonElement(ShadowDuelConfig.serializer(), config)
        settings.killerSeat?.let { require(it in 0..1) { "killerSeat must be 0 or 1, got $it" } }
        val suspects = rng.shuffled((0..<Roster.SIZE).map(::SuspectId)).take(SIZE * SIZE)
        val (identity, deck) = Deck(rng.shuffled(suspects)).draw()
        val killer = Seat(settings.killerSeat ?: rng.nextInt(2))
        return ShadowDuelModel(
            config = settings,
            killer = killer,
            board = Board.of(SIZE, SIZE, suspects),
            deck = deck,
            secrets = List(2) { if (it == killer.index) PlayerSecret(identity) else PlayerSecret() },
        )
    }

    override fun firstSteps(model: ShadowDuelModel): List<ShadowDuelStep> = listOf(Start, BeginTurn(model.killer))

    override fun run(tx: DuelTx, step: ShadowDuelStep) {
        when (step) {
            Start -> {
                tx.public(GameStarted(tx.model.killer, tx.model.inspector))
                tx.toPlayer(tx.model.killer, YourIdentity(tx.model.killerIdentity))
            }
            is BeginTurn -> beginTurn(tx, step.seat)
            is EndTurn -> {
                tx.model = tx.model.copy(turn = tx.model.turn + 1)
                tx.push(BeginTurn(if (step.seat == tx.model.killer) tx.model.inspector else tx.model.killer))
            }
        }
    }

    override fun resolve(tx: DuelTx, pending: Pending, choice: Choice) {
        val seat = pending.actor
        when (choice.action) {
            Actions.SHIFT -> shift(tx, seat, (choice as ShiftChoice).let { ShiftMove(it.line, it.by) })
            Actions.COLLAPSE -> collapse(tx, seat, choice as CollapseChoice)
            Actions.STOP_COLLAPSING -> tx.push(EndTurn(seat))
            Actions.KILL -> kill(tx, seat, (choice as TargetChoice).target)
            Actions.DISGUISE -> disguise(tx, seat)
            Actions.ACCUSE -> accuse(tx, seat, (choice as TargetChoice).target)
            Actions.EXONERATE -> drawForExonerate(tx, seat)
            Actions.EXONERATE_DISCARD -> exonerate(tx, seat, (choice as PickChoice).cards.single())
            Actions.CHOOSE_IDENTITY -> chooseIdentity(tx, seat, (choice as PickChoice).cards.single())
            else -> error("no rule for action ${choice.action}")
        }
    }

    override fun nudged(seat: Seat): ShadowDuelEvent = Nudged(seat)

    /** "Play again" swaps roles: the Inspector becomes the Killer. */
    override fun rematchConfig(state: GameState<ShadowDuelModel, ShadowDuelStep>): JsonObject =
        buildJsonObject { put("killerSeat", JsonPrimitive(state.model.inspector.index)) }

    override fun project(state: GameState<ShadowDuelModel, ShadowDuelStep>, viewer: Viewer): ShadowDuelView {
        val m = state.model
        val mine = (viewer as? Viewer.Player)?.seat?.takeIf { it in m.seats }
        return ShadowDuelView(
            board = BoardView.of(m.board),
            deckCount = m.deck.size,
            discard = m.discard,
            outOfPlay = m.outOfPlay,
            seats = m.seats.map { SeatView(it, m.roleOf(it), m.secret(it).hand.size) },
            kills = m.kills,
            killsToWin = KILLS_TO_WIN,
            turn = m.turn,
            lastShift = m.lastShift,
            interrogateDeadOnBoard = m.config.interrogateDeadOnBoard,
            pending = state.agenda.pending?.let(PendingView::of),
            outcome = state.outcome,
            me = mine?.let { MeView(it, m.roleOf(it), m.secret(it).identity, m.secret(it).hand) },
            reveal = state.outcome?.let { reveal(m) },
        )
    }

    override fun legalFor(view: ShadowDuelView): List<Opt> {
        val me = view.me ?: return emptyList()
        val pending = view.pending?.takeIf { it.actor == me.seat } ?: return emptyList()
        val board = view.board.toBoard()
        return when (pending.prompt) {
            Prompts.OPENING_KILL -> listOfNotNull(killOpt(board, checkNotNull(me.identity)))
            Prompts.CHOOSE_IDENTITY -> listOf(PickOpt(Actions.CHOOSE_IDENTITY, me.hand.filter(board::isAlive), 1, 1))
            Prompts.EXONERATE_DISCARD -> listOf(PickOpt(Actions.EXONERATE_DISCARD, me.hand, 1, 1))
            Prompts.COLLAPSE_MORE -> listOf(CollapseOpt(Actions.COLLAPSE, board.collapseOptions()), SimpleOpt(Actions.STOP_COLLAPSING))
            else -> turnOptions(view, board, me.role, checkNotNull(me.identity))
        }
    }

    private fun turnOptions(view: ShadowDuelView, board: Board, role: Role, identity: SuspectId): List<Opt> = buildList {
        board.shiftMoves(1, view.lastShift).takeIf { it.isNotEmpty() }?.let { add(ShiftOpt(Actions.SHIFT, it)) }
        board.collapseOptions().takeIf { it.isNotEmpty() }?.let { add(CollapseOpt(Actions.COLLAPSE, it)) }
        val hasDeck = view.deckCount > 0 // KI-1: Disguise and Exonerate need a card to draw
        if (role == Role.KILLER) {
            killOpt(board, identity)?.let(::add)
            if (hasDeck) add(SimpleOpt(Actions.DISGUISE))
        } else {
            // Accuse a living suspect in N[me]; accusing yourself is a legal bluff (KI-4: living only).
            add(TargetOpt(Actions.ACCUSE, board.closedNeighbors(identity).filter(board::isAlive)))
            if (hasDeck) add(SimpleOpt(Actions.EXONERATE))
        }
    }

    /** Kill a living suspect in N(Killer) (KI-4). Absent when nobody is in reach. */
    private fun killOpt(board: Board, identity: SuspectId): TargetOpt? =
        board.neighbors(identity).filter(board::isAlive).takeIf { it.isNotEmpty() }?.let { TargetOpt(Actions.KILL, it) }

    private fun beginTurn(tx: DuelTx, seat: Seat) {
        val m = tx.model
        tx.public(TurnStarted(seat, m.turn))
        when {
            seat == m.killer && m.turn == 1 -> tx.await(seat, PendingKind.TURN, Prompts.OPENING_KILL)
            seat == m.inspector && m.inspectorIdentity == null -> {
                val (cards, deck) = m.deck.drawN(INSPECTOR_OPENING_DRAW)
                tx.model = m.copy(deck = deck, secrets = m.secrets.replace(seat, PlayerSecret(hand = cards)))
                tx.public(CardsDrawn(seat, cards.size))
                tx.toPlayer(seat, YouDrew(cards))
                tx.await(seat, PendingKind.SETUP, Prompts.CHOOSE_IDENTITY)
            }
            else -> tx.await(seat, PendingKind.TURN, Prompts.TURN)
        }
    }

    private fun shift(tx: DuelTx, seat: Seat, move: ShiftMove) {
        val m = tx.model
        tx.model = m.copy(board = m.board.shift(move), lastShift = m.board.record(move))
        tx.public(Shifted(seat, move.line, move.by))
        tx.push(EndTurn(seat))
    }

    private fun collapse(tx: DuelTx, seat: Seat, choice: CollapseChoice) {
        val m = tx.model
        // KI-8: an exoneration card on a removed suspect leaves play.
        val exonerated = m.board.cells.filter(Tile::exonerated).map(Tile::id).toSet()
        val leavingPlay = choice.picks.filter { it in exonerated }
        tx.model = m.copy(
            board = m.board.collapse(choice.direction, choice.picks),
            outOfPlay = m.outOfPlay + leavingPlay,
            lastShift = null,
        )
        tx.public(Collapsed(seat, choice.direction, choice.picks))
        if (tx.model.board.collapseOptions().isNotEmpty()) {
            tx.await(seat, PendingKind.SUBSTEP, Prompts.COLLAPSE_MORE)
        } else {
            tx.push(EndTurn(seat))
        }
    }

    private fun kill(tx: DuelTx, seat: Seat, victim: SuspectId) {
        val m = tx.model
        val board = m.board.kill(victim)
        val kills = m.kills + 1
        val inspectorIdentity = m.inspectorIdentity
        // KI-7: killing an exonerated suspect (even the Killer's own old disguise) asks about the Inspector.
        val victimExonerated = board.tileAt(board.requirePos(victim)).exonerated
        val inspectorAdjacent = inspectorIdentity
            ?.takeIf { victimExonerated }
            ?.let { Queries.isNextTo(board, it, victim) }
        tx.model = m.copy(board = board, kills = kills, lastShift = null)
        tx.public(Killed(seat, victim, kills, inspectorAdjacent))
        when {
            victim == inspectorIdentity -> win(tx, m.killer, Reasons.INSPECTOR_ELIMINATED)
            kills >= KILLS_TO_WIN -> win(tx, m.killer, Reasons.KILL_QUOTA) // KI-6: the opening kill counts
            else -> tx.push(EndTurn(seat))
        }
    }

    private fun disguise(tx: DuelTx, seat: Seat) {
        val m = tx.model
        val (card, deck) = m.deck.draw()
        if (m.board.isAlive(card)) {
            val old = m.killerIdentity
            tx.model = m.copy(
                deck = deck,
                board = m.board.exonerate(old),
                secrets = m.secrets.replace(seat, PlayerSecret(card)),
                lastShift = null,
            )
            tx.public(Disguised(seat, exonerated = old))
            tx.toPlayer(seat, YourIdentity(card))
        } else {
            tx.model = m.copy(deck = deck, discard = m.discard + card, lastShift = null)
            tx.public(Disguised(seat, discarded = card))
        }
        tx.push(EndTurn(seat))
    }

    private fun accuse(tx: DuelTx, seat: Seat, target: SuspectId) {
        val m = tx.model
        val correct = target == m.killerIdentity
        tx.model = m.copy(lastShift = null)
        tx.public(Accused(seat, target, correct))
        if (correct) win(tx, m.inspector, Reasons.KILLER_CAUGHT) else tx.push(EndTurn(seat))
    }

    private fun drawForExonerate(tx: DuelTx, seat: Seat) {
        val m = tx.model
        val (card, deck) = m.deck.draw()
        val secret = m.secret(seat)
        tx.model = m.copy(deck = deck, secrets = m.secrets.replace(seat, secret.copy(hand = secret.hand + card)), lastShift = null)
        tx.public(CardsDrawn(seat, 1))
        tx.toPlayer(seat, YouDrew(listOf(card)))
        tx.await(seat, PendingKind.SUBSTEP, Prompts.EXONERATE_DISCARD)
    }

    private fun exonerate(tx: DuelTx, seat: Seat, card: SuspectId) {
        val m = tx.model
        val placement = EvidencePlacement.place(m.board, card, m.config.interrogateDeadOnBoard)
        val killerAdjacent = if (placement.interrogate) Queries.isNextTo(m.board, m.killerIdentity, card) else null
        val secret = m.secret(seat)
        tx.model = m.copy(
            board = placement.board,
            discard = if (placement.placed) m.discard else m.discard + card,
            secrets = m.secrets.replace(seat, secret.copy(hand = secret.hand - card)),
        )
        tx.public(Exonerated(seat, card, placement.placed, killerAdjacent))
        tx.push(EndTurn(seat))
    }

    private fun chooseIdentity(tx: DuelTx, seat: Seat, card: SuspectId) {
        val m = tx.model
        tx.model = m.copy(secrets = m.secrets.replace(seat, PlayerSecret(card, m.secret(seat).hand - card)), lastShift = null)
        tx.public(IdentityChosen(seat))
        tx.toPlayer(seat, YourIdentity(card))
        tx.push(EndTurn(seat))
    }

    private fun win(tx: DuelTx, winner: Seat, reason: String) {
        val outcome = Outcome(listOf(winner), reason)
        tx.finish(outcome)
        tx.public(GameOver(outcome, reveal(tx.model)))
    }

    private fun reveal(m: ShadowDuelModel): Reveal =
        Reveal(m.seats.map { SeatReveal(it, m.roleOf(it), m.secret(it).identity, m.secret(it).hand) })
}
