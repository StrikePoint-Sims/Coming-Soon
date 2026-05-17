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
  return min % 60 === 0 ? `${min / 60} hr` : `${(min / 60).toFixed(1)} hr`
}

function statusLabel(s: string): string {
  if (s === 'checked_in') return 'Checked In'
  if (s === 'no_show') return 'No Show'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusClass(s: string): string {
  if (s === 'confirmed' || s === 'checked_in') return 'confirmed'
  if (s === 'completed') return 'completed'
  if (s === 'pending') return 'pending'
  return 'cancelled'
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const showPast = tab === 'past'
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
        partySize: bookings.partySize,
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
        partySize: bookings.partySize,
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

  const nextBooking = upcomingRows[0]
  const additionalUpcoming = upcomingRows.slice(1)

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">My Bookings</h1>
        <p className="dash-subtitle">View and manage your reservations.</p>
      </div>

      {/* Tabs */}
      <div className="bk-tabs">
        <a href="/account/bookings" className={`bk-tab${!showPast ? ' is-active' : ''}`}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="2.5" y="4" width="13" height="11" rx="2"/>
            <path d="M6 2.5v3M12 2.5v3M2.5 7.5h13"/>
          </svg>
          Upcoming
        </a>
        <a href="/account/bookings?tab=past" className={`bk-tab${showPast ? ' is-active' : ''}`}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="2.5" y="4" width="13" height="11" rx="2"/>
            <path d="M6 2.5v3M12 2.5v3M2.5 7.5h13"/>
          </svg>
          Past
        </a>
      </div>

      {!showPast ? (
        <>
          {/* ── Upcoming featured ──────────────────────────────────────── */}
          {nextBooking ? (
            <>
              <h2 className="bk-subheading">Upcoming Booking</h2>
              <div className="dash-section-card bk-featured">
                <div className="bk-featured-top">
                  <div className="dash-date-badge">
                    <span className="dash-date-month">
                      {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'EEE').toUpperCase()}
                    </span>
                    <span className="dash-date-day">
                      {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'd')}
                    </span>
                  </div>
                  <div className="bk-featured-main">
                    <p className="bk-featured-time">
                      {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                      {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'MMM')}{' '}
                      {formatInTimeZone(nextBooking.endsAt, FACILITY_TZ, 'h:mm a')}
                    </p>
                    <p className="bk-featured-sub">
                      {durationLabel(nextBooking.startsAt, nextBooking.endsAt)} ·{' '}
                      {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'EEE, MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="bk-featured-right">
                    <span className={`dash-status ${statusClass(nextBooking.status)}`}>
                      {statusLabel(nextBooking.status)}
                    </span>
                    {nextBooking.totalCents > 0 && (
                      <>
                        <span className="bk-featured-price">${(nextBooking.totalCents / 100).toFixed(2)}</span>
                        <span className="bk-featured-paid">Paid</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bk-meta-grid">
                  <div className="bk-meta">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <circle cx="7" cy="7" r="3"/>
                      <path d="M2 17a5 5 0 0110 0"/>
                      <circle cx="14" cy="8" r="2.5"/>
                    </svg>
                    <div>
                      <p className="bk-meta-label">Players</p>
                      <p className="bk-meta-value">{nextBooking.partySize || 1} Player{nextBooking.partySize !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="bk-meta">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <rect x="2" y="3" width="16" height="14" rx="2"/>
                      <path d="M2 7h16"/>
                    </svg>
                    <div>
                      <p className="bk-meta-label">Bay</p>
                      <p className="bk-meta-value">{nextBooking.bayLabel}</p>
                    </div>
                  </div>
                  <div className="bk-meta">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <circle cx="10" cy="10" r="7"/>
                      <path d="M10 6v4l2.5 2.5"/>
                    </svg>
                    <div>
                      <p className="bk-meta-label">Duration</p>
                      <p className="bk-meta-value">{durationLabel(nextBooking.startsAt, nextBooking.endsAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="bk-actions">
                  <a href={`/account/bookings/${nextBooking.id}`} className="dash-btn ghost bk-action-btn">
                    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
                      <circle cx="9" cy="9" r="2.5"/>
                    </svg>
                    View Details
                  </a>
                  <a href={`/account/bookings/${nextBooking.id}#change`} className="dash-btn ghost bk-action-btn">
                    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <circle cx="9" cy="9" r="7"/>
                      <path d="M9 5v4l3 2"/>
                    </svg>
                    Change Time
                  </a>
                  <a href={`/account/guests`} className="dash-btn ghost bk-action-btn">
                    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <circle cx="7" cy="6" r="3"/>
                      <path d="M2 16a5 5 0 0110 0"/>
                      <path d="M13 7h3M14.5 5.5v3"/>
                    </svg>
                    Add Guests
                  </a>
                  <a href={`/account/bookings/${nextBooking.id}#cancel`} className="dash-btn danger bk-action-btn">
                    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5h12M6 5V3a1 1 0 011-1h4a1 1 0 011 1v2M5 5l1 10h6l1-10"/>
                    </svg>
                    Cancel Booking
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="dash-section-card">
              <div className="dash-empty-block">
                <p className="dash-empty-heading">No upcoming sessions</p>
                <p className="dash-empty-body">Reserve your bay and get back in the game.</p>
                <a href="/book" className="dash-btn primary dash-btn-full">
                  Book a Bay
                </a>
              </div>
            </div>
          )}

          {/* ── Additional upcoming ─────────────────────────────────────── */}
          {additionalUpcoming.length > 0 && (
            <>
              <h2 className="bk-subheading bk-subheading-mt">More Upcoming</h2>
              <div className="bk-list">
                {additionalUpcoming.map(b => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        // ── Past tab ────────────────────────────────────────────────────
        <>
          {pastRows.length === 0 ? (
            <div className="dash-section-card">
              <div className="dash-empty-block">
                <p className="dash-empty-heading">No past sessions yet</p>
                <p className="dash-empty-body">Your completed bookings will appear here.</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="bk-subheading">Past Bookings</h2>
              <div className="bk-list">
                {pastRows.map(b => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function BookingRow({ b }: {
  b: {
    id: string
    startsAt: Date
    endsAt: Date
    bayLabel: string
    status: string
    totalCents: number
    partySize: number
  }
}) {
  return (
    <a href={`/account/bookings/${b.id}`} className="bk-row">
      <div className="dash-date-badge bk-row-badge">
        <span className="dash-date-month">
          {formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEE').toUpperCase()}
        </span>
        <span className="dash-date-day">
          {formatInTimeZone(b.startsAt, FACILITY_TZ, 'd')}
        </span>
      </div>
      <div className="bk-row-main">
        <p className="bk-row-time">
          {formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
          {formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}
          {' '}<span className="dash-muted">({durationLabel(b.startsAt, b.endsAt)})</span>
        </p>
        <p className="bk-row-meta">
          {b.partySize || 1} Player{b.partySize !== 1 ? 's' : ''} · {b.bayLabel}
        </p>
      </div>
      <div className="bk-row-right">
        {b.totalCents > 0 && (
          <span className="bk-row-price">${(b.totalCents / 100).toFixed(2)}</span>
        )}
        <span className={`dash-status ${statusClass(b.status)}`}>
          {statusLabel(b.status)}
        </span>
      </div>
      <span className="dash-chevron">›</span>
    </a>
  )
}
