import type { ReactNode } from 'react'

export type StampTone = 'red' | 'blue' | 'brass'

/** A rubber-stamp mark: how the precinct marks status (VIP, results). */
export function Stamp({ children, tone = 'red' }: { children: ReactNode; tone?: StampTone }) {
  return <span className={`stamp stamp--${tone}`}>{children}</span>
}
