import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, bays, waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import '../../account.css'

export const metadata: Metadata = {
  title: 'Booking Details — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      bayLabel: bays.label,
      status: bookings.status,
      totalCents: bookings.totalCents,
      paidAt: bookings.paidAt,
      source: bookings.source,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, id), eq(bookings.userId, user.id)))
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!booking) redirect('/account/bookings' as any)

  const now = new Date()
  const isFuture = booking.startsAt > now

  // Waiver check
  const [waiver] = await db
    .select({ expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  const confirmationNum = `SPC-${id.slice(0, 6).toUpperCase()}-${id.slice(-4).toUpperCase()}`
  const statusMap: Record<string, string> = {
    confirmed: 'confirmed',
    checked_in: 'confirmed',
    pending: 'pending',
    cancelled: 'cancelled',
    no_show: 'cancelled',
  }
  const badgeCls = statusMap[booking.status] ?? 'cancelled'

  return (
    <div className="ap-page">
      <a href="/account/bookings" className="ap-btn ghost" style={{ marginBottom: 24, height: 36, fontSize: '0.8rem', padding: '0 14px', display: 'inline-flex' }}>
        ← My Bookings
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 className="ap-title" style={{ margin: 0 }}>Booking Details</h1>
        <span className={`ap-badge ${badgeCls}`}>{booking.status.replace('_', ' ')}</span>
      </div>
      <p className="ap-subtitle">{confirmationNum}</p>

      {/* Reservation info */}
      <div className="ap-card">
        <p className="ap-card-title">Reservation</p>
        <div className="ap-row"><span className="ap-row-label">Date</span><span className="ap-row-value">{formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEEE, MMMM d, yyyy')}</span></div>
        <div className="ap-row"><span className="ap-row-label">Time</span><span className="ap-row-value">{formatInTimeZone(booking.startsAt, FACILITY_TZ, 'h:mm a')} – {formatInTimeZone(booking.endsAt, FACILITY_TZ, 'h:mm a')}</span></div>
        <div className="ap-row"><span className="ap-row-label">Duration</span><span className="ap-row-value">{durationLabel(booking.startsAt, booking.endsAt)}</span></div>
        <div className="ap-row"><span className="ap-row-label">Bay</span><span className="ap-row-value">{booking.bayLabel}</span></div>
        {booking.totalCents > 0 && (
          <div className="ap-row"><span className="ap-row-label">Total Paid</span><span className="ap-row-value">${(booking.totalCents / 100).toFixed(2)}</span></div>
        )}
        {booking.paidAt && (
          <div className="ap-row"><span className="ap-row-label">Paid On</span><span className="ap-row-value">{formatInTimeZone(booking.paidAt, FACILITY_TZ, 'MMM d, yyyy')}</span></div>
        )}
      </div>

      {/* Waiver & access */}
      <div className="ap-card">
        <p className="ap-card-title">Access &amp; Waiver</p>
        <div className="ap-row">
          <span className="ap-row-label">Your Waiver</span>
          <span className="ap-row-value">
            {waiver ? (
              <span style={{ color: '#8fbc58' }}>✓ Valid until {formatInTimeZone(waiver.expiresAt, FACILITY_TZ, 'MMM d, yyyy')}</span>
            ) : (
              <a href="/waiver?callbackUrl=/account/bookings" style={{ color: '#D4AF37', textDecoration: 'none', fontWeight: 600 }}>Sign waiver →</a>
            )}
          </span>
        </div>
        {isFuture && (
          <div className="ap-row">
            <span className="ap-row-label">Access Code</span>
            <span className="ap-row-value" style={{ color: 'rgba(255,255,255,0.4)' }}>Sent by SMS 1 hour before session</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isFuture && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={`/api/book/${booking.id}/ics`} download className="ap-btn ghost">
            Add to Calendar
          </a>
          <a href="/book" className="ap-btn primary">
            Book Another Session →
          </a>
        </div>
      )}

      {!isFuture && (
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/book" className="ap-btn primary">Book Again →</a>
        </div>
      )}
    </div>
  )
}
