import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'

const FACILITY_TZ = 'America/New_York'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [booking] = await db
    .select({
      partySize: bookings.partySize,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      bayLabel: bays.label,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    partySize: booking.partySize,
    bayLabel: booking.bayLabel,
    dateLabel: formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE, MMM d'),
    timeRange: `${formatInTimeZone(booking.startsAt, FACILITY_TZ, 'h:mm a')} – ${formatInTimeZone(booking.endsAt, FACILITY_TZ, 'h:mm a')}`,
  })
}
