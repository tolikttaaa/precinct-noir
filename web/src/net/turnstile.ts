/** The part of Cloudflare Turnstile's browser API we use. */
export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback': () => void
    },
  ): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export class TurnstileError extends Error {
  constructor() {
    super('turnstile')
  }
}

let loading: Promise<TurnstileApi> | null = null

/** Loads Turnstile's script once (the CSP allows its origin). */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new TurnstileError())
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new TurnstileError())
    }
    document.head.append(script)
  })
  return loading
}

/**
 * Runs Turnstile's check (invisible for people) in [container] and resolves with a single-use token for
 * the server.
 */
export async function humanToken(siteKey: string, container: HTMLElement): Promise<string> {
  const turnstile = await loadTurnstile()
  let widget: string | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      widget = turnstile.render(container, {
        sitekey: siteKey,
        callback: resolve,
        'error-callback': () => reject(new TurnstileError()),
      })
    })
  } finally {
    if (widget) turnstile.remove(widget)
  }
}

/** Test hook: forget a previous load. */
export function resetTurnstileForTests(): void {
  loading = null
}
