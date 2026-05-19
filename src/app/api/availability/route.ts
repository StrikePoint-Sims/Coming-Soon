import { type NextRequest, NextResponse } from 'next/server'
import { getAvailability } from '@/lib/booking/service'

export const runtime = 'nodejs'

// Public, cache-friendly availability. No DB log row per request.
// TODO(rate-limit): wrap this route in an IP/session rate limiter before
// exposing publicly to prevent bot-driven recalculations.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const locationId = sp.get('locationId')
  const date = sp.get('date')
  const duration = parseInt(sp.get('duration') ?? '60', 10)
  const audienceType = sp.get('audience') ?? 'public'

  if (!locationId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(duration)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const data = await getAvailability({
    locationId,
    date,
    durationMinutes: duration,
    audienceType,
  })

  return NextResponse.json(data, {
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, max-age=30',
    },
  })
}
