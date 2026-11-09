import { useEffect, useState } from 'react'
import { api } from '../net/api'
import type { ClientConfig } from '../protocol/generated'

let config: Promise<ClientConfig> | null = null

/** The server's public settings, fetched once per page (and again on the next use after a failure). */
export function loadConfig(): Promise<ClientConfig> {
  config ??= api.config().catch((error: unknown) => {
    config = null
    throw error
  })
  return config
}

/** The server's public settings, once they've arrived. */
export function useConfig(): ClientConfig | undefined {
  const [value, setValue] = useState<ClientConfig>()
  useEffect(() => {
    let live = true
    loadConfig().then(
      (result) => live && setValue(result),
      () => undefined, // only the version line needs it up front, and it can stay blank
    )
    return () => {
      live = false
    }
  }, [])
  return value
}

/** Test hook. */
export function resetConfigForTests(): void {
  config = null
}
