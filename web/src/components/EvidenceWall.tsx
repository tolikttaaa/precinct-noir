import { ROSTER } from '../portraits/roster'
import { evidenceWallUri, wallSuspects } from '../portraits/wall'

let image: string | undefined

/** The wall is drawn once per page load and reused by every screen. */
function wallImage(): string {
  image ??= evidenceWallUri(wallSuspects(ROSTER))
  return image
}

/**
 * The evidence wall behind every screen. [dim] darkens and softens it where text sits straight on it
 * (phones and plain pages), so it sets the mood without competing with what you read.
 */
export function EvidenceWall({ dim }: { dim: boolean }) {
  return (
    <img
      className={dim ? 'wall wall--dim' : 'wall'}
      src={wallImage()}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  )
}
