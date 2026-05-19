import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createHold, CapacityUnavailableError } from '@/lib/booking/createHold'

export const runtime = 'nodejs'

// TODO(rate-limit): strictly rate-limit per user/IP.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
