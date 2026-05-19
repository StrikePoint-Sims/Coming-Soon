import { type NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/booking/availability'

export const runtime = 'nodejs'

// Public — no auth required. createHold() enforces auth server-side.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const locationId = searchParams.get('locationId')
  const date = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') ?? '60')
  const excludeHoldId = searchParams.get('excludeHoldId') ?? undefined

  if (!locationId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const slots = await getAvailableSlots({ locationId, date, durationMinutes: duration, excludeHoldId })
  return NextResponse.json({ slots })
}
