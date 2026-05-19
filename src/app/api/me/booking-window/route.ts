import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { memberships, membershipTiers } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'

// Source of truth for booking windows. Mirrors memory/project_booking_windows.md.
const NON_MEMBER_WINDOW = 3
const WINDOW_BY_TIER: Record<string, number> = {
  Practice: 7,
  Standard: 10,
  Elite: 14,
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ maxDays: NON_MEMBER_WINDOW, tierName: null })
  }

  const now = new Date()
  const [row] = await db
    .select({ tierName: membershipTiers.name })
    .from(memberships)
    .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
    .where(and(
      eq(memberships.userId, session.user.id),
      gt(memberships.currentPeriodEnd, now),
    ))
    .limit(1)

  if (!row) {
    return NextResponse.json({ maxDays: NON_MEMBER_WINDOW, tierName: null })
  }

  return NextResponse.json({
    maxDays: WINDOW_BY_TIER[row.tierName] ?? NON_MEMBER_WINDOW,
    tierName: row.tierName,
  })
}
