import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { bays, bookingHolds, waiverSignings } from '@/db/schema'
import { createHold, CapacityUnavailableError } from '@/lib/booking/createHold'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { and, eq, gt } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'

export const runtime = 'nodejs'

// Soft cap on session length so a caller can't hold a year-long interval.
const MAX_HOLD_MINUTES = 6 * 60
const FACILITY_TZ = 'America/New_York'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const holdId = req.nextUrl.searchParams.get('holdId')
  if (!holdId) return NextResponse.json({ error: 'Missing holdId' }, { status: 400 })

  const [hold] = await db
    .select({
      id: bookingHolds.id,
      bayId: bookingHolds.bayId,
      startsAt: bookingHolds.startsAt,
      endsAt: bookingHolds.endsAt,
      expiresAt: bookingHolds.expiresAt,
      partySize: bookingHolds.partySize,
    })
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, holdId),
      eq(bookingHolds.userId, session.user.id),
      eq(bookingHolds.status, 'active'),
      gt(bookingHolds.expiresAt, new Date()),
    ))
    .limit(1)

  if (!hold) return NextResponse.json({ error: 'Hold expired or not found.' }, { status: 404 })

  let bayLabel = 'Assigned before your session'
  if (hold.bayId) {
    const [bay] = await db.select({ label: bays.label }).from(bays).where(eq(bays.id, hold.bayId)).limit(1)
    bayLabel = bay?.label ?? bayLabel
  }

  const durationMinutes = Math.round((hold.endsAt.getTime() - hold.startsAt.getTime()) / 60_000)
  return NextResponse.json({
    holdId: hold.id,
    bayLabel,
    startsAt: hold.startsAt.toISOString(),
    endsAt: hold.endsAt.toISOString(),
    expiresAt: hold.expiresAt.toISOString(),
    durationMinutes,
    partySize: hold.partySize,
    dateLabel: formatInTimeZone(hold.startsAt, FACILITY_TZ, 'EEE, MMM d'),
    timeRange: `${formatInTimeZone(hold.startsAt, FACILITY_TZ, 'h:mm a')} - ${formatInTimeZone(hold.endsAt, FACILITY_TZ, 'h:mm a')}`,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getClientIp(req.headers)
  const [userLimit, ipLimit] = await Promise.all([
    rateLimit({ key: `hold:user:${session.user.id}`, limit: 20, windowMs: 60_000 }),
    rateLimit({ key: `hold:ip:${ip}`, limit: 30, windowMs: 60_000 }),
  ])
  const limited = rateLimitResponse(userLimit) ?? rateLimitResponse(ipLimit)
  if (limited) return limited

  const [waiver] = await db
    .select({ id: waiverSignings.id })
    .from(waiverSignings)
    .where(and(
      eq(waiverSignings.userId, session.user.id),
      gt(waiverSignings.expiresAt, new Date()),
    ))
    .limit(1)
  if (!waiver) return NextResponse.json({ error: 'A signed waiver is required before booking.' }, { status: 403 })

  let body: { locationId?: string; startsAt?: string; endsAt?: string; partySize?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const { locationId, startsAt, endsAt } = body
  if (!locationId || !startsAt || !endsAt) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const s = new Date(startsAt), e = new Date(endsAt)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }
  const durationMinutes = (e.getTime() - s.getTime()) / 60_000
  if (durationMinutes > MAX_HOLD_MINUTES) {
    return NextResponse.json({ error: 'Session too long' }, { status: 400 })
  }

  try {
    const hold = await createHold({
      userId: session.user.id,
      locationId,
      startsAt: s,
      endsAt: e,
      partySize: body.partySize,
    })
    return NextResponse.json(hold, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof CapacityUnavailableError) {
      return NextResponse.json({ error: 'capacity_unavailable' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const holdId = req.nextUrl.searchParams.get('holdId')
  if (!holdId) return NextResponse.json({ error: 'Missing holdId' }, { status: 400 })

  const { cancelHold } = await import('@/lib/booking/createHold')
  const rows = await db
    .select({ userId: bookingHolds.userId })
    .from(bookingHolds)
    .where(eq(bookingHolds.id, holdId))
    .limit(1)
  if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (rows[0].userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await cancelHold(holdId)
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
