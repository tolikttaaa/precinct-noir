import { useTranslation } from 'react-i18next'
import { fileNumber, genderOf, portraitOf, suspectName } from './suspects'

interface Props {
  readonly id: number
  readonly dead?: boolean
  readonly cleared?: boolean
  /** Can be picked right now (a target, a body to remove, a card to choose). */
  readonly lit?: boolean
  readonly chosen?: boolean
  /** The viewer's own identity, shown only while they hold their file open. */
  readonly mine?: boolean
  readonly onPick?: () => void
}

/** One suspect's case-file card: portrait, name and file number, with a red X or a cleared stamp. */
export function SuspectCard({ id, dead, cleared, lit, chosen, mine, onPick }: Props) {
  const { t, i18n } = useTranslation()
  const name = suspectName(id, i18n.language)
  const label = [
    name,
    dead && t('duel.card.dead', { context: genderOf(id) }),
    cleared && t('duel.card.cleared'),
    mine && t('duel.card.you'),
  ]
    .filter(Boolean)
    .join(', ')
  const body = (
    <>
      <img className="suspect-card__portrait" src={portraitOf(id)} alt="" draggable={false} />
      <span className="suspect-card__name">{name}</span>
      <span className="suspect-card__number">№{fileNumber(id)}</span>
      {dead && <span className="suspect-card__x" />}
      {cleared && <span className="suspect-card__cleared">{t('duel.card.stamp')}</span>}
    </>
  )
  const marks = {
    'data-dead': dead || undefined,
    'data-cleared': cleared || undefined,
    'data-lit': lit || undefined,
    'data-chosen': chosen || undefined,
    'data-mine': mine || undefined,
  }
  return onPick ? (
    <button
      type="button"
      className="suspect-card"
      aria-label={label}
      aria-pressed={chosen ?? false}
      onClick={onPick}
      {...marks}
    >
      {body}
    </button>
  ) : (
    <div className="suspect-card" role="img" aria-label={label} {...marks}>
      {body}
    </div>
  )
}
