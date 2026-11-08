import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Command } from '../../net/roomSocket'
import type {
  Choice,
  CollapseOption,
  Line,
  PickOpt,
  RoomView,
  ShadowDuelView,
} from '../../protocol/generated'
import { Board, type ShiftControls } from '../Board'
import { direction } from '../motion'
import { GuideSheet } from '../Guide'
import { hasGuide } from '../guides'
import { SuspectCard } from '../SuspectCard'
import { suspectName } from '../suspects'
import { Dossier } from './Dossier'
import { canShift, choice, collapsePicks, readMoves, type DuelGame, type Moves } from './moves'
import { CaseLog, KillMeter, Outcome } from './parts'
import { promptText, yourPromptText } from './text'

/** The actions a side has, in the order its tabs show them. */
type Tab = 'kill' | 'accuse' | 'disguise' | 'exonerate' | 'shift' | 'collapse'

const ROLE_TABS = {
  killer: ['kill', 'disguise', 'shift', 'collapse'],
  inspector: ['accuse', 'exonerate', 'shift', 'collapse'],
} as const satisfies Record<string, readonly Tab[]>

/** What the player is doing on this decision. */
type Mode =
  | {
      readonly t: 'act'
      readonly tab: Tab
      readonly target?: number
      readonly shift?: { readonly line: Line; readonly by: number }
      readonly option?: CollapseOption
      readonly chosen: ReadonlyMap<number, number>
    }
  | { readonly t: 'pick'; readonly opt: PickOpt; readonly id?: number }
  | { readonly t: 'sent' }

function available(moves: Moves, tab: Tab): boolean {
  switch (tab) {
    case 'kill':
    case 'accuse':
      return moves.target?.action === tab
    case 'disguise':
    case 'exonerate':
      return moves.simple.includes(tab)
    case 'shift':
      return moves.shifts.length > 0
    case 'collapse':
      return moves.collapse !== undefined
  }
}

type Reason = 'opening' | 'kill' | 'accuse' | 'collapse' | 'deck' | 'other'

/** Why a tab's action can't be taken now, from what everyone can see. */
function unavailable(tab: Tab, view: ShadowDuelView): Reason {
  if (view.pending?.prompt === 'opening_kill') return 'opening'
  if (tab === 'kill' || tab === 'accuse' || tab === 'collapse') return tab
  if ((tab === 'disguise' || tab === 'exonerate') && view.deckCount === 0) return 'deck'
  return 'other'
}

function startTab(tab: Tab, moves: Moves): Mode {
  const options = tab === 'collapse' ? moves.collapse : undefined
  return {
    t: 'act',
    tab,
    option: options?.length === 1 ? options[0] : undefined,
    chosen: new Map(),
  }
}

/**
 * Where a new decision starts: the cards to pick from, or else Shift, whose arrows give nothing away. Kill
 * and Accuse light your neighbours, which would show anyone glancing at the phone roughly where you stand,
 * so they open by themselves only when nothing else can be done (the opening kill).
 */
function firstMode(moves: Moves, tabs: readonly Tab[]): Mode {
  if (moves.pick) return { t: 'pick', opt: moves.pick }
  const open = tabs.filter((tab) => available(moves, tab))
  const quiet = open.includes('shift')
    ? 'shift'
    : open.find((tab) => tab !== 'kill' && tab !== 'accuse')
  return startTab(quiet ?? open[0] ?? tabs[0], moves)
}

interface Props {
  readonly room: RoomView
  readonly duel: DuelGame
  readonly send: (command: Command) => void
  /** Changes with every refused command, so the controls come back after a refusal. */
  readonly refusalId: number
  /** The room's own buttons (end game, play again, leave), under the game's. */
  readonly footer: ReactNode
}

/**
 * A phone during a Shadow Duel. On their turn players choose an action from tabs (switching freely), see
 * on their copy of the board what it would touch, and confirm; spectators just follow along. Hidden
 * facts appear only in the held-open file.
 */
export function DuelPhone({ room, duel, send, refusalId, footer }: Props) {
  const { t, i18n } = useTranslation()
  const { view, events } = duel
  const me = view.me
  const pending = view.pending
  const decisionId =
    me !== undefined && pending?.actor === me.seat && view.outcome === undefined
      ? pending.id
      : undefined
  const myTurn = decisionId !== undefined
  const moves = readMoves(myTurn ? duel.legal : [])
  const again = moves.simple.includes('stop_collapsing')
  // Collapsing again is its own small decision: no tabs, just collapse or stop.
  const tabs: readonly Tab[] = again ? ['collapse'] : me ? ROLE_TABS[me.role] : []
  const key = `${pending?.id ?? '-'}:${refusalId}`
  const [intent, setIntent] = useState<{ key: string; mode: Mode }>({
    key,
    mode: firstMode(moves, tabs),
  })
  const [guide, setGuide] = useState(false)
  const [pickView, setPickView] = useState<'cards' | 'city'>('cards')
  // The round can end while the page is scrolled down to the board (a laptop shows only part of it), so
  // bring the verdict at the top into view.
  const over = view.outcome !== undefined
  useEffect(() => {
    if (!over) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
  }, [over])
  const mode = intent.key === key ? intent.mode : firstMode(moves, tabs)
  const setMode = (next: Mode) => setIntent({ key, mode: next })
  const name = (id: number) => suspectName(id, i18n.language)

  // Controls exist only on this player's own decision, so [decisionId] is set whenever this runs.
  const act = (c: Choice) => {
    send({ t: 'act', decisionId: decisionId as number, choice: c })
    setMode({ t: 'sent' })
  }

  if (guide) {
    return (
      <>
        <main className="room">
          <GuideSheet
            mode={room.mode}
            onClose={() => setGuide(false)}
            closeLabel={t('duel.backToGame')}
          />
        </main>
        <footer className="action-bar">{footer}</footer>
      </>
    )
  }

  const acting = myTurn && mode.t === 'act' ? mode : undefined
  const open = acting !== undefined && available(moves, acting.tab)
  const picking = myTurn && mode.t === 'pick' ? mode : undefined

  // What the board offers for the chosen action.
  let lit: ReadonlySet<number> | undefined
  let chosen: ReadonlySet<number> | undefined
  let onTile: ((id: number) => void) | undefined
  let shift: ShiftControls | undefined
  if (acting && open) {
    const tab = acting.tab
    if ((tab === 'kill' || tab === 'accuse') && moves.target) {
      lit = moves.target.ids
      chosen = acting.target === undefined ? undefined : new Set([acting.target])
      onTile = (id) => setMode({ ...acting, target: id })
    } else if (tab === 'shift') {
      shift = {
        can: (line, by) => canShift(moves, line, by),
        onShift: (line, by) => setMode({ ...acting, shift: { line, by } }),
        chosen: acting.shift,
      }
    } else if (tab === 'collapse' && acting.option) {
      const option = acting.option
      lit = new Set(option.lines.filter((line) => line.length > 1).flat())
      chosen = new Set(collapsePicks(option, acting.chosen).filter((id) => id !== undefined))
      onTile = (id) => {
        const line = option.lines.findIndex((l) => l.includes(id))
        setMode({ ...acting, chosen: new Map(acting.chosen).set(line, id) })
      }
    }
  } else if (picking) {
    lit = new Set(picking.opt.cards)
    chosen = picking.id === undefined ? undefined : new Set([picking.id])
    onTile = (id) => setMode({ ...picking, id })
  }

  function controls(): ReactNode {
    if (mode.t === 'sent') {
      return (
        <p className="action-bar__status" role="status">
          {t('duel.sent')}
        </p>
      )
    }
    if (mode.t === 'pick') {
      const { opt: pick, id } = mode
      if (id === undefined) return <p className="action-bar__status">{t('duel.pickHint')}</p>
      const action = pick.action as 'choose_identity' | 'exonerate_discard'
      return (
        <button type="button" className="button" onClick={() => act(choice.pick(action, id))}>
          {t(`duel.pick.${action}`, { name: name(id) })}
        </button>
      )
    }
    if (!open) return <p className="action-bar__status">{t('duel.chooseAction')}</p>
    const { tab } = mode
    switch (tab) {
      case 'kill':
      case 'accuse':
        return mode.target === undefined ? (
          <p className="action-bar__status">{t(`duel.pickTarget.${tab}`)}</p>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => act(choice.target(tab, mode.target as number))}
          >
            {t(`duel.confirmTarget.${tab}`, { name: name(mode.target) })}
          </button>
        )
      case 'disguise':
      case 'exonerate':
        return (
          <button type="button" className="button" onClick={() => act(choice.simple(tab))}>
            {t(`duel.action.${tab}`)}
          </button>
        )
      case 'shift': {
        if (!mode.shift) return <p className="action-bar__status">{t('duel.shiftHint')}</p>
        const { line, by } = mode.shift
        return (
          <button type="button" className="button" onClick={() => act(choice.shift(line, by))}>
            {t(`duel.shiftLine.${line.axis}`, {
              n: line.index + 1,
              dir: t(`duel.dir.${direction(line, by)}`),
            })}
          </button>
        )
      }
      case 'collapse': {
        const stop = again && (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => act(choice.simple('stop_collapsing'))}
          >
            {t('duel.action.stop_collapsing')}
          </button>
        )
        const option = mode.option
        if (!option) {
          return (
            <>
              <p className="action-bar__status">{t('duel.collapseWayHint')}</p>
              {stop}
            </>
          )
        }
        const picks = collapsePicks(option, mode.chosen)
        const missing = picks.filter((id) => id === undefined).length
        return (
          <>
            <p className="action-bar__status">
              {missing > 0 ? t('duel.collapsePick', { count: missing }) : t('duel.collapseReady')}
            </p>
            <button
              type="button"
              className="button"
              disabled={missing > 0}
              onClick={() => act(choice.collapse(option, picks as number[]))}
            >
              {t(again ? 'duel.action.collapseAgain' : 'duel.action.collapse')}
            </button>
            {stop}
          </>
        )
      }
    }
  }

  const board = (
    <Board
      size="phone"
      rows={view.board.rows}
      cols={view.board.cols}
      tiles={view.board.tiles}
      lit={lit}
      chosen={chosen}
      onTile={onTile}
      shift={shift}
    />
  )

  function pickCards(picking: Extract<Mode, { t: 'pick' }>): ReactNode {
    // A drawn card can name someone already dead (the inspector may still clear them): it keeps its X.
    const alive = new Set(view.board.tiles.filter((tile) => tile.alive).map((tile) => tile.id))
    return (
      <div className="pick" role="group" aria-label={t('duel.pickHint')}>
        {picking.opt.cards.map((id) => (
          <SuspectCard
            key={id}
            id={id}
            dead={!alive.has(id)}
            lit
            chosen={picking.id === id}
            onPick={() => setMode({ ...picking, id })}
          />
        ))}
      </div>
    )
  }

  /** The cards to choose from, or where they are in the city, by a switch; a choice shows in both. */
  /** The switch between the cards to choose from and where they are in the city. */
  function pickSwitch(): ReactNode {
    return (
      <fieldset className="segmented pick-view">
        <legend className="visually-hidden">{t('duel.pickOnBoard')}</legend>
        {(['cards', 'city'] as const).map((v) => (
          <label key={v} className="segmented__option">
            <input
              type="radio"
              name="pick-view"
              checked={pickView === v}
              onChange={() => setPickView(v)}
            />
            <span>{t(`duel.pickView.${v}`)}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <>
      {/* Three parts: one column on a phone, in this order; on a laptop the field (the board, or the cards
          to choose from) fills the left, and the top and the rest stand beside it. */}
      <main className="room duel-phone">
        <div className="duel-phone__top">
          {view.outcome ? (
            <Outcome room={room} view={view} outcome={view.outcome} />
          ) : (
            <div className="duel-phone__status">
              <p className="duel-phone__prompt" role="status">
                {myTurn ? yourPromptText(t, view) : promptText(t, room, view)}
              </p>
              {!me && <p className="hint">{t('duel.watching')}</p>}
            </div>
          )}
          {me && view.outcome === undefined && (
            <Dossier
              me={me}
              city={
                <Board
                  size="phone"
                  rows={view.board.rows}
                  cols={view.board.cols}
                  tiles={view.board.tiles}
                  mine={me.identity}
                  evidence={new Set(me.hand)}
                />
              }
            />
          )}
          {acting && (
            <section className="actions">
              {tabs.length > 1 && (
                <div className="actions__tabs" role="tablist" aria-label={t('duel.actions')}>
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      id={`action-${tab}`}
                      className="actions__tab"
                      aria-selected={tab === acting.tab}
                      aria-controls="action-panel"
                      data-off={!available(moves, tab) || undefined}
                      onClick={() => setMode(startTab(tab, moves))}
                    >
                      {t(`duel.action.${tab}`)}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="actions__panel"
                id="action-panel"
                role="tabpanel"
                aria-labelledby={`action-${acting.tab}`}
                data-off={!open || undefined}
              >
                <p>
                  {open
                    ? t(`duel.explain.${acting.tab}`)
                    : t(`duel.unavailable.${unavailable(acting.tab, view)}`)}
                </p>
                {open && acting.tab === 'collapse' && !acting.option && (
                  <div className="actions__ways">
                    {(moves.collapse ?? []).map((o) => (
                      <button
                        key={o.direction}
                        type="button"
                        className="button button--quiet"
                        onClick={() => setMode({ ...acting, option: o })}
                      >
                        {t(`duel.collapseWay.${o.direction}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
          {picking && pickSwitch()}
        </div>
        <div className="duel-phone__field">
          {picking && pickView === 'cards' ? pickCards(picking) : board}
        </div>
        <div className="duel-phone__rest">
          <KillMeter view={view} />
          <CaseLog room={room} events={events} limit={4} publicOnly />
          {me && (
            <details className="help-now">
              <summary>{t('duel.helpNow')}</summary>
              <dl>
                {ROLE_TABS[me.role].map((action) => (
                  <div key={action}>
                    <dt>{t(`duel.action.${action}`)}</dt>
                    <dd>{t(`duel.explain.${action}`)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {hasGuide(room.mode) && (
            <button type="button" className="button button--quiet" onClick={() => setGuide(true)}>
              {t('duel.howToPlay')}
            </button>
          )}
          {view.outcome === undefined && <div className="duel-phone__room">{footer}</div>}
        </div>
      </main>
      <footer className="action-bar">
        {myTurn && <div className="duel-controls">{controls()}</div>}
        {view.outcome !== undefined && footer}
      </footer>
    </>
  )
}
