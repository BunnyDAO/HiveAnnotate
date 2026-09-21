/** A directory-safe slug derived from a Note. Deterministic. */
export function slugify(text: string): string {
  const cleaned = text
    .normalize('NFKD')
    // Strip combining marks so accented letters fold to their base form.
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return cleaned.slice(0, 60).replace(/-+$/, '') || 'untitled'
}
