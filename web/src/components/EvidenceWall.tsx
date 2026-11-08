import { useEffect, useState } from 'react'
import { PHOTOS, photoData } from '../portraits/photos'
import { ROSTER } from '../portraits/roster'
import { evidenceWallUri, wallSuspects } from '../portraits/wall'

const SUSPECTS = wallSuspects(ROSTER)
/** Suspects on the wall with a picture portrait: those pictures have to be fetched before it's drawn. */
const PICTURED = SUSPECTS.filter((s) => PHOTOS.has(s.id)).map((s) => s.id)

let image: string | undefined
let pending: Promise<string> | undefined

/** The wall is drawn once per page load and reused by every screen. */
function wallImage(): Promise<string> {
  pending ??= photoData(PHOTOS, PICTURED).then((pictures) => {
    image = evidenceWallUri(SUSPECTS, undefined, pictures)
    return image
  })
  return pending
}

/**
 * The evidence wall behind every screen. [dim] darkens and softens it where text sits straight on it
 * (phones and plain pages), so it sets the mood without competing with what you read. With picture
 * portraits on it, the wall appears once they've loaded instead of swapping faces in front of you.
 */
export function EvidenceWall({ dim }: { dim: boolean }) {
  const [src, setSrc] = useState(() =>
    PICTURED.length === 0 ? (image ??= evidenceWallUri(SUSPECTS)) : image,
  )
  useEffect(() => {
    if (src !== undefined) return
    let live = true
    void wallImage().then((uri) => {
      if (live) setSrc(uri)
    })
    return () => {
      live = false
    }
  }, [src])
  if (src === undefined) return null
  return (
    <img
      className={dim ? 'wall wall--dim' : 'wall'}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  )
}
