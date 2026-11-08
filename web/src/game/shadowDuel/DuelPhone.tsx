import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Command } from '../../net/roomSocket'
import type { Choice, CollapseOption, Line, PickOpt, RoomView } from '../../protocol/generated'
import { Board, type ShiftControls } from '../Board'
import { direction } from '../motion'
import { GuideSheet } from '../Guide'
import { hasGuide } from '../guides'
import { SuspectCard } from '../SuspectCard'
import { suspectName } from '../suspects'
import { Dossier } from './Dossier'
import {
  canShift,
  choice,
  collapsePicks,
  readMoves,
  type DuelGame,
  type Moves,
  type TargetAction,
} from './moves'
import { CaseLog, KillMeter, Outcome } from './parts'
import { promptText, yourPromptText } from './text'

/** What the player is doing on this decision. Each mode carries the options it was started with. */
type Mode =
  | { readonly t: 'idle' }
  | {
      readonly t: 'target'
      readonly action: TargetAction
      readonly ids: ReadonlySet<number>
      readonly id?: number
    }
  | { readonly t: 'shift'; readonly line: Line; readonly by: number }
  | { readonly t: 'simple'; readonly action: SimpleAction }
  | {
      readonly t: 'collapse'
      readonly options: readonly CollapseOption[]
      readonly option?: CollapseOption
      readonly chosen: ReadonlyMap<number, number>
    }
  | { readonly t: 'pick'; readonly opt: PickOpt; readonly id?: number }
  | { readonly t: 'sent' }

type SimpleAction = 'disguise' | 'exonerate'
type PickAction = 'choose_identity' | 'exonerate_discard'

const ROLE_ACTIONS = {
  killer: ['kill', 'disguise', 'shift', 'collapse'],
  inspector: ['accuse', 'exonerate', 'shift', 'collapse'],
} as const

/** Where a new decision starts: straight at the cards or the targets when that's the only choice. */
function firstMode(moves: Moves): Mode {
  if (moves.pick) return { t: 'pick', opt: moves.pick }
  const onlyTarget = moves.shifts.length === 0 && !moves.collapse && moves.simple.length === 0
  return moves.target && onlyTarget ? { t: 'target', ...moves.target } : { t: 'idle' }
}

function startCollapse(options: readonly CollapseOption[]): Mode {
  const option = options.length === 1 ? options[0] : undefined
  return { t: 'collapse', options, option, chosen: new Map() }
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
 * A phone during a Shadow Duel. Players choose an action, then its target on their own small copy of
 * the board, and confirm; spectators just follow along. Hidden facts appear only in the held-open file.
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
  const key = `${pending?.id ?? '-'}:${refusalId}`
  const [intent, setIntent] = useState<{ key: string; mode: Mode }>({ key, mode: firstMode(moves) })
  const [revealed, setRevealed] = useState(false)
  const [guide, setGuide] = useState(false)
  const mode = intent.key === key ? intent.mode : firstMode(moves)
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

  // What the board offers in each mode.
  let lit: ReadonlySet<number> | undefined
  let chosen: ReadonlySet<number> | undefined
  let onTile: ((id: number) => void) | undefined
  let shift: ShiftControls | undefined
  if (myTurn) {
    if ((mode.t === 'idle' || mode.t === 'shift') && moves.shifts.length > 0) {
      shift = {
        can: (line, by) => canShift(moves, line, by),
        onShift: (line, by) => setMode({ t: 'shift', line, by }),
        chosen: mode.t === 'shift' ? mode : undefined,
      }
    } else if (mode.t === 'target') {
      lit = mode.ids
      chosen = mode.id === undefined ? undefined : new Set([mode.id])
      onTile = (id) => setMode({ ...mode, id })
    } else if (mode.t === 'collapse' && mode.option) {
      const option = mode.option
      lit = new Set(option.lines.filter((line) => line.length > 1).flat())
      chosen = new Set(collapsePicks(option, mode.chosen).filter((id) => id !== undefined))
      onTile = (id) => {
        const line = option.lines.findIndex((l) => l.includes(id))
        setMode({ ...mode, chosen: new Map(mode.chosen).set(line, id) })
      }
    }
  }

  const cancel = (
    <button type="button" className="button button--quiet" onClick={() => setMode({ t: 'idle' })}>
      {t('duel.cancel')}
    </button>
  )

  function controls(): ReactNode {
    switch (mode.t) {
      case 'sent':
        return (
          <p className="action-bar__status" role="status">
            {t('duel.sent')}
          </p>
        )
      case 'pick': {
        const { opt: pick, id } = mode
        if (id === undefined) return <p className="action-bar__status">{t('duel.pickHint')}</p>
        return (
          <button
            type="button"
            className="button"
            onClick={() => act(choice.pick(pick.action, id))}
          >
            {t(`duel.pick.${pick.action as PickAction}`, { name: name(id) })}
          </button>
        )
      }
      case 'target': {
        const { action, id } = mode
        return (
          <>
            {id === undefined ? (
              <p className="action-bar__status">{t(`duel.pickTarget.${action}`)}</p>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() => act(choice.target(action, id))}
              >
                {t(`duel.confirmTarget.${action}`, { name: name(id) })}
              </button>
            )}
            {cancel}
          </>
        )
      }
      case 'shift': {
        const { line, by } = mode
        return (
          <>
            <button type="button" className="button" onClick={() => act(choice.shift(line, by))}>
              {t(`duel.shiftLine.${line.axis}`, {
                n: line.index + 1,
                dir: t(`duel.dir.${direction(line, by)}`),
              })}
            </button>
            {cancel}
          </>
        )
      }
      case 'simple': {
        const action = mode.action
        return (
          <>
            <p className="hint">{t(`duel.explain.${action}`)}</p>
            <button type="button" className="button" onClick={() => act(choice.simple(action))}>
              {t(`duel.action.${action}`)}
            </button>
            {cancel}
          </>
        )
      }
      case 'collapse': {
        const option = mode.option
        if (!option) {
          return (
            <>
              {mode.options.map((o) => (
                <button
                  key={o.direction}
                  type="button"
                  className="button button--quiet"
                  onClick={() => setMode({ ...mode, option: o })}
                >
                  {t(`duel.collapseWay.${o.direction}`)}
                </button>
              ))}
              {cancel}
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
              {t('duel.action.collapse')}
            </button>
            {cancel}
          </>
        )
      }
      case 'idle': {
        const { target, collapse } = moves
        const again = moves.simple.includes('stop_collapsing')
        return (
          <>
            {target && (
              <button
                type="button"
                className="button"
                onClick={() => setMode({ t: 'target', ...target })}
              >
                {t(`duel.action.${target.action}`)}
              </button>
            )}
            {moves.simple
              .filter((a): a is SimpleAction => a === 'disguise' || a === 'exonerate')
              .map((action) => (
                <button
                  key={action}
                  type="button"
                  className="button button--quiet"
                  onClick={() => setMode({ t: 'simple', action })}
                >
                  {t(`duel.action.${action}`)}
                </button>
              ))}
            {collapse && (
              <button
                type="button"
                className={again ? 'button' : 'button button--quiet'}
                onClick={() => setMode(startCollapse(collapse))}
              >
                {t(again ? 'duel.action.collapseAgain' : 'duel.action.collapse')}
              </button>
            )}
            {again && (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => act(choice.simple('stop_collapsing'))}
              >
                {t('duel.action.stop_collapsing')}
              </button>
            )}
            {moves.shifts.length > 0 && <p className="hint">{t('duel.shiftHint')}</p>}
          </>
        )
      }
    }
  }

  const picking = myTurn && mode.t === 'pick' ? mode : undefined
  return (
    <>
      <main className="room duel-phone">
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
        {me && view.outcome === undefined && <Dossier me={me} onReveal={setRevealed} />}
        {picking ? (
          <div className="pick" role="group" aria-label={t('duel.pickHint')}>
            {picking.opt.cards.map((id) => (
              <SuspectCard
                key={id}
                id={id}
                lit
                chosen={picking.id === id}
                onPick={() => setMode({ ...picking, id })}
              />
            ))}
          </div>
        ) : (
          <Board
            size="phone"
            rows={view.board.rows}
            cols={view.board.cols}
            tiles={view.board.tiles}
            lit={lit}
            chosen={chosen}
            mine={revealed ? me?.identity : undefined}
            onTile={onTile}
            shift={shift}
          />
        )}
        <KillMeter view={view} />
        <CaseLog room={room} events={events} limit={4} publicOnly />
        {me && (
          <details className="help-now">
            <summary>{t('duel.helpNow')}</summary>
            <dl>
              {ROLE_ACTIONS[me.role].map((action) => (
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
      </main>
      <footer className="action-bar">
        {myTurn && <div className="duel-controls">{controls()}</div>}
        {view.outcome !== undefined && footer}
      </footer>
    </>
  )
}
