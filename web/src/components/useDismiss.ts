import { useEffect, type FocusEvent, type RefObject } from 'react'

/**
 * Closes an open menu when someone taps or clicks outside [area], or presses Escape; Escape also puts
 * the focus back on [button], where the menu was opened.
 */
export function useDismiss(
  open: boolean,
  area: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) close()
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, area, button, close])
}

/** Closes the menu when the keyboard focus moves on to something outside it (Tab past the end). */
export function closeOnFocusOut(close: () => void) {
  return (e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && !e.currentTarget.contains(next)) close()
  }
}
