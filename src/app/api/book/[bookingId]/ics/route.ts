import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { format } from 'date-fns'

export const runtime = 'nodejs'

function icsDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'")
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      bayLabel: bays.label,
    })
    .from(bookings)
    .leftJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const uid = `booking-${booking.id}@strikepointsims.com`
  const summary = escapeIcs(`StrikePoint Sims - ${booking.bayLabel ?? 'Bay assigned before session'}`)
  const description = escapeIcs('Your golf simulator session at StrikePoint Sims. Your access code will arrive by SMS 1 hour before your session.')
  const location = escapeIcs('StrikePoint Sims')
  const now = icsDate(new Date())
  const dtStart = icsDate(booking.startsAt)
  const dtEnd = icsDate(booking.endsAt)

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StrikePoint Sims//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="strikepointsims-booking-${bookingId.slice(0, 8)}.ics"`,
    },
  })
}
