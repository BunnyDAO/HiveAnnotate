/** The only places the app will ever open in the user's browser. */
const ALLOWED_HOSTS = new Set(['hiveop.io', 'www.hiveop.io'])

/**
 * Whether a link may be opened in the browser. https to hiveop.io only: a page
 * in this app must never become a way to send the user anywhere else.
 */
export function isAllowedExternal(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname) && !u.username && !u.password
  } catch {
    return false
  }
}
