import { useSyncExternalStore } from 'react'

export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'tv'; readonly code: string }
  | { readonly page: 'player'; readonly code: string }
  | { readonly page: 'missing' }

const ROOM_CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/

/** A room code as typed by a person (any case, stray spaces), or `null` if it can't be one. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return ROOM_CODE.test(code) ? code : null
}

/** `/` home, `/BKTR` a player's phone, `/tv/BKTR` the TV. */
export function parseRoute(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'home' }
  const tv = parts.length === 2 && parts[0] === 'tv'
  const code = tv || parts.length === 1 ? normalizeCode(parts.at(-1)!) : null
  if (!code) return { page: 'missing' }
  return tv ? { page: 'tv', code } : { page: 'player', code }
}

export function navigate(path: string): void {
  history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}
