// Sanitize a user-supplied callback URL so we only ever redirect to our own
// origin. Mirrors the client-side normalizeCallbackUrl in LoginForm.tsx and
// the server-side normalizeAuthRedirect in auth.config.ts.

export function safeCallbackUrl(raw: unknown, fallback: string = '/account'): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback

  // Easy path: pure same-origin pathname. No `//` smuggling, no scheme.
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }

  // Parse anything else against a dummy base — only accept it if it's an
  // explicit strikepointsims.com URL.
  try {
    const url = new URL(raw)
    if (url.hostname === 'strikepointsims.com' || url.hostname.endsWith('.strikepointsims.com')) {
      return `${url.pathname}${url.search}${url.hash}` || fallback
    }
  } catch {
    // fall through
  }

  return fallback
}
