import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import '../book.css'

export const metadata: Metadata = {
  title: 'Booking confirmed — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export default async function BookingConfirmedPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      bayLabel: bays.label,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) redirect('/account')

  const fmtDate = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'EEEE, MMMM d, yyyy')
  const fmtTime = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'h:mm a')

  const rows = [
    ['Booking', `#${bookingId.slice(0, 8).toUpperCase()}`],
    ['Bay', booking.bayLabel],
    ['Date', fmtDate(booking.startsAt)],
    ['Time', `${fmtTime(booking.startsAt)} – ${fmtTime(booking.endsAt)}`],
    ['Length', durationLabel(booking.startsAt, booking.endsAt)],
  ] as const

  return (
    <div className="book-wrap">
      <div className="book-topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/"><img src="/logohorizontal.png" alt="StrikePoint Sims" className="book-topbar-logo" /></a>
        <a href="/account" className="book-topbar-back">Account →</a>
      </div>

      <div className="book-main" style={{ maxWidth: 520 }}>
        <div className="book-confirmed-wrap">

          <div className="book-confirmed-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 12 10 18 20 6" />
            </svg>
          </div>

          <span className="book-eyebrow">Booking confirmed</span>
          <h1 className="book-confirmed-heading">You&apos;re booked.</h1>
          <p className="book-confirmed-subhead">
            Confirmation sent to your email and phone.
          </p>

          <div className="book-confirmed-card">
            <table className="book-summary-table">
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="book-summary-label">{label}</td>
                    <td className="book-summary-value">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="book-confirmed-fine">
            Your access code arrives by SMS 1 hour before your session.
            Cancel at least 24 hours in advance for a full refund.
          </p>

          <div className="book-confirmed-actions">
            <a href="/account" className="book-confirmed-primary">Back to account</a>
            <a href="/book" className="book-confirmed-secondary">Book another session →</a>
          </div>

        </div>
      </div>
    </div>
  )
}
