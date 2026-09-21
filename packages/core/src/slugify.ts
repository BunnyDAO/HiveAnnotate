/** A directory-safe slug derived from a Note. Deterministic. */

/**
 * Notes are sentences, and a Note seeds its Bundle's name. Cutting at a word
 * boundary keeps ids scannable in a directory listing; cutting at a character
 * count produces names that trail off mid-word.
 */
const MAX_WORDS = 6
const MAX_LENGTH = 40

export function slugify(text: string): string {
  const words = text
    .normalize('NFKD')
    // Strip combining marks so accented letters fold to their base form.
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, MAX_WORDS)

  let slug = ''
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word
    // Keep a whole word or none of it; never leave a fragment behind.
    if (next.length > MAX_LENGTH) break
    slug = next
  }

  // A single first word longer than the cap still has to yield something.
  if (!slug && words[0]) slug = words[0].slice(0, MAX_LENGTH)

  return slug || 'untitled'
}
