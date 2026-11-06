import { useEffect, useState } from 'react'

const DISARM_AFTER_MS = 4000

interface Props {
  readonly label: string
  /** Shown after the first tap; the second tap runs [onConfirm]. */
  readonly confirmLabel: string
  readonly onConfirm: () => void
  readonly className?: string
}

/** A button for actions that affect others (remove, leave, end game): it takes two taps. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'button button--quiet',
}: Props) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), DISARM_AFTER_MS)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <button
      type="button"
      className={className}
      data-armed={armed || undefined}
      onClick={() => {
        if (armed) onConfirm()
        setArmed(!armed)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
