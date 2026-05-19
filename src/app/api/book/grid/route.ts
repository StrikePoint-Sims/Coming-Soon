import { type NextRequest, NextResponse } from 'next/server'
import { getAvailabilityGrid } from '@/lib/booking/availability'

export const runtime = 'nodejs'

// Public — no auth required. createHold() enforces auth server-side.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const locationId = searchParams.get('locationId')
  const date = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') ?? '60')

  if (!locationId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const rows = await getAvailabilityGrid({ locationId, date, durationMinutes: duration })
  return NextResponse.json({ rows })
}
