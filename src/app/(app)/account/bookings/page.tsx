import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and, gt, lt, desc, inArray } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import '../account.css'

export const metadata: Metadata = {
  title: 'My Bookings — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export default async function BookingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()

  const [upcomingRows, pastRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        bayLabel: bays.label,
        status: bookings.status,
        totalCents: bookings.totalCents,
      })
      .from(bookings)
      .innerJoin(bays, eq(bookings.bayId, bays.id))
      .where(and(
        eq(bookings.userId, user.id),
        gt(bookings.startsAt, now),
        inArray(bookings.status, ['confirmed', 'pending', 'checked_in']),
      ))
      .orderBy(bookings.startsAt)
      .limit(20),

    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        bayLabel: bays.label,
        status: bookings.status,
        totalCents: bookings.totalCents,
      })
      .from(bookings)
      .innerJoin(bays, eq(bookings.bayId, bays.id))
      .where(and(
        eq(bookings.userId, user.id),
        lt(bookings.startsAt, now),
      ))
      .orderBy(desc(bookings.startsAt))
      .limit(20),
  ])

  function statusBadge(status: string) {
    let cls = 'cancelled'
    if (status === 'confirmed' || status === 'checked_in') cls = 'confirmed'
    else if (status === 'pending') cls = 'pending'
    const label = status === 'checked_in' ? 'Checked In' : status.charAt(0).toUpperCase() + status.slice(1)
    return <span className={`ap-badge ${cls}`}>{label}</span>
  }

  function BookingRow({ b, isPast }: { b: typeof upcomingRows[0]; isPast?: boolean }) {
    return (
      <tr>
        <td>
          <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.82)', marginBottom: 2 }}>
            {formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEE, MMM d')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            {formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
            {formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}
          </div>
        </td>
        <td>{b.bayLabel}</td>
        <td>{durationLabel(b.startsAt, b.endsAt)}</td>
        <td>{b.totalCents > 0 ? `$${(b.totalCents / 100).toFixed(2)}` : '—'}</td>
        <td>{statusBadge(b.status)}</td>
        <td>
          <a href={`/account/bookings/${b.id}`} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            {isPast ? 'Details' : 'Manage'} →
          </a>
        </td>
      </tr>
    )
  }

  return (
    <div className="ap-page">
      <h1 className="ap-title">My Bookings</h1>
      <p className="ap-subtitle">Your upcoming and past sessions.</p>

      {/* Upcoming */}
      <div className="ap-card">
        <p className="ap-card-title">Upcoming</p>
        {upcomingRows.length === 0 ? (
          <div className="ap-empty">
            No upcoming sessions.{' '}
            <a href="/book" style={{ color: '#D4AF37' }}>Book a bay →</a>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Bay</th>
                  <th>Duration</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {upcomingRows.map(b => <BookingRow key={b.id} b={b} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Past */}
      <div className="ap-card">
        <p className="ap-card-title">Past Sessions</p>
        {pastRows.length === 0 ? (
          <div className="ap-empty">No past sessions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Bay</th>
                  <th>Duration</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pastRows.map(b => <BookingRow key={b.id} b={b} isPast />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
