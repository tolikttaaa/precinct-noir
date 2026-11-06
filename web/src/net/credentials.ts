/** Which screen a device is in a room as: the TV, or a player's phone. One browser can be both. */
export type Role = 'host' | 'player'

/** What a device needs to get back into a room: its token, and the last command number it used. */
export interface Credentials {
  readonly token: string
  readonly playerId?: number
  readonly clientSeq: number
}

const key = (code: string, role: Role) => `precinctnoir.${code}.${role}`

// Storage can be unavailable (private mode, blocked site data); the room then lasts as long as the page.

export function loadCredentials(code: string, role: Role): Credentials | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key(code, role)) ?? 'null')
    const { token, playerId, clientSeq } = (saved ?? {}) as Record<string, unknown>
    if (typeof token !== 'string') return null
    return {
      token,
      playerId: typeof playerId === 'number' ? playerId : undefined,
      clientSeq: typeof clientSeq === 'number' ? clientSeq : 0,
    }
  } catch {
    return null
  }
}

export function saveCredentials(code: string, role: Role, credentials: Credentials): void {
  try {
    localStorage.setItem(key(code, role), JSON.stringify(credentials))
  } catch {
    // Not persisted; see above.
  }
}

export function forgetCredentials(code: string, role: Role): void {
  try {
    localStorage.removeItem(key(code, role))
  } catch {
    // Nothing to forget.
  }
}
