/**
 * Picture portraits: image files in `portraits/images/`, named by suspect id (`7.webp`). A suspect with a
 * picture shows it on every card and on the wall; one without keeps the drawn portrait, so pictures can
 * arrive a few at a time. docs/PORTRAITS.md is the brief for making them.
 */

const files = import.meta.glob<string>('./images/*.{webp,jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** Reads `./images/12.webp` style paths into suspect id → URL. Files with other names are ignored. */
export function photoIndex(found: Readonly<Record<string, string>>): ReadonlyMap<number, string> {
  const index = new Map<number, string>()
  for (const [path, url] of Object.entries(found)) {
    const match = /\/(\d+)\.(?:webp|jpg|png)$/.exec(path)
    if (match) index.set(Number(match[1]), url)
  }
  return index
}

/** Every picture the build found. */
export const PHOTOS = photoIndex(files)

function asDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('unreadable picture'))
    reader.readAsDataURL(blob)
  })
}

/**
 * The pictures of [ids] as data URIs. The wall is an SVG shown as an image, and such an SVG may embed
 * pictures but not load files. A picture that fails to load is left out, so its drawn portrait stays.
 */
export async function photoData(
  photos: ReadonlyMap<number, string>,
  ids: readonly number[],
): Promise<Map<number, string>> {
  const data = new Map<number, string>()
  await Promise.all(
    ids.map(async (id) => {
      const url = photos.get(id)
      if (url === undefined) return
      try {
        const response = await fetch(url)
        if (!response.ok) return
        data.set(id, await asDataUri(await response.blob()))
      } catch {
        // Keep the drawn portrait for this one.
      }
    }),
  )
  return data
}
