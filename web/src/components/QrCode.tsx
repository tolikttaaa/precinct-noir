import { useMemo } from 'react'
import { encode } from 'uqr'

const QUIET_ZONE = 2

/** A QR code drawn as one SVG path (no injected markup). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(value, { ecc: 'M', border: 0 })
    const path = data
      .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
      .join('')
    return { size, path }
  }, [value])
  const box = size + QUIET_ZONE * 2
  return (
    <svg
      className="qr"
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
      role="img"
      aria-label={label}
    >
      <rect className="qr__paper" x={-QUIET_ZONE} y={-QUIET_ZONE} width={box} height={box} />
      <path className="qr__ink" d={path} />
    </svg>
  )
}
