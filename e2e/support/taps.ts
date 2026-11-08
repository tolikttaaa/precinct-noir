/**
 * Shows every tap in the recordings: a ring where the pointer goes down, held while it stays down, then
 * fading out. It runs in each page before the app does (an init script, which the page's CSP doesn't
 * cover), only draws, and never takes pointer events. Playwright sends this function's source into the
 * page, so it must not use anything from outside it.
 */
export function showTaps(): void {
  window.addEventListener(
    'pointerdown',
    (event) => {
      const ring = document.createElement('div')
      Object.assign(ring.style, {
        position: 'fixed',
        left: `${event.clientX - 22}px`,
        top: `${event.clientY - 22}px`,
        width: '44px',
        height: '44px',
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: '3px solid rgba(255, 205, 96, 0.95)',
        background: 'rgba(255, 205, 96, 0.35)',
        boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.55)',
        pointerEvents: 'none',
        zIndex: '2147483647',
      })
      document.documentElement.append(ring)
      const release = () => {
        window.removeEventListener('pointerup', release, true)
        window.removeEventListener('pointercancel', release, true)
        const fade = ring.animate(
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(1.9)', opacity: 0 },
          ],
          { duration: 450, delay: 150, easing: 'ease-out', fill: 'forwards' },
        )
        fade.onfinish = () => ring.remove()
      }
      window.addEventListener('pointerup', release, true)
      window.addEventListener('pointercancel', release, true)
    },
    true,
  )
}
