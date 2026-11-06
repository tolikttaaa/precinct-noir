import { useEffect, useState } from 'react'
import { echoUrl, probeEcho } from '../net/echoProbe'

type WireState = { kind: 'checking' } | { kind: 'live'; rttMs: number } | { kind: 'dead' }

const defaultProbe = () => probeEcho(echoUrl())

/** Shows whether the real-time line to the server works (WebSocket round trip). */
export function ConnectionCheck({ probe = defaultProbe }: { probe?: () => Promise<number> }) {
  const [wire, setWire] = useState<WireState>({ kind: 'checking' })

  useEffect(() => {
    let active = true
    probe().then(
      (rttMs) => active && setWire({ kind: 'live', rttMs }),
      () => active && setWire({ kind: 'dead' }),
    )
    return () => {
      active = false
    }
  }, [probe])

  return (
    <p className={`wire wire--${wire.kind}`} role="status" aria-live="polite">
      <span className="wire__dot" aria-hidden="true" />
      {wire.kind === 'checking' && 'Checking the wire…'}
      {wire.kind === 'live' && `Wire is live · ${wire.rttMs} ms`}
      {wire.kind === 'dead' && 'Wire is dead. The precinct is unreachable.'}
    </p>
  )
}
