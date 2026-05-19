'use server'

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function checkUserExists(
  identifier: string,
  type: 'email' | 'phone',
): Promise<boolean> {
  // Per-IP gate so an attacker can't iterate through email/phone lists. The
  // existence answer is still observable to a low-volume attacker — accept
  // that risk for now and revisit if we see abuse patterns.
  const h = await headers()
  const ip = getClientIp(h)
  const r = await rateLimit({ key: `check_user:ip:${ip}`, limit: 10, windowMs: 60_000 })
  if (!r.ok) {
    // Failing closed: pretend the account exists so the caller still routes
    // to the "send code" flow. Better UX than a hard error and doesn't leak.
    return true
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(type === 'email' ? eq(users.email, identifier) : eq(users.phone, identifier))
    .limit(1)
  return !!user
}
