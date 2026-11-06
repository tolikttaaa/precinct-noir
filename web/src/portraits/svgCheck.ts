/** Test helper: parses SVG markup the way a browser image would, returning the parser's complaint if any. */
export function svgProblem(markup: string): string | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const error = doc.getElementsByTagName('parsererror')[0]
  return error ? (error.textContent ?? 'parsererror') : null
}
