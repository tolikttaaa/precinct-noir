import { useEffect, useState } from 'react'
import { api } from '../net/api'
import type { ModeInfo } from '../protocol/generated'

let modes: Promise<ModeInfo[]> | null = null

/** The game modes the server offers (fetched once per page; retried on the next use after a failure). */
export function useModes(): readonly ModeInfo[] | undefined {
  const [list, setList] = useState<readonly ModeInfo[]>()
  useEffect(() => {
    let live = true
    modes ??= api.modes().catch((error: unknown) => {
      modes = null
      throw error
    })
    modes.then(
      (result) => live && setList(result),
      () => undefined, // the lobby still works without mode details
    )
    return () => {
      live = false
    }
  }, [])
  return list
}

/** Test hook. */
export function resetModesForTests(): void {
  modes = null
}
