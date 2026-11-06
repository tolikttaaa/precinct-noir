import type { MouseEvent, ReactNode } from 'react'
import { navigate } from '../routing'

/** An in-app link: a real `<a>` (open in new tab still works) that navigates without reloading. */
export function Link({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={go}>
      {children}
    </a>
  )
}
