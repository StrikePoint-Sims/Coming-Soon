import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import './confirmed.css'

export const metadata: Metadata = {
  title: 'Booking Confirmed — StrikePoint Sims',
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
      totalCents: bookings.totalCents,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) redirect('/account')

  const fmtDate = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'EEEE, MMMM d')
  const fmtTime = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'h:mm a')

  const confirmationNum = `SPC-${bookingId.slice(0, 6).toUpperCase()}-${bookingId.slice(-4).toUpperCase()}`

  const summaryRows = [
    ['Date',     fmtDate(booking.startsAt)],
    ['Time',     `${fmtTime(booking.startsAt)} – ${fmtTime(booking.endsAt)}`],
    ['Bay',      booking.bayLabel],
    ['Duration', durationLabel(booking.startsAt, booking.endsAt)],
  ] as const

  return (
    <div className="conf-page">
      <div className="conf-content">

        {/* ── Success card ─────────────────────────────────────────────────── */}
        <div className="conf-card">

          {/* Check icon */}
          <div className="conf-icon-wrap">
            <div className="conf-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12 10 18 20 6" />
              </svg>
            </div>
          </div>

          <h1 className="conf-heading">Booking Confirmed!</h1>
          <p className="conf-number">{confirmationNum}</p>

          {/* Summary */}
          <div className="conf-summary">
            <table className="conf-table">
              <tbody>
                {summaryRows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="conf-td-label">{label}</td>
                    <td className="conf-td-value">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* What happens next */}
          <div className="conf-next-section">
            <p className="conf-next-title">What happens next?</p>
            <ul className="conf-next-list">
              <li className="conf-next-item">
                <span className="conf-next-num">1</span>
                <span>
                  <strong>Confirmation email</strong> — a receipt and session details are on their way to your inbox.
                </span>
              </li>
              <li className="conf-next-item">
                <span className="conf-next-num">2</span>
                <span>
                  <strong>Access code by SMS</strong> — your bay entry code will be texted 1 hour before your session.
                </span>
              </li>
              <li className="conf-next-item">
                <span className="conf-next-num">3</span>
                <span>
                  <strong>Waiver check</strong> — all players need a signed waiver. You can add guests in your account.
                </span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="conf-actions">
            <a
              href={`/account/bookings/${bookingId}`}
              className="conf-btn-primary"
            >
              View Booking
            </a>
            <a
              href={`/api/book/${bookingId}/ics`}
              className="conf-btn-secondary"
              download
            >
              Add to Calendar
            </a>
            <a href="/book" className="conf-btn-ghost">Book Another Session →</a>
          </div>

        </div>
      </div>
    </div>
  )
}
