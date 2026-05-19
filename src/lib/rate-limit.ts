import { db } from '@/db'
import { rateLimits } from '@/db/schema/auth'
import { and, eq, gte, lt, sql } from 'drizzle-orm'

// Postgres-backed fixed-window counter. One row per (key, windowStart).
// `windowStart` is rounded down to the nearest `windowMs` so concurrent
// increments collapse into the same row via ON CONFLICT.
//
// Trade-off: fixed windows let a burst at the boundary briefly exceed the
// quota by up to 2x. For the abuse vectors we care about (SMS bombing, OTP
// brute force, expensive Stripe ops) this is acceptable and much simpler
// than a sliding-window algorithm.

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: Date
}

export async function rateLimit(params: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  const { key, limit, windowMs } = params
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const resetAt = new Date(windowStart.getTime() + windowMs)

  // Atomic upsert + increment. The RETURNING gives us the post-increment count.
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count })

  const count = rows[0]?.count ?? 1
  const remaining = Math.max(0, limit - count)
  return { ok: count <= limit, remaining, resetAt }
}

// Best-effort cleanup. Call from a cron / Inngest sweep, not on the hot path.
export async function purgeOldRateLimits(olderThan: Date): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, olderThan))
}

// Convenience for routes: returns a 429 Response or null.
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.ok) return null
  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  )
}

// Extract a best-effort client IP from a Next request's headers.
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') ?? 'unknown'
}

// Re-export referenced columns so call sites don't need to reach into schema.
export { and, eq, gte }
