import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createHold, CapacityUnavailableError } from '@/lib/booking/createHold'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Soft cap on session length so a caller can't hold a year-long interval.
const MAX_HOLD_MINUTES = 6 * 60

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

  let body: { locationId?: string; startsAt?: string; endsAt?: string }
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
    })
    return NextResponse.json(hold, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof CapacityUnavailableError) {
      return NextResponse.json({ error: 'capacity_unavailable' }, { status: 409 })
    }
    throw err
  }
}
