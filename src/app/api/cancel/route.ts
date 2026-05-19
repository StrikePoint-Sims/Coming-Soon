import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { cancelBooking, cancelHold } from '@/lib/booking/createHold'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { bookingId?: string; holdId?: string; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  if (body.holdId) {
    const r = await cancelHold(body.holdId)
    if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.bookingId) {
    // Ensure caller owns the booking before cancelling.
    const rows = await db.select({ userId: bookings.userId }).from(bookings).where(eq(bookings.id, body.bookingId)).limit(1)
    if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (rows[0].userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const r = await cancelBooking(body.bookingId, body.reason)
    if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ error: 'Missing id' }, { status: 400 })
}
